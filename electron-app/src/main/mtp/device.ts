import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdirSync } from 'fs'
import { join } from 'path'

const execFileAsync = promisify(execFile)
const POWERSHELL = 'powershell.exe'
export const RINGTONES_DIR = 'Ringtones'

async function runPsScript(script: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(POWERSHELL, [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      // 强制 PowerShell 以 UTF-8 输出，避免中文乱码
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ' + script
    ])
    return stdout.trim()
  } catch (err: any) {
    throw new Error('PowerShell error: ' + (err.stderr || err.message))
  }
}

function escapePs(s: string): string {
  return s.replace(/'/g, "''")
}

export interface MtpDevice {
  name: string
  type: string
}

export interface AudioFileInfo {
  name: string
  path: string
  size: number
  ext: string
}

export interface StorageInfoResult {
  total: number
  used: number
  free: number
}

export async function findDevices(): Promise<MtpDevice[]> {
  const script = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ',
    '$shell = New-Object -ComObject Shell.Application',
    '$mtpc = $shell.Namespace(17)',
    'foreach ($d in $mtpc.Items()) {',
    '  $t = ""',
    '  try { $t = $d.Type } catch {}',
    '  Write-Output "$($d.Name)|||$t"',
    '}'
  ].join('\n')

  const output = await runPsScript(script)
  if (!output) return []

  return output
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const parts = line.split('|||')
      const name = parts[0].trim()
      const type = (parts[1] || '').trim()
      return { name, type }
    })
    // 过滤：只保留移动设备（手机/MTP）。跳过本地磁盘、系统文件夹、网络等
    .filter(isMobileDevice)
}

// 判断是否为移动设备（手机 MTP）
// 手机上显示类型为"移动电话"，英文系统为 "Mobile Device" / "Portable Device" 等
function isMobileDevice(d: MtpDevice): boolean {
  const t = d.type
  if (!t) return false
  // 明确排除非移动项
  if (['本地磁盘', '系统文件夹', 'CD 驱动器', '网络位置', '本地磁盘 (C:)', '计算机', '桌面'].includes(t)) {
    return false
  }
  // 类型含这些关键字的认为是移动设备
  return /移动|手机|电话|便携|MTP|Phone|Mobile|Portable|WPD|Android/i.test(t) || /Ace|Redmi|MI|Galaxy|Pixel|Android/i.test(d.name)
}

export async function getStorageInfo(deviceName: string): Promise<StorageInfoResult> {
  const dn = escapePs(deviceName)
  const script = [
    '$shell = New-Object -ComObject Shell.Application',
    '$mtpc = $shell.Namespace(17)',
    'foreach ($d in $mtpc.Items()) {',
    "  if ($d.Name -match '" + dn + "') {",
    '    $totalSum = 0',
    '    $freeSum = 0',
    '    $count = 0',
    '    foreach ($vol in $d.GetFolder.Items()) {',
    '      $total = 0',
    '      $free = 0',
    '      try {',
    '        $total = $vol.ExtendedProperty("System.Capacity")',
    '        $free = $vol.ExtendedProperty("System.FreeSpace")',
    '      } catch {}',
    '      if ($total -gt 0) {',
    '        $totalSum += $total',
    '        $freeSum += $free',
    '        $count++',
    '      }',
    '    }',
    '    if ($totalSum -gt 0) {',
    '      $used = $totalSum - $freeSum',
    '      Write-Output "$totalSum|$used|$freeSum"',
    '    }',
    '    break',
    '  }',
    '}'
  ].join('\n')

  const output = await runPsScript(script)
  if (!output) {
    return { total: 64 * 1024 * 1024 * 1024, used: 0, free: 64 * 1024 * 1024 * 1024 }
  }

  const [total, used, free] = output.split('|').map((v) => parseInt(v, 10) || 0)
  return {
    total: total || 64 * 1024 * 1024 * 1024,
    used: used > 0 ? used : total || 0,
    free: free || 64 * 1024 * 1024 * 1024
  }
}

