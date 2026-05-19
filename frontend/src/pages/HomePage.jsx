import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessions, updateAlias, deleteSession } from '../api/play'
import { getMe, updateNickname } from '../api/auth'
import FullScreenLoader from '../components/FullScreenLoader'

export default function HomePage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [nickname, setNickname] = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [nicknameInput, setNicknameInput] = useState('')
  const [editingAlias, setEditingAlias] = useState(null) // sessionId
  const [aliasInput, setAliasInput] = useState('')

  useEffect(() => {
    Promise.all([getSessions(), getMe()])
      .then(([sessRes, meRes]) => {
        setSessions(sessRes.data)
        setNickname(meRes.data.nickname || '')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  const handleNicknameSave = async () => {
    if (!nicknameInput.trim()) return
    try {
      await updateNickname(nicknameInput.trim())
      setNickname(nicknameInput.trim())
      setEditingNickname(false)
    } catch (err) {
      alert(err.response?.data?.message || '오류가 발생했습니다.')
    }
  }

  const handleAliasSave = async (sessionId) => {
    if (!aliasInput.trim()) return
    try {
      await updateAlias(sessionId, aliasInput.trim())
      setSessions(prev => prev.map(s =>
        s.sessionId === sessionId ? { ...s, alias: aliasInput.trim() } : s
      ))
      setEditingAlias(null)
    } catch (err) {
      alert(err.response?.data?.message || '오류가 발생했습니다.')
    }
  }

  const handleDelete = async (sessionId, alias) => {
    if (!window.confirm(`"${alias}" 플레이 기록을 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return
    try {
      await deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId))
    } catch (err) {
      alert(err.response?.data?.message || '삭제에 실패했습니다.')
    }
  }

  const fmt = (v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'
  const returnColor = (v) => v > 0 ? '#16a34a' : v < 0 ? '#ef4444' : '#6b7280'

  if (loading) return <FullScreenLoader />

  return (
    <div style={s.container} className="page-enter">
      {/* 헤더 */}
      <div style={s.header}>
        <span style={s.logo}>Hindsight</span>
        <button style={s.logoutBtn} onClick={handleLogout} title="로그아웃">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 3h3a1 1 0 011 1v12a1 1 0 01-1 1h-3M8.5 13.5L13 10M13 10L8.5 6.5M13 10H3" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div style={s.inner}>
        {/* 닉네임 인라인 편집 */}
        <div style={s.nicknameRow}>
          {editingNickname ? (
            <div style={s.nicknameEdit}>
              <input
                style={s.nicknameInput}
                value={nicknameInput}
                onChange={e => setNicknameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleNicknameSave(); if (e.key === 'Escape') setEditingNickname(false) }}
                maxLength={20}
                autoFocus
                placeholder="닉네임 입력"
              />
              <button style={s.saveBtn} onClick={handleNicknameSave}>저장</button>
              <button style={s.cancelBtn} onClick={() => setEditingNickname(false)}>취소</button>
            </div>
          ) : (
            <div style={s.nicknameDisplay}>
              <span style={s.nicknameText}>{nickname || '닉네임 없음'}</span>
              <span style={s.nicknameLabel}> 님의 시나리오</span>
              <button style={s.editIconBtn} onClick={() => { setNicknameInput(nickname); setEditingNickname(true) }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9.5 2L12 4.5L4.5 12H2V9.5L9.5 2Z" stroke="#9ca3af" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        <button style={s.newBtn} onClick={() => navigate('/setup')}>
          + 새 시뮬레이션 시작
        </button>

        {sessions.length === 0 && (
          <p style={s.empty}>아직 플레이 기록이 없습니다.</p>
        )}

        {sessions.map(session => {
          const rColor = returnColor(session.returnRate)
          const isPositive = session.returnRate > 0
          const inProgress = session.status === 'IN_PROGRESS'
          const accentColor = session.returnRate > 0 ? '#16a34a' : session.returnRate < 0 ? '#ef4444' : '#e5e7eb'
          return (
            <div key={session.sessionId} style={{ ...s.card, borderLeft: `3px solid ${accentColor}` }}>
              {/* Row 1: 별칭 + 수익률 */}
              <div style={s.cardRow1}>
                {editingAlias === session.sessionId ? (
                  <div style={s.aliasEdit}>
                    <input style={s.aliasInput} value={aliasInput}
                      onChange={e => setAliasInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAliasSave(session.sessionId); if (e.key === 'Escape') setEditingAlias(null) }}
                      maxLength={30} autoFocus />
                    <button style={s.saveBtn} onClick={() => handleAliasSave(session.sessionId)}>저장</button>
                    <button style={s.cancelBtn} onClick={() => setEditingAlias(null)}>취소</button>
                  </div>
                ) : (
                  <div style={s.aliasRow}>
                    <span style={s.aliasName}>{session.alias}</span>
                    <button style={s.editIconBtn} onClick={() => { setAliasInput(session.alias); setEditingAlias(session.sessionId) }}>
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path d="M9.5 2L12 4.5L4.5 12H2V9.5L9.5 2Z" stroke="#d1d5db" strokeWidth="1.3" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                )}
                <div style={{ ...s.returnBig, color: rColor }}>
                  {fmt(session.returnRate)}
                </div>
              </div>

              {/* Row 2: 시나리오 배지 + 상태 */}
              <div style={s.cardRow2}>
                <span style={s.scenarioBadge}>{session.startPointName}</span>
                <span style={{ ...s.statusBadge, background: inProgress ? '#f0fdf4' : '#f3f4f6', color: inProgress ? '#16a34a' : '#9ca3af' }}>
                  {inProgress ? '진행 중' : '완료'}
                </span>
              </div>

              {/* Row 3: 메타 */}
              <div style={s.cardMeta}>
                ${session.seedMoney.toLocaleString()} · {session.simDate} 기준
              </div>

              {/* Row 4: 액션 */}
              <div style={s.cardActions}>
                <button style={s.deleteBtn} onClick={() => handleDelete(session.sessionId, session.alias)}>삭제</button>
                <button
                  style={{ ...s.actionBtn, background: inProgress ? '#16a34a' : '#f3f4f6', color: inProgress ? '#fff' : '#374151' }}
                  onClick={() => inProgress
                    ? navigate(`/play/${session.sessionId}`, { state: { startDate: session.startDate } })
                    : navigate(`/result/${session.sessionId}`)
                  }>
                  {inProgress ? '이어하기 →' : '결과 보기 →'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const s = {
  container:      { minHeight: '100vh', background: '#f5f6f8' },
  header:         { position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', height: 52, background: '#fff', borderBottom: '1px solid #f0f0f0', flexShrink: 0 },
  logo:           { paddingLeft: 8, color: '#111827', fontWeight: 700, fontSize: 17, letterSpacing: '-0.5px' },
  logoutBtn:      { width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, flexShrink: 0 },
  inner:          { maxWidth: 480, margin: '0 auto', padding: '20px 16px' },

  nicknameRow:    { marginBottom: 20 },
  nicknameDisplay:{ display: 'flex', alignItems: 'center', gap: 4 },
  nicknameText:   { color: '#111827', fontWeight: 700, fontSize: 17 },
  nicknameLabel:  { color: '#6b7280', fontSize: 15 },
  editIconBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: 6 },
  nicknameEdit:   { display: 'flex', gap: 6, alignItems: 'center' },
  nicknameInput:  { flex: 1, background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 15, fontWeight: 600, color: '#111827', outline: 'none' },

  aliasRow:       { display: 'flex', alignItems: 'center', gap: 4, flex: 1 },
  aliasName:      { color: '#111827', fontWeight: 600, fontSize: 14 },
  aliasEdit:      { display: 'flex', gap: 6, alignItems: 'center', flex: 1 },
  aliasInput:     { flex: 1, background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: '#111827', outline: 'none' },

  saveBtn:        { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  cancelBtn:      { background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#6b7280', cursor: 'pointer' },

  newBtn:         { width: '100%', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 20 },
  empty:          { color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '32px 0' },

  card:           { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 16px 14px', marginBottom: 10, overflow: 'hidden' },
  cardRow1:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  aliasRow:       { display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  aliasName:      { color: '#111827', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  returnBig:      { fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', flexShrink: 0, marginLeft: 8 },
  cardRow2:       { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 },
  scenarioBadge:  { background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 20 },
  statusBadge:    { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 },
  cardMeta:       { color: '#9ca3af', fontSize: 12, marginBottom: 12 },
  cardActions:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #f3f4f6' },
  deleteBtn:      { background: 'none', border: 'none', color: '#d1d5db', fontSize: 12, cursor: 'pointer', padding: '4px 0' },
  actionBtn:      { border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}
