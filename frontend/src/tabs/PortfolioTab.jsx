const fmt = (n, d = 2) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (r) => { const v = (Number(r ?? 0) * 100).toFixed(2); return `${Number(v) >= 0 ? '+' : ''}${v}%` }
const pnlColor = (v) => (Number(v) >= 0 ? '#ef4444' : '#3b82f6')

export default function PortfolioTab({ state }) {
  const { portfolio, price } = state

  return (
    <div style={s.root}>
      {/* 총평가금액 */}
      <div style={s.totalCard}>
        <div style={s.totalLabel}>총평가금액</div>
        <div style={s.totalValue}>{fmt(portfolio.totalValue)}</div>
        <div style={{ ...s.totalReturn, color: pnlColor(portfolio.returnRate) }}>
          {pct(portfolio.returnRate)} ({Number(portfolio.returnRate) >= 0 ? '+' : ''}{fmt(portfolio.totalValue - portfolio.cash - (portfolio.bookValue - portfolio.stockValue))})
        </div>
      </div>

      {/* 상세 항목 */}
      <div style={s.section}>
        <Item label="예수금"       value={fmt(portfolio.cash)} />
        <Item label="주식평가금액" value={fmt(portfolio.stockValue)} />
        <Item label="매입금액"     value={fmt(portfolio.bookValue)} />
        <Item
          label="평가손익"
          value={`${Number(portfolio.unrealizedPnl) >= 0 ? '+' : ''}${fmt(portfolio.unrealizedPnl)}`}
          valueColor={pnlColor(portfolio.unrealizedPnl)}
        />
        <Item
          label="평가수익률"
          value={pct(portfolio.unrealizedRate)}
          valueColor={pnlColor(portfolio.unrealizedRate)}
        />
      </div>

      {/* 보유 주식 */}
      {portfolio.stockQuantity > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>보유 종목</div>
          <div style={s.holdCard}>
            <div style={s.holdTop}>
              <span style={s.ticker}>NVDA</span>
              <span style={{ ...s.holdPnl, color: pnlColor(portfolio.unrealizedPnl) }}>
                {Number(portfolio.unrealizedPnl) >= 0 ? '+' : ''}{fmt(portfolio.unrealizedPnl)}
              </span>
            </div>
            <div style={s.holdDetails}>
              <HoldItem label="보유수량"   value={`${portfolio.stockQuantity}주`} />
              <HoldItem label="평균단가"   value={fmt(portfolio.avgBuyPrice)} />
              <HoldItem label="현재가"     value={fmt(price.close)} />
              <HoldItem label="수익률"     value={pct(portfolio.unrealizedRate)} color={pnlColor(portfolio.unrealizedRate)} />
            </div>
          </div>
        </div>
      )}

      {portfolio.stockQuantity === 0 && (
        <div style={s.emptyHold}>보유 중인 주식이 없습니다</div>
      )}
    </div>
  )
}

function Item({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1a1a1a' }}>
      <span style={{ color: '#555', fontSize: 13 }}>{label}</span>
      <span style={{ color: valueColor || '#bbb', fontSize: 14, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function HoldItem({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ color: '#444', fontSize: 11 }}>{label}</span>
      <span style={{ color: color || '#bbb', fontSize: 13, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

const s = {
  root:         { display: 'flex', flexDirection: 'column', height: '100%', gap: 16, overflowY: 'auto' },
  totalCard:    { background: '#111', borderRadius: 10, padding: '20px 16px', textAlign: 'center' },
  totalLabel:   { color: '#444', fontSize: 12, marginBottom: 6 },
  totalValue:   { color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 4 },
  totalReturn:  { fontSize: 14, fontWeight: 600 },
  section:      { background: '#111', borderRadius: 10, padding: '4px 16px' },
  sectionTitle: { color: '#444', fontSize: 11, padding: '12px 0 4px', letterSpacing: 1, textTransform: 'uppercase' },
  holdCard:     { padding: '12px 0' },
  holdTop:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  ticker:       { color: '#fff', fontWeight: 700, fontSize: 16 },
  holdPnl:      { fontSize: 15, fontWeight: 600 },
  holdDetails:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 0' },
  emptyHold:    { color: '#333', textAlign: 'center', fontSize: 13, marginTop: 8 },
}
