import { existsSync, mkdirSync, copyFileSync, statSync } from 'fs'
import { extname, basename, join, dirname } from 'path'
import { spawn } from 'child_process'
import { EventEmitter } from 'events'

export const progressEmitter = new EventEmitter()

const ENCRYPTED_EXTS = ['.ncm', '.mflac', '.mgg', '.mgg0', '.mgg1', '.mflac0', '.qmcflac', '.qmc0', '.qmc2', '.qmc3', '.qmcogg', '.kgm', '.kwm']
const PLAIN_AUDIO_EXTS = ['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.opus', '.aac', '.ape', '.wma']

export interface FormatInfo {
  format: string
  encrypted: boolean
  codec?: string
}

export function detectFormat(filePath: string): FormatInfo {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  const ext = extname(filePath).toLowerCase()
  if (ENCRYPTED_EXTS.includes(ext)) {
    return { format: ext, encrypted: true, codec: getEncryptedPlatform(ext) }
  }
  if (PLAIN_AUDIO_EXTS.includes(ext)) {
    return { format: ext, encrypted: false, codec: ext.replace('.', '') }
  }
  return { format: ext, encrypted: false }
}

function getEncryptedPlatform(ext: string): string {
  if (ext === '.ncm') return 'netease'
  if (['.qmcflac', '.qmc0', '.qmc2', '.qmc3', '.qmcogg'].includes(ext)) return 'qqmusic'
  if (['.mflac', '.mflac0', '.mgg', '.mgg0', '.mgg1'].includes(ext)) return 'qqmusic-v2'
  if (ext === '.kgm') return 'kugou'
  if (ext === '.kwm') return 'kuwo'
  return 'unknown'
}

export interface ConvertProgress {
  total: number
  completed: number
  current: string
}

function appRoot(): string {
  // 开发: 项目根 electron-app；打包: resources 目录
  const base =
    process.resourcesPath ||
    join(__dirname, '..', '..')
  return base
}

function findPythonExecutable(): string {
  const candidates = [
    process.env.PYTHON_PATH,
    join(appRoot(), 'python', process.platform === 'win32' ? 'venv\\Scripts\\python.exe' : 'venv/bin/python'),
    join(appRoot(), 'python/venv/Scripts/python.exe'),
    'python',
    'python3'
  ].filter(Boolean) as string[]

  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  // 找不到 venv 回退系统 python
  const fallback = candidates.find((p) => p === 'python' || p === 'python3')
  return fallback || 'python'
}

function findPythonScript(): string {
  const candidates = [
    process.env.PFM_PYTHON_SCRIPT,
    join(appRoot(), 'python/decode.py'),
    join(__dirname, 'python/decode.py'),
    join(__dirname, '../../python/decode.py'),
    join(appRoot(), 'python/decryptor/decode.py')
  ].filter(Boolean) as string[]

  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return join(appRoot(), 'python/decode.py')
}

export async function convertToMp3(
  inputPaths: string[],
  outDir: string,
  bitrate: string,
  onProgress?: (progress: ConvertProgress) => void
): Promise<{ success: boolean; outputFiles: string[]; errors: string[] }> {
  mkdirSync(outDir, { recursive: true })
  const outputFiles: string[] = []
  const errors: string[] = []
  const total = inputPaths.length

  for (let i = 0; i < inputPaths.length; i++) {
    const inputPath = inputPaths[i]
    const fileName = basename(inputPath)
    const nameWithoutExt = fileName.replace(extname(fileName), '')
    const outputPath = join(outDir, `${nameWithoutExt}.mp3`)

    onProgress?.({ total, completed: i, current: fileName })

    try {
      const info = detectFormat(inputPath)

      if (!info.encrypted && extname(inputPath).toLowerCase() === '.mp3') {
        copyFileSync(inputPath, outputPath)
        outputFiles.push(outputPath)
      } else {
        await convertSingleFile(inputPath, outputPath, bitrate)
        outputFiles.push(outputPath)
      }
    } catch (err: any) {
      errors.push(`${fileName}: ${err.message}`)
    }
  }

  onProgress?.({ total, completed: total, current: '' })
  return { success: errors.length === 0, outputFiles, errors }
}

function convertSingleFile(inputPath: string, outputPath: string, bitrate: string): Promise<void> {
  const ext = extname(inputPath).toLowerCase()
  if (ext === '.ncm') {
    return convertNcm(inputPath, outputPath, bitrate)
  }
  if (ENCRYPTED_EXTS.includes(ext)) {
    return convertEncryptedViaPython(inputPath, outputPath, bitrate)
  }
  if (ext === '.mp3') {
    return Promise.resolve()
  }
  if (['.flac', '.m4a', '.ogg', '.wav', '.ape'].includes(ext)) {
    return convertWithFfmpeg(inputPath, outputPath, bitrate)
  }
  return Promise.reject(new Error(`Unsupported format: ${ext}`))
}

async function convertNcm(inputPath: string, outputPath: string, bitrate: string): Promise<void> {
  return convertEncryptedViaPython(inputPath, outputPath, bitrate)
}

function convertEncryptedViaPython(
  inputPath: string,
  outputPath: string,
  bitrate: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const python = findPythonExecutable()
    const script = findPythonScript()
    const workDir = dirname(outputPath)

    if (!existsSync(script)) {
      reject(new Error(`Python 解密脚本不存在: ${script}`))
      return
    }

    const args = [
      script,
      '--input', inputPath,
      '--output', outputPath,
      '--bitrate', bitrate.replace('k', ''),  // 传入纯数字
      '--workdir', workDir
    ]

    const proc = spawn(python, args, { stdio: 'pipe' })
    let stderr = ''

    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })

    proc.on('close', (code) => {
      if (code === 0 && existsSync(outputPath)) {
        resolve()
      } else {
        reject(new Error(`Python 解密失败 (${code}): ${stderr}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`无法启动 Python: ${err.message}`))
    })
  })
}

function convertWithFfmpeg(inputPath: string, outputPath: string, bitrate: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let ffmpegPath = 'ffmpeg'
    try {
      // Try bundled ffmpeg via Python imageio-ffmpeg (handled by python script)
      const python = findPythonExecutable()
      const script = findPythonScript()
      const args = [
        script,
        '--input', inputPath,
        '--output', outputPath,
        '--bitrate', bitrate.replace('k', ''),
        '--transcode-only'
      ]
      const proc = spawn(python, args, { stdio: 'pipe' })
      let stderr = ''
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
      proc.on('close', (code) => {
        if (code === 0 && existsSync(outputPath)) {
          resolve()
        } else {
          reject(new Error(`转码失败 (${code}): ${stderr}`))
        }
      })
      proc.on('error', (err) => reject(new Error(`无法启动 Python: ${err.message}`)))
      return
    } catch (e: any) {
      reject(new Error(`FFmpeg error: ${e.message}`))
    }
  })
}