export async function scanAudio(
  deviceName: string,
  dirs: string[],
  exts: string[]
): Promise<AudioFileInfo[]> {
  const dn = escapePs(deviceName)
  const dirStr = escapePs(dirs.join(','))
  const extStr = escapePs(exts.join(','))

  // 扩展要扫描的目录白名单：显式目录 + 自动发现的常见音乐App目录
  // 这些是跨品牌通用的 Android 目录结构（QQ/网易/酷狗/酷我等）
  // 注意：不要加网盘/大目录（如 BaiduNetdisk），会拖慢扫描甚至中断
  const autoDirs = ['netease', 'qqmusic', 'qqmusicqrc', 'kgmusic', 'kugou', 'kwmusic', 'musics', 'Podcast']
  const autoDirStr = escapePs(autoDirs.join(','))

  const script = [
    '$shell = New-Object -ComObject Shell.Application',
    '$mtpc = $shell.Namespace(17)',
    "$targetDirs = '" + dirStr + "' -split ','",
    "$targetExts = '" + extStr + "' -split ','",
    "$autoDirs = '" + autoDirStr + "' -split ','",
    '',
    'foreach ($d in $mtpc.Items()) {',
    "  if ($d.Name -match '" + dn + "') {",
    '    $volumes = @($d.GetFolder.Items())',
    '    foreach ($vol in $volumes) {',
    '      $root = $null',
    '      try { $root = $vol.GetFolder } catch {}',
    '      if (-not $root) { continue }',
'      Write-Output ("SCAN_ROOT|" + $vol.Name)',
    '',
    '      # 1) 显式白名单目录（顶层）+ 自动发现目录',
    '      $rootNames = @()',
    '      foreach ($it in $root.Items()) { $rootNames += $it.Name }',
    '      $scanList = @()',
    '      foreach ($t in $targetDirs) { if ($rootNames -contains $t) { $scanList += $t } }',
    '      foreach ($a in $autoDirs) { if ($rootNames -contains $a) { $scanList += $a } }',
    '      # 去重',
    '      $scanList = $scanList | Select-Object -Unique',
    '      $volLabel = $vol.Name',
    '',
    '      function Traverse([object]$item, [int]$level, [string]$label) {',
    '        if ($level -gt 6) { return }',
    '        $sf = $null',
    '        try { $sf = $item.GetFolder } catch {}',
    '        if ($sf) {',
    '          try {',
    '            foreach ($ch in $sf.Items()) {',
    '              Traverse $ch ($level+1) ($label + "/" + $item.Name)',
    '            }',
    '          } catch {}',
    '          return',
    '        }',
    "        $ext = [System.IO.Path]::GetExtension([string]$item.Name)",
    "        if ($ext -and ($targetExts -contains $ext.ToLower())) {",
    '          $size = 0',
    "          try { $size = $item.ExtendedProperty('System.Size') } catch {}",
    '          Write-Output ($item.Name + "|" + $volLabel + "/" + $label + "/" + $item.Name + "|" + $size + "|" + $ext)',
    '        }',
    '      }',
    '',
    '      # 扫描白名单/自动发现的顶层目录',
    '      foreach ($t in $scanList) {',
    '        foreach ($sub in $root.Items()) {',
    '          if ($sub.Name -eq $t) {',
    '            $sf = $null',
    '            try { $sf = $sub.GetFolder } catch {}',
    '            if ($sf) {',
    '              Write-Output ("SCAN_DIR|" + $t)',
    '              foreach ($ch in $sf.Items()) {',
    '                Traverse $ch 2 $sub.Name',
    '              }',
    '            }',
    '            break',
    '          }',
    '        }',
    '      }',
    '',
    '      # 2) 在 Download 等父目录下发现音乐App目录（netease/qqmusic/kgmusic...）',
    '      foreach ($parent in @("Download","qqmusic")) {',
    '        $pFolder = $null',
    '        foreach ($it in $root.Items()) { if ($it.Name -eq $parent) { try { $pFolder = $it.GetFolder } catch {} } }',
    '        if (-not $pFolder) { continue }',
    '        foreach ($it in $pFolder.Items()) {',
    '          if ($autoDirs -contains $it.Name) {',
    '            $sf = $null',
    '            try { $sf = $it.GetFolder } catch {}',
    '            if ($sf) {',
    '              Write-Output ("SCAN_DIR|" + $parent + "/" + $it.Name)',
    '              foreach ($ch in $sf.Items()) {',
    '                Traverse $ch 3 ($parent + "/" + $it.Name)',
    '              }',
    '            }',
    '          }',
    '        }',
    '      }',
    '    }',
    '    break',
    '  }',
    '}'
  ].join('\n')

  const output = await runPsScript(script)
  if (!output) return []

  const seen = new Set<string>()
  return output
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [name, path, sizeStr, ext] = line.split('|')
      if (!ext) return null // SCAN_* 信息行
      return {
        name: name.trim(),
        path: path.trim(),
        size: parseInt(sizeStr, 10) || 0,
        ext: ext.trim().toLowerCase()
      }
    })
    .filter((f): f is AudioFileInfo => f !== null)
    // 同一卷下可能被多个扫入口命中（如 Download 递归 与 netease 目录），按路径去重
    .filter((f) => {
      if (seen.has(f.path)) return false
      seen.add(f.path)
      return true
    })
}

