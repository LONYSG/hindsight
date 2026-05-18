const fmt = (n, d = 2) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (r) => { const v = (Number(r ?? 0) * 100).toFixed(2); return `${Number(v) >= 0 ? '+' : ''}${v}%` }
const pnlColor = (v) => Number(v) >= 0 ? '#f43f5e' : '#3b82f6'

export default function PortfolioTab({ state }) {
  const { portfolio, holdings = [] } = state

  return (
    <div style={s.root}>
      {/* 총평가금액 */}
      <div style={s.totalCard}>
        <div style={s.totalLabel}>총평가금액</div>
        <div style={s.totalValue}>{fmt(portfolio.totalValue)}</div>
        <div style={{ color: pnlColor(portfolio.returnRate), fontSize: 14, fontWeight: 500, marginTop: 4 }}>
          {pct(portfolio.returnRate)}
        </div>
      </div>

      {/* 자산 요약 */}
      <div style={s.section}>
        <Item label="예수금"       value={fmt(portfolio.cash)} />
        <Item label="주식평가금액" value={fmt(portfolio.totalStockValue)} last />
      </div>

      {/* 보유 종목 목록 */}
      {holdings.length > 0 ? (
        <div style={s.section}>
          <div style={s.sectionTitle}>보유 종목</div>
          {holdings.map((h) => (
            <HoldingCard key={h.companyId} h={h} />
          ))}
        </div>
      ) : (
        <div style={s.emptyHold}>보유 중인 주식 없음</div>
      )}
    </div>
  )
}

function HoldingCard({ h }) {
  const pnl = Number(h.unrealizedPnl)
  return (
    <div style={s.holdCard}>
      <div style={s.holdTop}>
        <span style={s.ticker}>{h.ticker}</span>
        <span style={{ color: pnlColor(pnl), fontWeight: 600, fontSize: 14 }}>
          {pnl >= 0 ? '+' : ''}{fmt(pnl)}
        </span>
      </div>
      <div style={s.holdGrid}>
        <HItem label="보유수량" value={`${h.quantity}주`} />
        <HItem label="평균단가" value={fmt(h.avgBuyPrice)} />
        <HItem label="현재가"   value={fmt(h.currentPrice)} />
        <HItem label="수익률"   value={pct(h.unrealizedRate)} color={pnlColor(h.unrealizedRate)} />
      </div>
    </div>
  )
}

function Item({ label, value, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: last ? 'none' : '1px solid #f3f4f6' }}>
      <span style={{ color: '#6b7280', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#111827', fontSize: 14, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function HItem({ label, value, color }) {
  return (
    <div>
      <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 3 }}>{label}</div>
      <div style={{ color: color || '#374151', fontSize: 13, fontWeight: 500 }}>{value}</div>
    </div>
  )
}

const s = {
  root:         { display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' },
  totalCard:    { background: '#fff', borderRadius: 12, padding: '20px 16px', textAlign: 'center' },
  totalLabel:   { color: '#9ca3af', fontSize: 12, marginBottom: 8 },
  totalValue:   { color: '#111827', fontSize: 30, fontWeight: 700, letterSpacing: '-0.5px' },
  section:      { background: '#fff', borderRadius: 12, overflow: 'hidden' },
  sectionTitle: { color: '#9ca3af', fontSize: 11, padding: '12px 14px 6px', textTransform: 'uppercase', letterSpacing: 0.5 },
  holdCard:     { padding: '12px 14px', borderBottom: '1px solid #f3f4f6' },
  holdTop:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  ticker:       { color: '#111827', fontWeight: 700, fontSize: 15 },
  holdGrid:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  emptyHold:    { color: '#9ca3af', textAlign: 'center', fontSize: 13, paddingTop: 8 },
}
