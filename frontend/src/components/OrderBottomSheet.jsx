import { useState, useEffect } from 'react'
import client from '../api/client'

const fmt = (n, d = 2) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const upColor = '#f43f5e'
const dnColor = '#3b82f6'

export default function OrderBottomSheet({ company, price, portfolio, holdings, sessionId, onTraded, onClose, initialTab = 'BUY' }) {
  const [tab, setTab]       = useState(initialTab)
  const [qty, setQty]       = useState(1)
  const [pct, setPct]       = useState(null)
  const [trading, setTrading] = useState(false)
  const [msg, setMsg]       = useState('')

  useEffect(() => { setTab(initialTab); setQty(1); setPct(null); setMsg('') }, [initialTab, company])

  const closePrice = Number(price?.close ?? 0)
  const cash       = Number(portfolio?.cash ?? 0)
  const holding    = holdings?.find(h => h.companyId === company?.id)
  const heldQty    = holding?.quantity ?? 0

  const maxBuy  = closePrice > 0 ? Math.floor(cash / closePrice) : 0
  const maxSell = heldQty
  const maxQty  = tab === 'BUY' ? maxBuy : maxSell

  const clamp = (v) => Math.min(Math.max(1, v), Math.max(1, maxQty))

  const applyPct = (p) => {
    setPct(p)
    const q = Math.floor(maxQty * p / 100)
    setQty(Math.max(1, q))
  }
  const changeQty = (v) => {
    setPct(null)
    setQty(clamp(v))
  }

  const orderAmt  = closePrice * qty
  const afterCash = tab === 'BUY' ? cash - orderAmt : cash + orderAmt
  const canTrade  = qty >= 1 && qty <= maxQty && !trading

  const handleTrade = async () => {
    setTrading(true)
    setMsg('')
    try {
      const r = await client.post(`/play/sessions/${sessionId}/trade`, {
        companyId: company.id, action: tab, quantity: qty,
      })
      onTraded(r.data)
      setMsg(`✓ ${company.ticker} ${qty}주 ${tab === 'BUY' ? '매수' : '매도'} 완료`)
      setTimeout(onClose, 1200)
    } catch (e) {
      setMsg(e.response?.data?.message || '주문 오류')
    } finally {
      setTrading(false)
    }
  }

  if (!company || !price) return null

  return (
    <>
      {/* 딤 배경 */}
      <div style={s.overlay} onClick={onClose} />

      {/* 바텀시트 */}
      <div style={s.sheet}>
        {/* 핸들 + 닫기 */}
        <div style={s.handle} />
        <button style={s.closeBtn} onClick={onClose}>✕</button>

        {/* 종목 정보 */}
        <div style={s.companyRow}>
          <span style={s.ticker}>{company.ticker}</span>
          <span style={s.companyName}>{company.name}</span>
          <span style={{ color: Number(price.close) >= Number(price.open) ? upColor : dnColor, fontSize: 18, fontWeight: 700, marginLeft: 'auto' }}>
            {fmt(price.close)}
          </span>
        </div>

        {/* 매수/매도 탭 */}
        <div style={s.tabRow}>
          <button style={{ ...s.tabBtn, ...(tab === 'BUY'  ? { background: upColor, color: '#fff' } : s.tabOff) }}
            onClick={() => { setTab('BUY');  setPct(0); setMsg('') }}>매수</button>
          <button style={{ ...s.tabBtn, ...(tab === 'SELL' ? { background: dnColor, color: '#fff' } : s.tabOff) }}
            onClick={() => { setTab('SELL'); setPct(0); setMsg('') }}>매도</button>
        </div>

        {/* 가용 수량 */}
        <div style={s.availRow}>
          <span style={s.availLabel}>{tab === 'BUY' ? '매수 가능' : '매도 가능'}</span>
          <span style={s.availValue}>{tab === 'BUY' ? maxBuy : maxSell}주</span>
        </div>

        {/* 잔액/보유 부족 경고 — 체결 직후엔 억제 */}
        {!msg && tab === 'BUY' && maxBuy === 0 && (
          <div style={s.warnBox}>💰 1주 매수 금액이 부족합니다</div>
        )}
        {!msg && tab === 'SELL' && maxSell === 0 && (
          <div style={s.warnBox}>📭 보유 중인 주식이 없습니다</div>
        )}

        {/* 수량 입력 + 비중 선택 (가능할 때만) */}
        {maxQty > 0 && (
          <>
            <div style={s.qtyRow}>
              <button style={s.qtyBtn} onMouseDown={e => e.preventDefault()} onClick={() => changeQty(qty - 1)}>−</button>
              <input
                style={s.qtyInput}
                type="number" min={1} max={maxQty} value={qty}
                onChange={(e) => changeQty(Number(e.target.value))}
              />
              <button style={s.qtyBtn} onMouseDown={e => e.preventDefault()} onClick={() => changeQty(qty + 1)}>+</button>
            </div>
            <div style={s.pctRow}>
              {[10, 25, 50, 100].map(p => (
                <button key={p}
                  style={{ ...s.pctBtn, borderColor: pct === p ? (tab === 'BUY' ? upColor : dnColor) : '#e5e7eb', color: pct === p ? (tab === 'BUY' ? upColor : dnColor) : '#9ca3af' }}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => applyPct(p)}>
                  {p}%
                </button>
              ))}
            </div>
          </>
        )}

        {/* 주문 정보 */}
        {maxQty > 0 && (
          <div style={s.orderInfo}>
            <Row label="주문금액"    value={fmt(orderAmt)} bold />
            <Row label="주문 후 예수금"
              value={afterCash < 0 ? '잔액 부족' : fmt(afterCash)}
              dim={afterCash >= 0}
              warn={afterCash < 0}
            />
          </div>
        )}

        {/* 주문 버튼 */}
        <button
          style={{ ...s.orderBtn, background: tab === 'BUY' ? upColor : dnColor, opacity: canTrade ? 1 : 0.4 }}
          onClick={handleTrade}
          disabled={!canTrade}>
          {trading ? '처리 중...' : `${company.ticker} ${qty}주 ${tab === 'BUY' ? '매수' : '매도'}`}
        </button>

        {msg && (
          <div style={{ textAlign: 'center', fontSize: 13, marginTop: 8, color: msg.startsWith('✓') ? '#4ade80' : '#f87171' }}>
            {msg}
          </div>
        )}
      </div>
    </>
  )
}