export async function exportFiles(
  deviceName: string,
  dirs: string[],
  exts: string[],
  outDir: string
): Promise<{ success: boolean; count: number; errors: string[] }> {
  const files = await scanAudio(deviceName, dirs, exts)
  const errors: string[] = []
  let count = 0
  const dn = escapePs(deviceName)
  const od = escapePs(outDir)

  for (const file of files) {
    try {
      const fp = escapePs(file.path)
      const script = [
        '$shell = New-Object -ComObject Shell.Application',
        "$localDir = $shell.Namespace('" + od + "')",
        '$mtpc = $shell.Namespace(17)',
        'foreach ($d in $mtpc.Items()) {',
        "  if ($d.Name -match '" + dn + "') {",
        '    $inner = $null',
        '    foreach ($sub in $d.GetFolder.Items()) { $inner = $sub; break }',
        '    if ($inner) {',
        '      $root = $inner.GetFolder',
        "$pathParts = '" + fp + "' -split '/'",
        '      $current = $root',
        '      for ($i = 1; $i -lt $pathParts.Count - 1; $i++) {',
        '        foreach ($item in $current.Items()) {',
        '          if ($item.Name -eq $pathParts[$i]) {',
        '            $sf = $null',
        '            try { $sf = $item.GetFolder } catch {}',
        '            if ($sf) { $current = $sf; break }',
        '          }',
        '        }',
        '      }',
        '      $fileName = $pathParts[$pathParts.Count - 1]',
        '      foreach ($item in $current.Items()) {',
        '        if ($item.Name -eq $fileName) {',
        '          $localDir.CopyHere($item, 0x814)',
        '          Start-Sleep -Milliseconds 2000',
        '          break',
        '        }',
        '      }',
        '    }',
        '    break',
        '  }',
        '}'
      ].join('\n')

      await runPsScript(script)
      count++
    } catch (err: any) {
      errors.push(file.name + ': ' + err.message)
    }
  }

  return { success: errors.length === 0, count, errors }
}

// 按 MTP 完整路径（卷名/目录/文件名）把单个文件从手机复制到本地目录
export async function exportMtpFile(deviceName: string, mtpPath: string, outDir: string): Promise<string> {
  mkdirSync(outDir, { recursive: true })
  const dn = escapePs(deviceName)
  const od = escapePs(outDir)
  const parts = mtpPath.split('/')
  const fileName = parts[parts.length - 1]
  const volName = parts[0]
  const pathPartsEsc = escapePs(mtpPath)

  const script = [
    '$shell = New-Object -ComObject Shell.Application',
    "if (-not (Test-Path '" + od + "')) { New-Item -ItemType Directory -Path '" + od + "' -Force | Out-Null }",
    "$localDir = $shell.Namespace('" + od + "')",
    '$mtpc = $shell.Namespace(17)',
    'foreach ($d in $mtpc.Items()) {',
    "  if ($d.Name -match '" + dn + "') {",
    '    foreach ($vol in $d.GetFolder.Items()) {',
    "      if ($vol.Name -eq '" + escapePs(volName) + "') {",
    '        $root = $vol.GetFolder',
    "$pathParts = '" + pathPartsEsc + "' -split '/'",
    '        $current = $root',
    '        for ($i = 1; $i -lt $pathParts.Count - 1; $i++) {',
    '          foreach ($item in $current.Items()) {',
    '            if ($item.Name -eq $pathParts[$i]) {',
    '              $sf = $null',
    '              try { $sf = $item.GetFolder } catch {}',
    '              if ($sf) { $current = $sf; break }',
    '            }',
    '          }',
    '        }',
    '        $copied = $false',
    '        foreach ($item in $current.Items()) {',
    "          if ($item.Name -eq '" + escapePs(fileName) + "') {",
    '            $localDir.CopyHere($item, 0x814)',
    '            $copied = $true',
    '            break',
    '          }',
    '        }',
    '        if (-not $copied) { throw "MTP 文件不存在: ' + escapePs(mtpPath) + '" }',
    '        break',
    '      }',
    '    }',
    '    break',
    '  }',
    '}'
  ].join('\n')

  await runPsScript(script)
  // MTP 复制是异步的，等待文件落盘再返回
  const localPath = join(outDir, fileName)
  await waitForFile(localPath)
  return localPath
}

function waitForFile(p: string, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const { existsSync } = require('fs')
    const start = Date.now()
    const check = () => {
      if (existsSync(p)) return resolve()
      if (Date.now() - start > timeoutMs) return reject(new Error('导出超时: ' + p))
      setTimeout(check, 300)
    }
    check()
  })
}

export async function pushFiles(
  deviceName: string,
  localPaths: string[],
  targetDir: string
): Promise<{ success: boolean; count: number; errors: string[] }> {
  const errors: string[] = []
  let count = 0
  const dn = escapePs(deviceName)
  const td = escapePs(targetDir)

  for (const filePath of localPaths) {
    try {
      const fp = escapePs(filePath)
      const script = [
        '$shell = New-Object -ComObject Shell.Application',
        '$mtpc = $shell.Namespace(17)',
        'foreach ($d in $mtpc.Items()) {',
        "  if ($d.Name -match '" + dn + "') {",
        '    $inner = $null',
        '    foreach ($sub in $d.GetFolder.Items()) { $inner = $sub; break }',
        '    if ($inner) {',
        '      $root = $inner.GetFolder',
        '      foreach ($item in $root.Items()) {',
        "        if ($item.Name -eq '" + td + "') {",
        '          $destFolder = $item.GetFolder',
        "          $destFolder.CopyHere('" + fp + "', 0x814)",
        '          Start-Sleep -Seconds 3',
        '          break',
        '        }',
        '      }',
        '    }',
        '    break',
        '  }',
        '}'
      ].join('\n')

      await runPsScript(script)
      count++
    } catch (err: any) {
      errors.push(filePath + ': ' + err.message)
    }
  }

  return { success: errors.length === 0, count, errors }
}
