import { Card, Space, Select, Input, Button, Tag, Progress, AutoComplete } from 'antd'
import {
  SettingOutlined,
  FolderOpenOutlined,
  SwapOutlined,
  CloudDownloadOutlined,
  MobileOutlined
} from '@ant-design/icons'
import type { ConvertSettings } from '../../App'

interface ConvertPanelProps {
  settings: ConvertSettings
  selectedCount: number
  converting: boolean
  convertProgress: { total: number; completed: number; current: string }
  scanPaths: string[]
  onSettingsChange: (settings: ConvertSettings) => void
  onConvert: () => void
  onConvertAndPush: () => void
  onExport: () => void
}

export default function ConvertPanel({
  settings,
  selectedCount,
  converting,
  convertProgress,
  scanPaths,
  onSettingsChange,
  onConvert,
  onConvertAndPush,
  onExport
}: ConvertPanelProps) {
  const handleSelectDir = async () => {
    const dir = await window.api.dialog.selectDirectory()
    if (dir) {
      onSettingsChange({ ...settings, outputDir: dir })
    }
  }

  // 把扫描出的文件路径去重为一个目录列表，用户可下拉选择（排序：根目录在前，深层在后）
  // 去掉卷名前缀（"内部共享存储空间/..." -> "..."），更直观
  const dirOptions = [...new Set(
    scanPaths
      .map((p) => {
        const parts = p.split('/')
        parts.pop()
        const clean = parts.length > 1 ? parts.slice(1).join('/') : (parts[0] || '')
        return clean
      })
      .filter(Boolean)
  )]
    .sort((a, b) => a.split('/').length - b.split('/').length)
    .map((d) => ({ label: d, value: d }))

  return (
    <Card
      title={
        <Space>
          <SettingOutlined />
          <span>转换设置</span>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Space wrap size="middle" style={{ width: '100%' }}>
        <Space>
          <span>输出格式:</span>
          <Select
            value={settings.outputFormat}
            onChange={(v) => onSettingsChange({ ...settings, outputFormat: v })}
            style={{ width: 120 }}
            options={[
              { label: 'MP3', value: 'mp3' },
              { label: 'FLAC', value: 'flac' },
              { label: 'M4A', value: 'm4a' },
              { label: 'WAV', value: 'wav' }
            ]}
          />
        </Space>

        <Space>
          <span>比特率:</span>
          <Select
            value={settings.bitrate}
            onChange={(v) => onSettingsChange({ ...settings, bitrate: v })}
            style={{ width: 120 }}
            options={[
              { label: '128 kbps', value: '128k' },
              { label: '192 kbps', value: '192k' },
              { label: '256 kbps', value: '256k' },
              { label: '320 kbps', value: '320k' }
            ]}
          />
        </Space>

        <Space>
          <span>输出目录:</span>
          <AutoComplete
            value={settings.outputDir}
            onChange={(v) => onSettingsChange({ ...settings, outputDir: v })}
            placeholder="选择或输入输出目录"
            options={dirOptions}
            style={{ width: 300 }}
          >
            <Input
              addonAfter={
                <Button
                  type="text"
                  icon={<FolderOpenOutlined />}
                  onClick={handleSelectDir}
                  size="small"
                >
                  浏览
                </Button>
              }
            />
          </AutoComplete>
        </Space>
      </Space>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Tag color={selectedCount > 0 ? 'blue' : 'default'}>
            已选择 {selectedCount} 个文件
          </Tag>
          {!settings.outputDir && selectedCount > 0 && (
            <Tag color="warning">请先选择输出目录</Tag>
          )}
        </Space>

        <Space>
          <Button
            icon={<CloudDownloadOutlined />}
            disabled={selectedCount === 0 || !settings.outputDir}
            onClick={onExport}
          >
            直接导出
          </Button>
          <Button
            type="primary"
            icon={<MobileOutlined />}
            loading={converting}
            disabled={selectedCount === 0}
            onClick={onConvertAndPush}
          >
            {converting ? '转换并推送中...' : '转换并推送铃声'}
          </Button>
          <Button
            icon={<SwapOutlined />}
            disabled={selectedCount === 0 || !settings.outputDir}
            onClick={onConvert}
          >
            转换并导出
          </Button>
        </Space>
      </div>
    </Card>
  )
}
