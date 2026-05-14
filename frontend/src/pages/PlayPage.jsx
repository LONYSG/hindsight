import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { getState, nextDay } from '../api/play'
import client from '../api/client'

const EVENT_META = {
  PRICE_SPIKE:  { label: '주가급변',  color: '#f59e0b' },
  VOLUME_SPIKE: { label: '거래량급증', color: '#818cf8' },
  FOMC:         { label: 'FOMC',      color: '#34d399' },
  CPI:          { label: 'CPI',       color: '#34d399' },
  EARNINGS:     { label: '실적발표',  color: '#60a5fa' },
}

const JUMP_TYPES = [
  { key: 'NEXT_DAY',      label: '다음날' },
  { key: 'WEEK',          label: '1주일' },
  { key: 'MONTH',         label: '1달' },
  { key: 'THREE_MONTHS',  label: '3달' },
]

const fmt = (n, digits = 2) =>
  '$' + Number(n ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

const pct = (r) => {
  const v = (Number(r ?? 0) * 100).toFixed(2)
  return `${v > 0 ? '+' : ''}${v}%`
}

const color = (v) => (Number(v) >= 0 ? '#ef4444' : '#3b82f6')  // 한국식: 상승=빨강, 하락=파랑

export default function PlayPage() {
  const { sessionId } = useParams()
  const location = useLocation()
  const [state, setState] = useState(location.state?.initialState || null)
  const [loading, setLoading] = useState(!location.state?.initialState)
  const [jumping, setJumping] = useState(false)

  // 주문창 상태
  const [tab, setTab] = useState('BUY')
  const [qty, setQty] = useState(1)
  const [trading, setTrading] = useState(false)
  const [tradeMsg, setTradeMsg] = useState('')

  useEffect(() => {
    if (!state) {
      getState(sessionId).then((r) => setState(r.data)).finally(() => setLoading(false))
    }
  }, [sessionId])

  // qty를 유효 범위로 클램프
  const clampQty = (v, max) => Math.min(Math.max(1, v), Math.max(1, max))

  const handleNext = async (jumpType) => {
    setJumping(true)
    setTradeMsg('')
    try {
      const r = await nextDay(sessionId, jumpType)
      setState(r.data)
      setQty(1)
    } finally {
      setJumping(false)
    }
  }

  const handleTrade = async () => {
    setTrading(true)
    setTradeMsg('')
    try {
      const r = await client.post(`/play/sessions/${sessionId}/trade`, {
        action: tab,
        quantity: qty,
      })
      setState(r.data)
      setQty(1)
      setTradeMsg(tab === 'BUY' ? `${qty}주 매수 완료` : `${qty}주 매도 완료`)
    } catch (e) {
      setTradeMsg(e.response?.data?.message || '주문 오류')
    } finally {
      setTrading(false)
    }
  }

  if (loading) return <div style={s.center}>불러오는 중...</div>
  if (!state)  return <div style={s.center}>데이터 없음</div>

  const { simDate, price, portfolio, events } = state
  const closePrice = Number(price.close)
  const maxBuy  = Math.floor(Number(portfolio.cash) / closePrice)
  const maxSell = portfolio.stockQuantity
  const maxQty  = tab === 'BUY' ? maxBuy : maxSell
  const orderAmt = Math.floor(closePrice * qty)
  const up = Number(price.changeRate) >= 0

  return (
    <div style={s.root}>

      {/* ── 날짜 & 이벤트 ── */}
      <div style={s.topBar}>
        <div>
          <span style={s.dateLabel}>시뮬레이션 날짜</span>
          <span style={s.date}>{simDate}</span>
        </div>
        <div style={s.badges}>
          {events.map((e, i) => {
            const m = EVENT_META[e.eventType] || { label: e.eventType, color: '#888' }
            return (
              <span key={i} style={{ ...s.badge, background: m.color + '22', color: m.color, border: `1px solid ${m.color}55` }}>
                🔔 {m.label}
              </span>
            )
          })}
        </div>
      </div>

      <div style={s.body}>

        {/* ── 왼쪽: 주가 + 포트폴리오 ── */}
        <div style={s.left}>

          {/* 현재가 박스 */}
          <div style={s.card}>
            <div style={s.ticker}>NVDA <span style={s.exchange}>NASDAQ</span></div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
              <span style={{ ...s.closePrice, color: color(price.changeRate) }}>${fmt(price.close, 2)}</span>
              <span style={{ color: color(price.changeRate), fontSize: 15, fontWeight: 600 }}>
                {up ? '▲' : '▼'} {Math.abs(Number(price.changeRate) * 100).toFixed(2)}%
              </span>
            </div>
            <div style={s.ohlv}>
              <span>시가 <b>${fmt(price.open, 2)}</b></span>
              <span>고가 <b style={{ color: '#ef4444' }}>${fmt(price.high, 2)}</b></span>
              <span>저가 <b style={{ color: '#3b82f6' }}>${fmt(price.low, 2)}</b></span>
              <span>거래량 <b>{fmt(price.volume)}</b></span>
            </div>
          </div>

          {/* 포트폴리오 현황 */}
          <div style={s.card}>
            <div style={s.sectionTitle}>내 투자 현황</div>
            <div style={s.portfolioGrid}>
              <PortItem label="총평가금액"   value={fmt(portfolio.totalValue)} big />
              <PortItem label="예수금"       value={fmt(portfolio.cash)} />
              <PortItem label="주식평가금액" value={fmt(portfolio.stockValue)} />
              <PortItem label="매입금액"     value={fmt(portfolio.bookValue)} />
              <PortItem
                label="평가손익"
                value={`${Number(portfolio.unrealizedPnl) >= 0 ? '+' : ''}${fmt(portfolio.unrealizedPnl)}`}
                valueColor={color(portfolio.unrealizedPnl)}
              />
              <PortItem
                label="수익률"
                value={pct(portfolio.returnRate)}
                valueColor={color(portfolio.returnRate)}
              />
            </div>
            {portfolio.stockQuantity > 0 && (
              <div style={s.holdingRow}>
                <span style={s.holdingLabel}>보유</span>
                <span style={s.holdingValue}>{portfolio.stockQuantity}주</span>
                <span style={s.holdingLabel}>평균단가</span>
                <span style={s.holdingValue}>${fmt(portfolio.avgBuyPrice, 2)}</span>
              </div>
            )}
          </div>

          {/* 날짜 이동 */}
          <div style={s.card}>
            <div style={s.sectionTitle}>날짜 이동</div>
            <div style={s.jumpRow}>
              {JUMP_TYPES.map(({ key, label }) => (
                <button key={key} style={s.jumpBtn} onClick={() => handleNext(key)} disabled={jumping}>
                  {jumping ? '...' : label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 오른쪽: 주문창 ── */}
        <div style={s.right}>
          <div style={s.orderPanel}>
            <div style={s.sectionTitle}>주문</div>

            {/* 매수/매도 탭 */}
            <div style={s.tabRow}>
              <button
                style={tab === 'BUY' ? { ...s.tabBtn, ...s.tabBuy } : { ...s.tabBtn, ...s.tabInactive }}
                onClick={() => { setTab('BUY'); setQty(1); setTradeMsg('') }}
              >매수</button>
              <button
                style={tab === 'SELL' ? { ...s.tabBtn, ...s.tabSell } : { ...s.tabBtn, ...s.tabInactive }}
                onClick={() => { setTab('SELL'); setQty(1); setTradeMsg('') }}
              >매도</button>
            </div>

            {/* 현재가 표시 */}
            <div style={s.orderRow}>
              <span style={s.orderLabel}>현재가</span>
              <span style={{ ...s.orderValue, color: color(price.changeRate), fontWeight: 700 }}>
                ${fmt(price.close, 2)}
              </span>
            </div>

            <div style={s.divider} />

            {/* 가능 수량 */}
            <div style={s.orderRow}>
              <span style={s.orderLabel}>{tab === 'BUY' ? '매수가능' : '매도가능'}</span>
              <span style={s.orderValue}><b>{tab === 'BUY' ? maxBuy : maxSell}</b>주</span>
            </div>

            {/* 수량 입력 */}
            <div style={s.orderRow}>
              <span style={s.orderLabel}>수량</span>
              <div style={s.qtyRow}>
                <button style={s.qtyBtn} onClick={() => setQty((q) => clampQty(q - 1, maxQty))}>−</button>
                <input
                  style={s.qtyInput}
                  type="number"
                  min={1}
                  max={maxQty}
                  value={qty}
                  onChange={(e) => setQty(clampQty(Number(e.target.value), maxQty))}
                />
                <button style={s.qtyBtn} onClick={() => setQty((q) => clampQty(q + 1, maxQty))}>+</button>
              </div>
            </div>

            {/* 빠른 선택 */}
            <div style={s.quickRow}>
              {[10, 25, 50, 100].map((p) => (
                <button
                  key={p}
                  style={s.quickBtn}
                  onClick={() => setQty(clampQty(Math.floor(maxQty * p / 100), maxQty))}
                >
                  {p}%
                </button>
              ))}
            </div>

            <div style={s.divider} />

            {/* 주문금액 */}
            <div style={s.orderRow}>
              <span style={s.orderLabel}>주문금액</span>
              <span style={{ ...s.orderValue, fontWeight: 700, fontSize: 17 }}>{fmt(orderAmt)}</span>
            </div>
            {tab === 'BUY' && (
              <div style={s.orderRow}>
                <span style={s.orderLabel}>주문 후 예수금</span>
                <span style={s.orderValue}>{fmt(Math.max(0, Number(portfolio.cash) - orderAmt))}</span>
              </div>
            )}

            {/* 주문 버튼 */}
            <button
              style={tab === 'BUY' ? s.orderBtnBuy : s.orderBtnSell}
              onClick={handleTrade}
              disabled={trading || qty < 1 || qty > maxQty}
            >
              {trading ? '처리 중...' : tab === 'BUY' ? `${qty}주 매수` : `${qty}주 매도`}
            </button>

            {tradeMsg && (
              <div style={{ ...s.tradeMsg, color: tradeMsg.includes('완료') ? '#4ade80' : '#f87171' }}>
                {tradeMsg}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

function PortItem({ label, value, valueColor, big }) {
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid #222' }}>
      <div style={{ color: '#666', fontSize: 11, marginBottom: 3 }}>{label}</div>
      <div style={{ color: valueColor || '#fff', fontSize: big ? 18 : 14, fontWeight: big ? 700 : 500 }}>
        {value}
      </div>
    </div>
  )
}

const s = {
  root:       { minHeight: '100vh', background: '#0a0a0a', padding: '16px 20px', fontFamily: 'monospace, sans-serif' },
  center:     { color: '#888', textAlign: 'center', marginTop: 100, fontSize: 16 },
  topBar:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dateLabel:  { color: '#555', fontSize: 11, marginRight: 8 },
  date:       { color: '#fff', fontSize: 18, fontWeight: 700 },
  badges:     { display: 'flex', gap: 8 },
  badge:      { borderRadius: 4, padding: '3px 8px', fontSize: 12, fontWeight: 600 },
  body:       { display: 'flex', gap: 16, alignItems: 'flex-start' },
  left:       { flex: 1, display: 'flex', flexDirection: 'column', gap: 12 },
  right:      { width: 280, flexShrink: 0 },
  card:       { background: '#111', border: '1px solid #222', borderRadius: 8, padding: '14px 16px' },
  sectionTitle: { color: '#555', fontSize: 11, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  ticker:     { color: '#aaa', fontSize: 13, marginBottom: 6 },
  exchange:   { color: '#555', fontSize: 11, marginLeft: 4 },
  closePrice: { fontSize: 32, fontWeight: 700 },
  ohlv:       { display: 'flex', gap: 16, flexWrap: 'wrap', color: '#555', fontSize: 12, marginTop: 8 },
  portfolioGrid: { display: 'flex', flexDirection: 'column' },
  holdingRow: { display: 'flex', gap: 12, alignItems: 'center', marginTop: 10, padding: '8px 0', borderTop: '1px solid #222' },
  holdingLabel: { color: '#555', fontSize: 12 },
  holdingValue: { color: '#aaa', fontSize: 13, fontWeight: 600 },
  jumpRow:    { display: 'flex', gap: 8 },
  jumpBtn:    { flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, padding: '10px 0', color: '#ccc', fontSize: 13, cursor: 'pointer' },
  orderPanel: { background: '#111', border: '1px solid #222', borderRadius: 8, padding: '14px 16px', position: 'sticky', top: 16 },
  tabRow:     { display: 'flex', marginBottom: 14, borderRadius: 6, overflow: 'hidden', border: '1px solid #222' },
  tabBtn:     { flex: 1, border: 'none', padding: '9px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  tabBuy:     { background: '#ef4444', color: '#fff' },
  tabSell:    { background: '#3b82f6', color: '#fff' },
  tabInactive:{ background: '#1a1a1a', color: '#555' },
  orderRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderLabel: { color: '#555', fontSize: 12 },
  orderValue: { color: '#ccc', fontSize: 14 },
  divider:    { borderTop: '1px solid #1e1e1e', margin: '10px 0' },
  qtyRow:     { display: 'flex', alignItems: 'center', gap: 6 },
  qtyBtn:     { width: 28, height: 28, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ccc', fontSize: 16, cursor: 'pointer' },
  qtyInput:   { width: 64, background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, color: '#fff', fontSize: 15, textAlign: 'center', padding: '4px 6px' },
  quickRow:   { display: 'flex', gap: 6, marginBottom: 4 },
  quickBtn:   { flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4, padding: '5px 0', color: '#888', fontSize: 11, cursor: 'pointer' },
  orderBtnBuy:  { width: '100%', background: '#ef4444', border: 'none', borderRadius: 6, padding: '12px 0', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 14 },
  orderBtnSell: { width: '100%', background: '#3b82f6', border: 'none', borderRadius: 6, padding: '12px 0', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 14 },
  tradeMsg:   { textAlign: 'center', marginTop: 10, fontSize: 13 },
}
