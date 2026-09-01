/// <reference types="vite/client" />

interface Window {
  api: {
    mtp: {
      findDevices: () => Promise<{ name: string; type: string }[]>
      getRootFolder: (deviceName: string) => Promise<boolean>
      scanAudio: (
        deviceName: string,
        dirs: string[],
        exts: string[]
      ) => Promise<{ name: string; path: string; size: number; ext: string }[]>
      exportFiles: (
        deviceName: string,
        dirs: string[],
        exts: string[],
        outDir: string
      ) => Promise<{ success: boolean; count: number; errors: string[] }>
      pushFiles: (
        deviceName: string,
        localPaths: string[],
        targetDir: string
      ) => Promise<{ success: boolean; count: number; errors: string[] }>
      getStorageInfo: (deviceName: string) => Promise<{
        total: number
        used: number
        free: number
      }>
    }
    converter: {
      detectFormat: (
        filePath: string
      ) => Promise<{ format: string; encrypted: boolean; codec?: string }>
      convertToMp3: (
        inputPaths: string[],
        outDir: string,
        bitrate: string
      ) => Promise<{ success: boolean; outputFiles: string[]; errors: string[] }>
      convertAndPushRingtones: (
        deviceName: string,
        mtpPaths: string[],
        bitrate: string
      ) => Promise<{
        success: boolean
        total: number
        exported: number
        converted: number
        pushed: number
        errors: string[]
      }>
      getConversionProgress: () => Promise<{
        total: number
        completed: number
        current: string
      }>
      onProgress: (callback: (progress: any) => void) => void
    }
    dialog: {
      selectDirectory: () => Promise<string | null>
      selectFiles: (
        filters: { name: string; extensions: string[] }[]
      ) => Promise<string[]>
    }
  }
}