function Row({ label, value, bold, dim, warn }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ color: '#6b7280', fontSize: 13 }}>{label}</span>
      <span style={{ color: warn ? '#3b82f6' : dim ? '#6b7280' : bold ? '#111827' : '#6b7280', fontSize: 13, fontWeight: bold || warn ? 700 : 500 }}>{value}</span>
    </div>
  )
}

const s = {
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100 },
  sheet:       { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderRadius: '16px 16px 0 0', padding: '12px 20px 32px', zIndex: 101 },
  handle:      { width: 36, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '0 auto 16px' },
  closeBtn:    { position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', color: '#6b7280', fontSize: 18, cursor: 'pointer' },
  companyRow:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
  ticker:      { color: '#111827', fontSize: 18, fontWeight: 700 },
  companyName: { color: '#6b7280', fontSize: 12 },
  tabRow:      { display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: 16 },
  tabBtn:      { flex: 1, border: 'none', padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  tabOff:      { background: '#f5f6f8', color: '#d1d5db' },
  availRow:    { display: 'flex', justifyContent: 'space-between', marginBottom: 12 },
  availLabel:  { color: '#6b7280', fontSize: 12 },
  availValue:  { color: '#9ca3af', fontSize: 12, fontWeight: 600 },
  qtyRow:      { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  qtyBtn:      { width: 38, height: 38, background: '#f5f6f8', border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', fontSize: 20, cursor: 'pointer', flexShrink: 0 },
  qtyInput:    { flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, color: '#111827', fontSize: 18, fontWeight: 700, textAlign: 'center', padding: '7px 0' },
  pctRow:      { display: 'flex', gap: 8, marginBottom: 16 },
  pctBtn:      { flex: 1, background: '#f5f6f8', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', borderRadius: 8, padding: '8px 0', color: '#6b7280', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  orderInfo:   { marginBottom: 16 },
  orderBtn:    { width: '100%', border: 'none', borderRadius: 10, padding: '14px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  warnBox:     { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#3b82f6', fontWeight: 600, textAlign: 'center', marginBottom: 12 },
}
