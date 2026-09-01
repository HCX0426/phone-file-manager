import { ipcMain, dialog, BrowserWindow } from 'electron'
import { findDevices, getStorageInfo, scanAudio, exportFiles, pushFiles, exportMtpFile, RINGTONES_DIR } from './mtp/device'
import { detectFormat, convertToMp3 } from './converter/convert'
import { progressEmitter } from './converter/convert'

export function registerIpcHandlers(): void {
  ipcMain.handle('mtp:find-devices', async () => {
    return findDevices()
  })

  ipcMain.handle('mtp:get-root-folder', async (_, deviceName: string) => {
    return getStorageInfo(deviceName)
  })

  ipcMain.handle('mtp:scan-audio', async (_, deviceName: string, dirs: string[], exts: string[]) => {
    return scanAudio(deviceName, dirs, exts)
  })

  ipcMain.handle(
    'mtp:export-files',
    async (_, deviceName: string, dirs: string[], exts: string[], outDir: string) => {
      return exportFiles(deviceName, dirs, exts, outDir)
    }
  )

  ipcMain.handle(
    'mtp:push-files',
    async (_, deviceName: string, localPaths: string[], targetDir: string) => {
      return pushFiles(deviceName, localPaths, targetDir)
    }
  )

  ipcMain.handle('mtp:get-storage-info', async (_, deviceName: string) => {
    return getStorageInfo(deviceName)
  })

  ipcMain.handle('converter:detect-format', async (_, filePath: string) => {
    return detectFormat(filePath)
  })

  ipcMain.handle(
    'converter:convert-to-mp3',
    async (_, inputPaths: string[], outDir: string, bitrate: string) => {
      const win = BrowserWindow.getFocusedWindow()
      return convertToMp3(inputPaths, outDir, bitrate, (progress) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('converter:progress', progress)
        }
      })
    }
  )

  ipcMain.handle('converter:get-progress', async () => {
    return { total: 0, completed: 0, current: '' }
  })

  // 一键转换并推送铃声：先导出选中文件到临时目录 -> 本地转 mp3 -> 推送到手机 Ringtones
  ipcMain.handle(
    'converter:convert-and-push-ringtones',
    async (_, deviceName: string, mtpPaths: string[], bitrate: string) => {
      const win = BrowserWindow.getFocusedWindow()
      const emit = (progress: { total: number; completed: number; current: string }) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('converter:progress', progress)
        }
      }
      const tmpDir = await import('os').then((os) => os.tmpdir())
      const workDir = `${tmpDir}\\pfm_ringtone_${Date.now()}`
      const total = mtpPaths.length
      const errors: string[] = []
      const pushed: string[] = []

      try {
        // 1) 导出全部选中文件到工作目录
        emit({ total, completed: 0, current: '正在从手机导出...' })
        const localFiles: string[] = []
        for (let i = 0; i < mtpPaths.length; i++) {
          const fileName = mtpPaths[i].split('/').pop() || ''
          emit({ total, completed: i, current: `正在导出 ${fileName}` })
          try {
            localFiles.push(await exportMtpFile(deviceName, mtpPaths[i], workDir))
          } catch (err: any) {
            errors.push(`${fileName}: ${err.message}`)
          }
        }

        // 2) 本地转 mp3（仅对成功导出的文件）
        emit({ total, completed: total, current: '正在转换...' })
        const converted: string[] = []
        const successful = localFiles.length
        for (let i = 0; i < localFiles.length; i++) {
          const fileName = localFiles[i].split('\\').pop() || ''
          emit({ total: successful, completed: i, current: `正在转换 ${fileName}` })
          try {
            const result = await convertToMp3([localFiles[i]], workDir, bitrate, (p) => {
              emit({ total: successful, completed: i + (p.completed / Math.max(p.total, 1)), current: `正在转换 ${fileName}` })
            })
            result.outputFiles.forEach((o) => converted.push(o))
            result.errors.forEach((e) => errors.push(e))
          } catch (err: any) {
            errors.push(`${fileName}: ${err.message}`)
          }
        }

        // 3) 推送到手机 Ringtones
        emit({ total: converted.length, completed: 0, current: '正在推送到手机 Ringtones...' })
        if (converted.length > 0) {
          const pushResult = await pushFiles(deviceName, converted, RINGTONES_DIR)
          pushResult.errors.forEach((e) => errors.push(e))
          pushResult.count > 0 && pushResult.count === converted.length && pushed.push(...converted)
          emit({ total: converted.length, completed: converted.length, current: '' })
        } else {
          emit({ total: 1, completed: 1, current: '' })
        }

        return {
          success: errors.length === 0 && pushed.length === converted.length,
          total,
          exported: localFiles.length,
          converted: converted.length,
          pushed: pushed.length,
          errors
        }
      } finally {
        // 清理临时工作目录
        try {
          const { rmSync } = await import('fs')
          rmSync(workDir, { recursive: true, force: true })
        } catch {}
      }
    }
  )

  ipcMain.handle('dialog:select-directory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:select-files', async (_, filters: { name: string; extensions: string[] }[]) => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile', 'multiSelections'],
      filters
    })
    return result.canceled ? [] : result.filePaths
  })
}
