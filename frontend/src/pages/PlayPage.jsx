import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { getState, nextDay, endSession } from '../api/play'
import { useIsMobile } from '../hooks/useIsMobile'
import { getDisplayTicker } from '../utils/companyDisplay'
import PriceTab     from '../tabs/PriceTab'
import OrderTab     from '../tabs/OrderTab'
import PortfolioTab from '../tabs/PortfolioTab'
import NewsTab      from '../tabs/NewsTab'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const day = DAYS[new Date(y, m - 1, d).getDay()]
  return `${y}.${String(m).padStart(2,'0')}.${String(d).padStart(2,'0')} (${day})`
}

function formatEvent(e, simDate) {
  const t = e.companyTicker ? getDisplayTicker(e.companyTicker, simDate) : null
  switch (e.eventType) {
    case 'PRICE_SPIKE':  return { icon: '📈', text: t ? `${t} 주가급변` : '주가급변',    color: '#ef4444' }
    case 'VOLUME_SPIKE': return { icon: '📊', text: t ? `${t} 거래량급증` : '거래량급증', color: '#6366f1' }
    case 'FOMC':         return { icon: '🏦', text: 'FOMC 금리 결정',                    color: '#10b981' }
    case 'CPI':          return { icon: '📉', text: 'CPI 물가 발표',                     color: '#10b981' }
    case 'EARNINGS':     return { icon: '💰', text: e.summary || (t ? `${t} 실적발표` : '실적발표'), color: '#3b82f6' }
    default:             return { icon: '🔔', text: e.eventType,                          color: '#9ca3af' }
  }
}

const TABS = [
  { key: 'price',     label: '시세' },
  { key: 'portfolio', label: '잔고' },
  { key: 'news',      label: '뉴스' },
]

const JUMP_TYPES = [
  { key: 'NEXT_DAY',     label: '다음날' },
  { key: 'WEEK',         label: '1주일' },
  { key: 'MONTH',        label: '1달' },
  { key: 'THREE_MONTHS', label: '3달' },
]

const HEADER_H = 52
const TABBAR_H = 42
const FOOTER_H = 52

