import { useState } from 'react'
import { Card, Button, Space, Tag, Progress, Empty, message, Modal, List, Select, Typography } from 'antd'
import {
  UsbOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleFilled,
  MobileOutlined,
  FilterOutlined
} from '@ant-design/icons'
import type { Device, StorageInfo } from '../../App'

interface DevicePanelProps {
  device: Device | null
  storageInfo: StorageInfo | null
  scanning: boolean
  onDeviceConnected: (device: Device) => void
  onScan: (dirs: string[], exts: string[]) => void
}

// 所有候选目录（手机根目录常见目录，按可扫描性排序）
export const ALL_AUDIO_DIRS = [
  'Music',
  'Download',
  'Ringtones',
  'Recordings',
  'Notifications',
  'Alarms',
  'DCIM',
  'Audiobooks',
  'Podcasts',
  'qqmusic',
  'qqmusicqrc',
  'tencent',
  'MIUI'
]

// 所有候选扩展名
export const ALL_AUDIO_EXTS = [
  '.mp3', '.flac', '.m4a', '.ogg', '.wav', '.opus', '.aac', '.ape', '.wma',
  '.ncm', '.mflac', '.mgg', '.qmcflac', '.qmc0', '.kgm', '.kwm'
]

// 默认选中的目录（不递归到 tencent/MIUI 等深层）
const DEFAULT_DIRS = ['Music', 'Download', 'Ringtones', 'Recordings', 'Notifications', 'Alarms', 'DCIM', 'Audiobooks', 'Podcasts', 'qqmusic']

const DEFAULT_EXTS = ALL_AUDIO_EXTS

export default function DevicePanel({
  device,
  storageInfo,
  scanning,
  onDeviceConnected,
  onScan
}: DevicePanelProps) {
  const [connecting, setConnecting] = useState(false)
  const [deviceModalOpen, setDeviceModalOpen] = useState(false)
  const [devicesFound, setDevicesFound] = useState<Device[]>([])
  const [scanConfigOpen, setScanConfigOpen] = useState(false)
  const [scanDirs, setScanDirs] = useState<string[]>(DEFAULT_DIRS)
  const [scanExts, setScanExts] = useState<string[]>(DEFAULT_EXTS)

  const selectDevice = async (dev: Device) => {
    setDeviceModalOpen(false)
    setConnecting(true)
    try {
      onDeviceConnected(dev)
      message.success(`已连接: ${dev.name}`)
    } catch {
      message.error('连接失败')
    } finally {
      setConnecting(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const devices = await window.api.mtp.findDevices()
      if (devices.length === 0) {
        message.warning('未检测到手机，请确认USB已连接并选择了文件传输模式')
        return
      }
      if (devices.length === 1) {
        selectDevice(devices[0])
      } else {
        setDevicesFound(devices)
        setDeviceModalOpen(true)
      }
    } catch {
      message.error('连接失败')
    } finally {
      setConnecting(false)
    }
  }

  const handleScan = () => {
    const dirs = scanDirs.length ? scanDirs : ALL_AUDIO_DIRS
    const exts = scanExts.length ? scanExts : ALL_AUDIO_EXTS
    onScan(dirs, exts)
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <Card
      title={
        <Space>
          <UsbOutlined />
          <span>设备连接</span>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      {!device ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Empty description="未连接设备" />
          <Button
            type="primary"
            icon={<UsbOutlined />}
            loading={connecting}
            onClick={handleConnect}
            size="large"
            style={{ marginTop: 16 }}
          >
            检测手机
          </Button>
        </div>
      ) : (
        <div>
          <Space size="large" style={{ marginBottom: 16 }}>
            <Tag icon={<CheckCircleFilled />} color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
              {device.name}
            </Tag>
            <Button icon={<ReloadOutlined />} onClick={handleConnect}>
              刷新设备
            </Button>
          </Space>

          {storageInfo && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>存储空间</span>
                <span>
                  {formatSize(storageInfo.used)} / {formatSize(storageInfo.total)}
                </span>
              </div>
              <Progress
                percent={Math.round((storageInfo.used / storageInfo.total) * 100)}
                strokeColor="#1677ff"
                showInfo={true}
              />
            </div>
          )}

          <Space>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={scanning}
              onClick={handleScan}
              size="large"
            >
              扫描音频文件
            </Button>
            <Button icon={<FilterOutlined />} onClick={() => setScanConfigOpen(true)}>
              扫描设置
            </Button>
          </Space>
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              提示：若手机上刚下载/移入的歌曲扫不到，请先拔插一次 USB 线（Windows 的 MTP 缓存有时不会立即同步新文件）
            </Typography.Text>
          </div>
        </div>
      )}

      <Modal
        title="扫描设置"
        open={scanConfigOpen}
        onCancel={() => setScanConfigOpen(false)}
        onOk={() => setScanConfigOpen(false)}
        width={640}
      >
        <div style={{ marginBottom: 8 }}>
          <strong>扫描目录</strong>
          <span style={{ color: '#888', marginLeft: 8 }}>未选则扫描全部目录</span>
        </div>
        <Select
          mode="multiple"
          style={{ width: '100%', marginBottom: 16 }}
          placeholder="选择要扫描的目录（不选则扫描全部）"
          value={scanDirs}
          onChange={setScanDirs}
          options={ALL_AUDIO_DIRS.map((d) => ({ label: d, value: d }))}
          allowClear
          optionFilterProp="label"
        />
        <div style={{ marginBottom: 8 }}>
          <strong>文件类型</strong>
          <span style={{ color: '#888', marginLeft: 8 }}>未选则全类型</span>
        </div>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="选择音频文件类型（不选则全类型）"
          value={scanExts}
          onChange={setScanExts}
          options={ALL_AUDIO_EXTS.map((e) => ({ label: e, value: e }))}
          allowClear
          optionFilterProp="label"
        />
      </Modal>

      <Modal
        title="选择设备"
        open={deviceModalOpen}
        onCancel={() => setDeviceModalOpen(false)}
        footer={null}
      >
        <List
          dataSource={devicesFound}
          renderItem={(dev) => (
            <List.Item
              onClick={() => selectDevice(dev)}
              style={{ cursor: 'pointer' }}
            >
              <Space>
                <MobileOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                <span>{dev.name}</span>
                <Tag>{dev.type}</Tag>
              </Space>
            </List.Item>
          )}
        />
      </Modal>
    </Card>
  )
}
