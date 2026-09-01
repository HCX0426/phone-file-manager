import { Card, Table, Checkbox, Empty, Spin, Tag, Space, Typography } from 'antd'
import { AudioOutlined, FileOutlined } from '@ant-design/icons'
import type { AudioFile } from '../../App'

interface FileListProps {
  files: AudioFile[]
  scanning: boolean
  onSelect: (file: AudioFile, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
}

const { Text } = Typography

const FORMAT_COLORS: Record<string, string> = {
  '.mp3': '#1677ff',
  '.flac': '#52c41a',
  '.m4a': '#722ed1',
  '.ogg': '#fa8c16',
  '.wav': '#13c2c2',
  '.ncm': '#eb2f96',
  '.mflac': '#2f54eb',
  '.mgg': '#f5222d',
  '.kgm': '#faad14',
  '.kwm': '#a0d911'
}

const FORMAT_LABELS: Record<string, string> = {
  '.ncm': '网易云',
  '.mflac': 'QQ音乐',
  '.mgg': 'QQ音乐',
  '.qmcflac': 'QQ音乐',
  '.qmc0': 'QQ音乐',
  '.kgm': '酷狗',
  '.kwm': '酷我'
}

export default function FileList({ files, scanning, onSelect, onSelectAll }: FileListProps) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // 去掉卷名前缀（如 "内部共享存储空间/Download/..." -> "Download/..."），让路径更直观
  const shortPath = (path: string) => {
    const parts = path.split('/')
    return parts.length > 1 ? parts.slice(1).join('/') : path
  }

  const allSelected = files.length > 0 && files.every((f) => f.selected)
  const someSelected = files.some((f) => f.selected) && !allSelected

  const columns = [
    {
      title: (
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={(e) => onSelectAll(e.target.checked)}
        />
      ),
      width: 50,
      render: (_: any, record: AudioFile) => (
        <Checkbox
          checked={record.selected}
          onChange={(e) => onSelect(record, e.target.checked)}
        />
      )
    },
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: AudioFile) => (
        <Space>
          <AudioOutlined style={{ color: FORMAT_COLORS[record.ext] || '#999' }} />
          <Text ellipsis={{ tooltip: name }} style={{ maxWidth: 400 }}>
            {name}
          </Text>
        </Space>
      )
    },
    {
      title: '格式',
      dataIndex: 'ext',
      key: 'ext',
      width: 120,
      render: (ext: string) => {
        const label = FORMAT_LABELS[ext] || ext.replace('.', '').toUpperCase()
        const color = FORMAT_COLORS[ext] || '#999'
        return (
          <Tag color={color} style={{ margin: 0 }}>
            {label}
          </Tag>
        )
      }
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => formatSize(size)
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (path: string) => (
        <Text type="secondary" ellipsis={{ tooltip: shortPath(path) }} style={{ maxWidth: 300 }}>
          {shortPath(path)}
        </Text>
      )
    }
  ]

  return (
    <Card
      title={
        <Space>
          <FileOutlined />
          <span>音频文件</span>
          {files.length > 0 && <Tag>{files.length} 个文件</Tag>}
          {files.some((f) => f.selected) && (
            <Tag color="blue">{files.filter((f) => f.selected).length} 个已选</Tag>
          )}
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Spin spinning={scanning} tip="正在扫描手机音频文件...">
        {files.length === 0 && !scanning ? (
          <Empty description="请先连接设备并扫描" style={{ padding: '40px 0' }} />
        ) : (
          <Table
            dataSource={files}
            columns={columns}
            rowKey="path"
            size="small"
            pagination={{ pageSize: 20, showTotal: (total) => `共 ${total} 个文件` }}
            scroll={{ y: 350 }}
          />
        )}
      </Spin>
    </Card>
  )
}