export default function PlayPage() {
  const { sessionId } = useParams()
  const location = useLocation()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const bellRef  = useRef(null)

  const [state, setState]         = useState(location.state?.initialState || null)
  const [loading, setLoading]     = useState(!location.state?.initialState)
  const [activeTab, setActiveTab] = useState('price')
  const [jumping, setJumping]     = useState(false)
  const [ending, setEnding]       = useState(false)
  const [bellOpen, setBellOpen]   = useState(false)

  const startDate = location.state?.startDate || '2020-02-01'

  useEffect(() => {
    if (!state) {
      getState(sessionId).then((r) => setState(r.data)).finally(() => setLoading(false))
    }
  }, [sessionId])

  useEffect(() => {
    if (!bellOpen) return
    const handler = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [bellOpen])

  const handleEnd = async () => {
    if (!window.confirm('게임을 종료하고 결과를 확인할까요?')) return
    setEnding(true)
    try {
      await endSession(sessionId)
      navigate(`/result/${sessionId}`)
    } finally {
      setEnding(false)
    }
  }

  const handleNext = async (jumpType) => {
    setJumping(true)
    try {
      const r = await nextDay(sessionId, jumpType)
      setState(r.data)
    } finally {
      setJumping(false)
    }
  }

  if (loading) return <div style={s.center}>불러오는 중...</div>
  if (!state)  return <div style={s.center}>데이터 없음</div>

  const { simDate, events } = state
  const contentH = `calc(100vh - ${HEADER_H + TABBAR_H + FOOTER_H}px)`

  return (
    <div style={s.root}>

      {/* 헤더 */}
      <div style={{ ...s.header, height: HEADER_H }}>
        {/* 좌측: 홈 */}
        <button style={s.iconBtn} onClick={() => navigate('/home')}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* 중앙: 날짜 (절대 중앙) */}
        <span style={s.date}>{formatDate(simDate)}</span>

        {/* 우측: 알림 + 종료 */}
        <div style={s.headerRight}>
          <div ref={bellRef} style={{ position: 'relative' }}>
            <button style={s.bellBtn} onClick={() => setBellOpen(v => !v)}>
              <span style={s.bellIcon}>🔔</span>
              {events.length > 0 && <span style={s.bellBadge}>{events.length}</span>}
            </button>
            {bellOpen && (
              <div style={s.notifPanel}>
                <div style={s.notifTitle}>오늘의 이벤트</div>
                {events.length === 0 ? (
                  <div style={s.notifEmpty}>이벤트 없음</div>
                ) : (
                  events.map((e, i) => {
                    const fmt = formatEvent(e, simDate)
                    return (
                      <div key={i} style={s.notifItem}>
                        <span style={s.notifIconEl}>{fmt.icon}</span>
                        <div style={{ ...s.notifText, color: fmt.color }}>{fmt.text}</div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
          <button style={s.endBtn} onClick={handleEnd} disabled={ending}>
            {ending ? '...' : '종료'}
          </button>
        </div>
      </div>

      {/* 탭바 */}
      <div style={{ ...s.tabBar, height: TABBAR_H }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            style={activeTab === key ? { ...s.tabBtn, ...s.tabActive } : s.tabBtn}
            onClick={() => setActiveTab(key)}
          >
            {label}
            {key === 'news' && <span style={s.dot} />}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div style={{
        ...s.content, height: contentH,
        maxWidth: isMobile ? '100%' : 760, margin: '0 auto', width: '100%',
        overflow: activeTab === 'price' ? 'hidden' : 'auto',
      }}>
        {activeTab === 'price'     && <PriceTab     state={state} startDate={startDate} sessionId={sessionId} onTraded={setState} />}
        {activeTab === 'portfolio' && <PortfolioTab state={state} />}
        {activeTab === 'news'      && <NewsTab      simDate={simDate} sessionId={sessionId} />}
      </div>

      {/* 하단: 날짜 이동 */}
      <div style={{ ...s.footer, height: FOOTER_H }}>
        {JUMP_TYPES.map(({ key, label }) => (
          <button key={key} style={s.jumpBtn} onClick={() => handleNext(key)} disabled={jumping}>
            {jumping ? '·' : label}
          </button>
        ))}
      </div>

    </div>
  )
}

const s = {
  root:       { height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f6f8', overflow: 'hidden' },
  center:     { color: '#9ca3af', textAlign: 'center', marginTop: 100 },

  header:     { position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', background: '#fff', borderBottom: '1px solid #f0f0f0', flexShrink: 0 },
  iconBtn:    { width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, flexShrink: 0 },
  date:       { position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: '#111827', fontSize: 14, fontWeight: 600, letterSpacing: '-0.2px', pointerEvents: 'none', whiteSpace: 'nowrap' },
  headerRight:{ display: 'flex', alignItems: 'center', gap: 8 },

  bellBtn:    { position: 'relative', background: 'none', border: 'none', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 },
  bellIcon:   { fontSize: 15, lineHeight: 1 },
  bellBadge:  { position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 17, height: 17, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },

  notifPanel:  { position: 'absolute', top: 42, right: 0, width: 210, background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,0.1)', zIndex: 200, overflow: 'hidden' },
  notifTitle:  { fontSize: 11, fontWeight: 700, color: '#9ca3af', padding: '10px 14px 8px', borderBottom: '1px solid #f3f4f6', letterSpacing: 0.3 },
  notifEmpty:  { fontSize: 13, color: '#9ca3af', padding: '12px 14px' },
  notifItem:   { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid #f9fafb' },
  notifIconEl: { fontSize: 16, flexShrink: 0 },
  notifText:   { fontSize: 13, fontWeight: 600, lineHeight: 1.3 },

  endBtn:     { background: 'none', border: '1px solid #e8eaed', borderRadius: 8, color: '#6b7280', fontSize: 12, fontWeight: 500, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },

  tabBar:     { display: 'flex', background: '#fff', borderBottom: '1px solid #e8eaed', flexShrink: 0 },
  tabBtn:     { flex: 1, background: 'none', border: 'none', borderBottom: '2px solid transparent', color: '#9ca3af', fontSize: 13, fontWeight: 500, cursor: 'pointer', position: 'relative' },
  tabActive:  { color: '#111827', borderBottom: '2px solid #111827', fontWeight: 700 },
  dot:        { position: 'absolute', top: 8, right: '28%', width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' },

  content:    { flex: 1, overflowY: 'auto', padding: '12px 16px', minHeight: 0 },

  footer:     { display: 'flex', background: '#fff', borderTop: '1px solid #e8eaed', flexShrink: 0 },
  jumpBtn:    { flex: 1, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRight: '1px solid #f3f4f6' },
}
