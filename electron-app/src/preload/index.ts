import { contextBridge, ipcRenderer } from 'electron'

const api = {
  mtp: {
    findDevices: () => ipcRenderer.invoke('mtp:find-devices'),
    getRootFolder: (deviceName: string) => ipcRenderer.invoke('mtp:get-root-folder', deviceName),
    scanAudio: (deviceName: string, dirs: string[], exts: string[]) =>
      ipcRenderer.invoke('mtp:scan-audio', deviceName, dirs, exts),
    exportFiles: (deviceName: string, dirs: string[], exts: string[], outDir: string) =>
      ipcRenderer.invoke('mtp:export-files', deviceName, dirs, exts, outDir),
    pushFiles: (deviceName: string, localPaths: string[], targetDir: string) =>
      ipcRenderer.invoke('mtp:push-files', deviceName, localPaths, targetDir),
    getStorageInfo: (deviceName: string) => ipcRenderer.invoke('mtp:get-storage-info', deviceName)
  },
  converter: {
    detectFormat: (filePath: string) => ipcRenderer.invoke('converter:detect-format', filePath),
    convertToMp3: (inputPaths: string[], outDir: string, bitrate: string) =>
      ipcRenderer.invoke('converter:convert-to-mp3', inputPaths, outDir, bitrate),
    convertAndPushRingtones: (deviceName: string, mtpPaths: string[], bitrate: string) =>
      ipcRenderer.invoke('converter:convert-and-push-ringtones', deviceName, mtpPaths, bitrate),
    getConversionProgress: () => ipcRenderer.invoke('converter:get-progress'),
    onProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('converter:progress', (_, data) => callback(data))
    }
  },
  dialog: {
    selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
    selectFiles: (filters: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke('dialog:select-files', filters)
  }
}

contextBridge.exposeInMainWorld('api', api)
