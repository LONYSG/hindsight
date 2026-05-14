import { useState } from 'react'
import client from '../api/client'

const fmt = (n, d = 2) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const priceColor = (v) => (Number(v) >= 0 ? '#ef4444' : '#3b82f6')

export default function OrderTab({ state, sessionId, onTraded }) {
  const { price, portfolio } = state
  const [tab, setTab] = useState('BUY')
  const [qty, setQty] = useState(1)
  const [trading, setTrading] = useState(false)
  const [msg, setMsg] = useState('')

  const closePrice = Number(price.close)
  const maxBuy  = Math.floor(Number(portfolio.cash) / closePrice)
  const maxSell = portfolio.stockQuantity
  const maxQty  = tab === 'BUY' ? maxBuy : maxSell
  const clamp   = (v) => Math.min(Math.max(1, v), Math.max(1, maxQty))
  const orderAmt = closePrice * qty

  const handleTrade = async () => {
    setTrading(true)
    setMsg('')
    try {
      const r = await client.post(`/play/sessions/${sessionId}/trade`, { action: tab, quantity: qty })
      onTraded(r.data)
      setQty(1)
      setMsg(tab === 'BUY' ? `✓ ${qty}주 매수 완료` : `✓ ${qty}주 매도 완료`)
    } catch (e) {
      setMsg(e.response?.data?.message || '주문 오류')
    } finally {
      setTrading(false)
    }
  }

  return (
    <div style={s.root}>
      {/* 매수/매도 탭 */}
      <div style={s.tabRow}>
        <button style={tab === 'BUY'  ? { ...s.tabBtn, ...s.tabBuy }  : { ...s.tabBtn, ...s.tabOff }} onClick={() => { setTab('BUY');  setQty(1); setMsg('') }}>매수</button>
        <button style={tab === 'SELL' ? { ...s.tabBtn, ...s.tabSell } : { ...s.tabBtn, ...s.tabOff }} onClick={() => { setTab('SELL'); setQty(1); setMsg('') }}>매도</button>
      </div>

      <div style={s.rows}>
        {/* 현재가 */}
        <Row label="현재가">
          <span style={{ color: priceColor(price.changeRate), fontWeight: 700 }}>{fmt(price.close)}</span>
        </Row>

        <div style={s.divider} />

        {/* 가능 수량 */}
        <Row label={tab === 'BUY' ? '매수가능' : '매도가능'}>
          <span><b style={{ color: '#fff' }}>{maxQty}</b><span style={{ color: '#555' }}> 주</span></span>
        </Row>

        {/* 수량 입력 */}
        <Row label="수량">
          <div style={s.qtyRow}>
            <button style={s.qtyBtn} onClick={() => setQty((q) => clamp(q - 1))}>−</button>
            <input
              style={s.qtyInput}
              type="number"
              min={1}
              max={maxQty}
              value={qty}
              onChange={(e) => setQty(clamp(Number(e.target.value)))}
            />
            <button style={s.qtyBtn} onClick={() => setQty((q) => clamp(q + 1))}>+</button>
          </div>
        </Row>

        {/* 비율 빠른 선택 */}
        <div style={s.quickRow}>
          {[10, 25, 50, 100].map((p) => (
            <button key={p} style={s.quickBtn} onClick={() => setQty(clamp(Math.floor(maxQty * p / 100)))}>
              {p}%
            </button>
          ))}
        </div>

        <div style={s.divider} />

        {/* 주문금액 */}
        <Row label="주문금액">
          <span style={{ fontWeight: 700, color: '#fff', fontSize: 16 }}>{fmt(orderAmt)}</span>
        </Row>
        {tab === 'BUY' && (
          <Row label="주문 후 예수금">
            <span style={{ color: '#888' }}>{fmt(Math.max(0, Number(portfolio.cash) - orderAmt))}</span>
          </Row>
        )}
      </div>

      {/* 주문 버튼 */}
      <button
        style={tab === 'BUY' ? s.orderBtnBuy : s.orderBtnSell}
        onClick={handleTrade}
        disabled={trading || qty < 1 || qty > maxQty || maxQty === 0}
      >
        {trading ? '처리 중...' : tab === 'BUY' ? `${qty}주 매수` : `${qty}주 매도`}
      </button>

      {msg && <div style={{ ...s.msg, color: msg.startsWith('✓') ? '#4ade80' : '#f87171' }}>{msg}</div>}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
      <span style={{ color: '#555', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#aaa', fontSize: 14 }}>{children}</span>
    </div>
  )
}

const s = {
  root:       { display: 'flex', flexDirection: 'column', height: '100%', gap: 0 },
  tabRow:     { display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #222', marginBottom: 20 },
  tabBtn:     { flex: 1, border: 'none', padding: '11px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  tabBuy:     { background: '#ef4444', color: '#fff' },
  tabSell:    { background: '#3b82f6', color: '#fff' },
  tabOff:     { background: '#161616', color: '#333' },
  rows:       { flex: 1 },
  divider:    { borderTop: '1px solid #1a1a1a', margin: '6px 0' },
  qtyRow:     { display: 'flex', alignItems: 'center', gap: 8 },
  qtyBtn:     { width: 32, height: 32, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#ccc', fontSize: 18, cursor: 'pointer' },
  qtyInput:   { width: 64, background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#fff', fontSize: 15, textAlign: 'center', padding: '5px 0' },
  quickRow:   { display: 'flex', gap: 6, padding: '8px 0' },
  quickBtn:   { flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 5, padding: '6px 0', color: '#555', fontSize: 12, cursor: 'pointer' },
  orderBtnBuy:  { width: '100%', background: '#ef4444', border: 'none', borderRadius: 8, padding: '14px', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 'auto' },
  orderBtnSell: { width: '100%', background: '#3b82f6', border: 'none', borderRadius: 8, padding: '14px', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 'auto' },
  msg:        { textAlign: 'center', marginTop: 10, fontSize: 13 },
}
