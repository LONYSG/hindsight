import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { getState, nextDay, endSession } from '../api/play'
import { useIsMobile } from '../hooks/useIsMobile'
import PriceTab     from '../tabs/PriceTab'
import OrderTab     from '../tabs/OrderTab'
import PortfolioTab from '../tabs/PortfolioTab'
import NewsTab      from '../tabs/NewsTab'

const EVENT_META = {
  PRICE_SPIKE:  { label: '주가급변',  color: '#f59e0b' },
  VOLUME_SPIKE: { label: '거래량급증', color: '#818cf8' },
  FOMC:         { label: 'FOMC',      color: '#34d399' },
  CPI:          { label: 'CPI',       color: '#34d399' },
  EARNINGS:     { label: '실적발표',  color: '#60a5fa' },
}

const TABS = [
  { key: 'price',     label: '시세' },
  { key: 'order',     label: '주문' },
  { key: 'portfolio', label: '잔고' },
  { key: 'news',      label: '뉴스' },
]

const JUMP_TYPES = [
  { key: 'NEXT_DAY',     label: '다음날' },
  { key: 'WEEK',         label: '1주일' },
  { key: 'MONTH',        label: '1달' },
  { key: 'THREE_MONTHS', label: '3달' },
]

// 고정 높이 상수
const HEADER_H  = 56
const TABBAR_H  = 44
const FOOTER_H  = 56

export default function PlayPage() {
  const { sessionId } = useParams()
  const location = useLocation()
  const isMobile = useIsMobile()

  const navigate = useNavigate()
  const [state, setState] = useState(location.state?.initialState || null)
  const [loading, setLoading] = useState(!location.state?.initialState)
  const [activeTab, setActiveTab] = useState('price')
  const [jumping, setJumping] = useState(false)
  const [ending, setEnding] = useState(false)

  const startDate = location.state?.startDate || '2020-02-01'

  useEffect(() => {
    if (!state) {
      getState(sessionId).then((r) => setState(r.data)).finally(() => setLoading(false))
    }
  }, [sessionId])

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
  const hasEvents = events.length > 0
  const contentH = `calc(100vh - ${HEADER_H + TABBAR_H + FOOTER_H}px)`

  return (
    <div style={s.root}>

      {/* ── 헤더: 날짜 + 이벤트 배지 ── */}
      <div style={{ ...s.header, height: HEADER_H }}>
        <div style={s.headerLeft}>
          <span style={s.dateLabel}>시뮬레이션 날짜</span>
          <span style={s.date}>{simDate}</span>
        </div>
        <div style={s.headerRight}>
          <div style={s.badges}>
            {events.map((e, i) => {
            const m = EVENT_META[e.eventType] || { label: e.eventType, color: '#888' }
            return (
              <span key={i} style={{ ...s.badge, background: m.color + '22', color: m.color, border: `1px solid ${m.color}44` }}>
                🔔 {m.label}
              </span>
            )
            })}
          </div>
          <button style={s.endBtn} onClick={handleEnd} disabled={ending}>
            {ending ? '...' : '종료'}
          </button>
        </div>
      </div>

      {/* ── 탭바 ── */}
      <div style={{ ...s.tabBar, height: TABBAR_H }}>
        {TABS.map(({ key, label }) => {
          const isNews    = key === 'news'
          const newsAlert = isNews  // 매일 뉴스 있음
          return (
            <button
              key={key}
              style={activeTab === key ? { ...s.tabBtn, ...s.tabActive } : s.tabBtn}
              onClick={() => setActiveTab(key)}
            >
              {label}
              {newsAlert && <span style={s.dot} />}
            </button>
          )
        })}
      </div>

      {/* ── 탭 컨텐츠 ── */}
      <div style={{ ...s.content, height: contentH, maxWidth: isMobile ? '100%' : 760, margin: '0 auto', width: '100%', overflow: activeTab === 'price' ? 'hidden' : 'auto' }}>
        {activeTab === 'price'     && <PriceTab     state={state} startDate={startDate} />}
        {activeTab === 'order'     && <OrderTab     state={state} sessionId={sessionId} onTraded={setState} />}
        {activeTab === 'portfolio' && <PortfolioTab state={state} />}
        {activeTab === 'news'      && <NewsTab      events={events} simDate={simDate} sessionId={sessionId} />}
      </div>

      {/* ── 하단 고정: 날짜 이동 ── */}
      <div style={{ ...s.footer, height: FOOTER_H }}>
        {JUMP_TYPES.map(({ key, label }) => (
          <button
            key={key}
            style={s.jumpBtn}
            onClick={() => handleNext(key)}
            disabled={jumping}
          >
            {jumping ? '·' : label}
          </button>
        ))}
      </div>

    </div>
  )
}

const s = {
  root:       { height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0f0f', overflow: 'hidden' },
  center:     { color: '#888', textAlign: 'center', marginTop: 100 },

  // 헤더
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
  dateLabel:  { color: '#555', fontSize: 10, letterSpacing: 0.5 },
  date:       { color: '#e8e8e8', fontSize: 17, fontWeight: 600 },
  headerRight:{ display: 'flex', alignItems: 'center', gap: 8 },
  badges:     { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  endBtn:     { background: 'none', border: '1px solid #333', borderRadius: 6, color: '#888', fontSize: 12, padding: '4px 10px', cursor: 'pointer' },
  badge:      { borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600 },

  // 탭바
  tabBar:     { display: 'flex', borderBottom: '1px solid #1e1e1e', flexShrink: 0 },
  tabBtn:     { flex: 1, background: 'none', border: 'none', color: '#555', fontSize: 13, fontWeight: 500, cursor: 'pointer', position: 'relative' },
  tabActive:  { color: '#e8e8e8', borderBottom: '2px solid #e8e8e8' },
  dot:        { position: 'absolute', top: 8, right: '28%', width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' },

  // 컨텐츠
  content:    { flex: 1, overflowY: 'auto', padding: '16px', minHeight: 0 },

  // 푸터
  footer:     { display: 'flex', borderTop: '1px solid #1e1e1e', flexShrink: 0 },
  jumpBtn:    { flex: 1, background: 'none', border: 'none', color: '#888', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRight: '1px solid #1e1e1e' },
}
