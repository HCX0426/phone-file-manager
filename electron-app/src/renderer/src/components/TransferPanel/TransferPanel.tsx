import { Card, Progress, Space, Tag, Typography } from 'antd'
import { ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons'

const { Text } = Typography

interface TransferPanelProps {
  converting: boolean
  progress: { total: number; completed: number; current: string }
}

export default function TransferPanel({ converting, progress }: TransferPanelProps) {
  if (!converting && progress.total === 0) return null

  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0
  const isComplete = progress.completed >= progress.total && progress.total > 0

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined />
          <span>转换进度</span>
        </Space>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <Space>
          {isComplete ? (
            <Tag icon={<CheckCircleOutlined />} color="success">
              全部完成
            </Tag>
          ) : (
            <Tag color="processing">转换中</Tag>
          )}
          <Text type="secondary">
            {progress.completed} / {progress.total}
          </Text>
        </Space>
      </div>

      <Progress
        percent={percent}
        status={isComplete ? 'success' : 'active'}
        strokeColor={{ from: '#1677ff', to: '#52c41a' }}
      />

      {progress.current && !isComplete && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" ellipsis={{ tooltip: progress.current }}>
            当前: {progress.current}
          </Text>
        </div>
      )}
    </Card>
  )
}
