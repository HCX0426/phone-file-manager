import { Layout, Typography, Space } from 'antd'
import { MobileOutlined } from '@ant-design/icons'

const { Header: AntHeader } = Layout
const { Title } = Typography

export default function Header() {
  return (
    <AntHeader
      style={{
        background: '#1677ff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      <Space>
        <MobileOutlined style={{ fontSize: 24, color: '#fff' }} />
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          Phone File Manager
        </Title>
      </Space>
    </AntHeader>
  )
}
