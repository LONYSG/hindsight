import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessions } from '../api/play'

export default function HomePage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSessions()
      .then(r => setSessions(r.data))
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  const fmt = (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'
  const returnColor = (v) => v > 0 ? '#16a34a' : v < 0 ? '#ef4444' : '#6b7280'

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.logo}>Hindsight</span>
        <button style={s.logoutBtn} onClick={handleLogout} title="로그아웃">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 3h3a1 1 0 011 1v12a1 1 0 01-1 1h-3M8.5 13.5L13 10M13 10L8.5 6.5M13 10H3" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div style={s.inner}>
        <button style={s.newBtn} onClick={() => navigate('/setup')}>
          + 새 시뮬레이션 시작
        </button>

        <div style={s.sectionLabel}>내 플레이 기록</div>

        {loading && <p style={s.empty}>불러오는 중...</p>}
        {!loading && sessions.length === 0 && (
          <p style={s.empty}>아직 플레이 기록이 없습니다.</p>
        )}

        {sessions.map(s2 => (
          <div key={s2.sessionId} style={s.card}>
            <div style={s.cardTop}>
              <div>
                <div style={s.scenario}>{s2.startPointName}</div>
                <div style={s.meta}>${s2.seedMoney.toLocaleString()} · {s2.startDate} ~</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...s.returnRate, color: returnColor(s2.returnRate) }}>
                  {fmt(s2.returnRate)}
                </div>
                <div style={s.simDate}>{s2.simDate} 기준</div>
              </div>
            </div>
            <div style={s.cardBottom}>
              <span style={{ ...s.badge, background: s2.status === 'IN_PROGRESS' ? '#f0fdf4' : '#f3f4f6', color: s2.status === 'IN_PROGRESS' ? '#16a34a' : '#6b7280' }}>
                {s2.status === 'IN_PROGRESS' ? '진행 중' : '완료'}
              </span>
              {s2.status === 'IN_PROGRESS' ? (
                <button style={s.actionBtn} onClick={() => navigate(`/play/${s2.sessionId}`)}>
                  이어하기 →
                </button>
              ) : (
                <button style={s.actionBtn} onClick={() => navigate(`/result/${s2.sessionId}`)}>
                  결과 보기 →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  container: { minHeight: '100vh', background: '#f5f6f8' },
  header:    { position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', height: 52, background: '#fff', borderBottom: '1px solid #f0f0f0', flexShrink: 0 },
  logo:      { paddingLeft: 8, color: '#111827', fontWeight: 700, fontSize: 17, letterSpacing: '-0.5px' },
  logoutBtn: { width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, flexShrink: 0 },
  inner:     { maxWidth: 480, margin: '0 auto', padding: '20px 16px' },
  newBtn:    { width: '100%', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 24 },
  sectionLabel: { color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  empty:     { color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '32px 0' },
  card:      { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px', marginBottom: 10 },
  cardTop:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  scenario:  { color: '#111827', fontWeight: 600, fontSize: 14, marginBottom: 4 },
  meta:      { color: '#9ca3af', fontSize: 12 },
  returnRate:{ fontWeight: 700, fontSize: 16 },
  simDate:   { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  cardBottom:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  badge:     { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 },
  actionBtn: { background: 'none', border: 'none', color: '#16a34a', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}
