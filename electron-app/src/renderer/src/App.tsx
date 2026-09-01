import { useState, useEffect } from 'react'
import { ConfigProvider, Layout, theme, App as AntApp, message } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import Header from './components/Header/Header'
import DevicePanel from './components/DevicePanel/DevicePanel'
import FileList from './components/FileList/FileList'
import ConvertPanel from './components/ConvertPanel/ConvertPanel'
import TransferPanel from './components/TransferPanel/TransferPanel'

const { Content } = Layout

export interface Device {
  name: string
  type: string
}

export interface AudioFile {
  name: string
  path: string
  size: number
  ext: string
  selected?: boolean
}

export interface StorageInfo {
  total: number
  used: number
  free: number
}

export interface ConvertSettings {
  outputFormat: 'mp3' | 'flac' | 'm4a' | 'wav'
  bitrate: string
  sampleRate: string
  outputDir: string
}

export default function App() {
  const [device, setDevice] = useState<Device | null>(null)
  const [files, setFiles] = useState<AudioFile[]>([])
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<AudioFile[]>([])
  const [convertSettings, setConvertSettings] = useState<ConvertSettings>({
    outputFormat: 'mp3',
    bitrate: '192k',
    sampleRate: '44100',
    outputDir: ''
  })
  const [converting, setConverting] = useState(false)
  const [convertProgress, setConvertProgress] = useState({ total: 0, completed: 0, current: '' })
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    window.api.converter.onProgress((progress) => {
      setConvertProgress(progress)
      if (progress.completed >= progress.total && progress.total > 0) {
        setConverting(false)
      }
    })
  }, [])

  const handleDeviceConnected = async (dev: Device) => {
    setDevice(dev)
    const info = await window.api.mtp.getStorageInfo(dev.name)
    setStorageInfo(info)
  }

  const handleScan = async (dirs: string[], exts: string[]) => {
    if (!device) return
    setScanning(true)
    try {
      const result = await window.api.mtp.scanAudio(device.name, dirs, exts)
      setFiles(result.map((f) => ({ ...f, selected: false })))
    } catch (err) {
      message.error('扫描失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setScanning(false)
    }
  }

  const handleFileSelect = (file: AudioFile, selected: boolean) => {
    const updated = files.map((f) => (f.path === file.path ? { ...f, selected } : f))
    setFiles(updated)
    setSelectedFiles(updated.filter((f) => f.selected))
  }

  const handleSelectAll = (selected: boolean) => {
    const updated = files.map((f) => ({ ...f, selected }))
    setFiles(updated)
    setSelectedFiles(selected ? [...updated] : [])
  }

  const handleConvert = async () => {
    if (selectedFiles.length === 0 || !convertSettings.outputDir) return
    setConverting(true)
    try {
      const paths = selectedFiles.map((f) => f.path)
      await window.api.converter.convertToMp3(
        paths,
        convertSettings.outputDir,
        convertSettings.bitrate
      )
      message.success('转换完成')
    } catch (err) {
      message.error('转换失败：' + (err instanceof Error ? err.message : String(err)))
      setConverting(false)
    }
  }

  const handleConvertAndPush = async () => {
    if (!device || selectedFiles.length === 0) return
    setConverting(true)
    try {
      const paths = selectedFiles.map((f) => f.path)
      const result = await window.api.converter.convertAndPushRingtones(
        device.name,
        paths,
        convertSettings.bitrate
      )
      if (result.success) {
        message.success(`已转换 ${result.converted} 首并推送到手机 Ringtones`)
      } else {
        message.warning(
          `部分失败：导出 ${result.exported}/${result.total}，转换 ${result.converted}，推送 ${result.pushed}${result.errors.length ? '。' + result.errors.slice(0, 3).join('；') : ''}`
        )
      }
    } catch (err) {
      message.error('转换失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setConverting(false)
    }
  }

  const handleExport = async () => {
    if (!device || selectedFiles.length === 0 || !convertSettings.outputDir) return
    const dirs = [...new Set(selectedFiles.map((f) => f.path.split('/').slice(-2, -1)[0] || f.path))]
    const exts = [...new Set(selectedFiles.map((f) => f.ext))]
    await window.api.mtp.exportFiles(device.name, dirs, exts, convertSettings.outputDir)
  }

  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm }}>
      <AntApp>
        <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
          <Header />
          <Content style={{ padding: '16px 24px' }}>
            <DevicePanel
              device={device}
              storageInfo={storageInfo}
              scanning={scanning}
              onDeviceConnected={handleDeviceConnected}
              onScan={handleScan}
            />
            <FileList
              files={files}
              scanning={scanning}
              onSelect={handleFileSelect}
              onSelectAll={handleSelectAll}
            />
            <ConvertPanel
              settings={convertSettings}
              selectedCount={selectedFiles.length}
              converting={converting}
              convertProgress={convertProgress}
              scanPaths={files.map((f) => f.path)}
              onSettingsChange={setConvertSettings}
              onConvert={handleConvert}
              onConvertAndPush={handleConvertAndPush}
              onExport={handleExport}
            />
            <TransferPanel converting={converting} progress={convertProgress} />
          </Content>
        </Layout>
      </AntApp>
    </ConfigProvider>
  )
}
