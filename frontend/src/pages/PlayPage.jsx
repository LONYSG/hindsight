import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { getState, nextDay } from '../api/play'

const JUMP_TYPES = [
  { key: 'NEXT_DAY', label: '다음날' },
  { key: 'WEEK', label: '1주일' },
  { key: 'MONTH', label: '1달' },
  { key: 'THREE_MONTHS', label: '3달' },
]

const EVENT_LABELS = {
  PRICE_SPIKE: { label: '주가 급변', color: '#f59e0b' },
  VOLUME_SPIKE: { label: '거래량 급증', color: '#818cf8' },
  FOMC: { label: 'FOMC', color: '#34d399' },
  CPI: { label: 'CPI', color: '#34d399' },
  EARNINGS: { label: '실적발표', color: '#60a5fa' },
}

export default function PlayPage() {
  const { sessionId } = useParams()
  const location = useLocation()
  const [state, setState] = useState(location.state?.initialState || null)
  const [loading, setLoading] = useState(!location.state?.initialState)
  const [jumping, setJumping] = useState(false)

  useEffect(() => {
    if (!state) {
      getState(sessionId).then((res) => setState(res.data)).finally(() => setLoading(false))
    }
  }, [sessionId])

  const handleNext = async (jumpType) => {
    setJumping(true)
    try {
      const res = await nextDay(sessionId, jumpType)
      setState(res.data)
    } finally {
      setJumping(false)
    }
  }

  if (loading) return <div style={styles.loading}>불러오는 중...</div>
  if (!state) return <div style={styles.loading}>데이터 없음</div>

  const { simDate, price, portfolio, events } = state
  const changePositive = price.changeRate >= 0

  return (
    <div style={styles.container}>
      <div style={styles.inner}>

        {/* 헤더 */}
        <div style={styles.header}>
          <div>
            <div style={styles.dateLabel}>현재 날짜</div>
            <div style={styles.date}>{simDate}</div>
          </div>
          <div style={styles.eventBadges}>
            {events.map((e, i) => {
              const meta = EVENT_LABELS[e.eventType] || { label: e.eventType, color: '#888' }
              return (
                <span key={i} style={{ ...styles.badge, background: meta.color + '22', color: meta.color, border: `1px solid ${meta.color}44` }}>
                  {meta.label}
                </span>
              )
            })}
          </div>
        </div>

        {/* 주가 카드 */}
        <div style={styles.priceCard}>
          <div style={styles.closePrice}>${price.close.toFixed(2)}</div>
          <div style={changePositive ? styles.changeUp : styles.changeDown}>
            {changePositive ? '▲' : '▼'} {Math.abs(price.changeRate * 100).toFixed(2)}%
          </div>
          <div style={styles.priceDetails}>
            <span>시가 ${price.open.toFixed(2)}</span>
            <span>고가 ${price.high.toFixed(2)}</span>
            <span>저가 ${price.low.toFixed(2)}</span>
            <span>거래량 {price.volume.toLocaleString()}</span>
          </div>
        </div>

        {/* 포트폴리오 카드 */}
        <div style={styles.portfolioCard}>
          <div style={styles.portfolioTitle}>내 포트폴리오</div>
          <div style={styles.portfolioGrid}>
            <div style={styles.portfolioItem}>
              <div style={styles.portfolioLabel}>총자산</div>
              <div style={styles.portfolioValue}>{portfolio.totalValue.toLocaleString()}원</div>
            </div>
            <div style={styles.portfolioItem}>
              <div style={styles.portfolioLabel}>현금</div>
              <div style={styles.portfolioValue}>{portfolio.cash.toLocaleString()}원</div>
            </div>
            <div style={styles.portfolioItem}>
              <div style={styles.portfolioLabel}>보유 주식</div>
              <div style={styles.portfolioValue}>{portfolio.stockQuantity}주</div>
            </div>
            <div style={styles.portfolioItem}>
              <div style={styles.portfolioLabel}>수익률</div>
              <div style={portfolio.returnRate >= 0 ? styles.returnUp : styles.returnDown}>
                {portfolio.returnRate >= 0 ? '+' : ''}{(portfolio.returnRate * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* 날짜 점프 버튼 */}
        <div style={styles.jumpRow}>
          {JUMP_TYPES.map(({ key, label }) => (
            <button
              key={key}
              style={styles.jumpBtn}
              onClick={() => handleNext(key)}
              disabled={jumping}
            >
              {jumping ? '...' : label}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#0f0f0f', padding: '32px 20px' },
  inner: { maxWidth: 640, margin: '0 auto' },
  loading: { color: '#888', textAlign: 'center', marginTop: 100, fontSize: 16 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  dateLabel: { color: '#666', fontSize: 12, marginBottom: 4 },
  date: { color: '#fff', fontSize: 22, fontWeight: 700 },
  eventBadges: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  badge: { borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 },
  priceCard: { background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: '24px', marginBottom: 16 },
  closePrice: { color: '#fff', fontSize: 36, fontWeight: 700, marginBottom: 4 },
  changeUp: { color: '#4ade80', fontSize: 18, fontWeight: 600, marginBottom: 12 },
  changeDown: { color: '#f87171', fontSize: 18, fontWeight: 600, marginBottom: 12 },
  priceDetails: { display: 'flex', gap: 16, flexWrap: 'wrap', color: '#666', fontSize: 13 },
  portfolioCard: { background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: '20px 24px', marginBottom: 24 },
  portfolioTitle: { color: '#aaa', fontSize: 13, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  portfolioGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  portfolioItem: {},
  portfolioLabel: { color: '#666', fontSize: 12, marginBottom: 4 },
  portfolioValue: { color: '#fff', fontSize: 18, fontWeight: 600 },
  returnUp: { color: '#4ade80', fontSize: 18, fontWeight: 600 },
  returnDown: { color: '#f87171', fontSize: 18, fontWeight: 600 },
  jumpRow: { display: 'flex', gap: 10 },
  jumpBtn: { flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '14px 0', color: '#fff', fontSize: 15, cursor: 'pointer' },
}
