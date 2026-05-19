import { useNavigate } from 'react-router-dom'

export default function AppHeader({ title, onBack }) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) onBack()
    else navigate('/home')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div style={s.header}>
      {/* 좌측: 뒤로가기 */}
      <button style={s.iconBtn} onClick={handleBack}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M12.5 15L7.5 10L12.5 5" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* 중앙: 타이틀 (절대 중앙 고정) */}
      <span style={s.title}>{title}</span>

      {/* 우측: 로그아웃 */}
      <button style={s.iconBtn} onClick={handleLogout} title="로그아웃">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M13 3h3a1 1 0 011 1v12a1 1 0 01-1 1h-3M8.5 13.5L13 10M13 10L8.5 6.5M13 10H3" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}

const s = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    background: '#fff',
    borderBottom: '1px solid #f0f0f0',
    flexShrink: 0,
    padding: '0 4px',
  },
  title: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#111827',
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '-0.3px',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
  iconBtn: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 10,
    flexShrink: 0,
  },
}
