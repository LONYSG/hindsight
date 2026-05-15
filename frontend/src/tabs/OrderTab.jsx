import { useState, useEffect } from 'react'
import { getCompanies, getPriceHistory } from '../api/data'
import client from '../api/client'

const fmt = (n, d = 2) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const upColor = '#f43f5e'
const dnColor = '#3b82f6'

export default function OrderTab({ state, sessionId, onTraded }) {
  const { portfolio, holdings, simDate } = state
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [currentPrice, setCurrentPrice] = useState(null)
  const [tab, setTab] = useState('BUY')
  const [qty, setQty] = useState(1)
  const [trading, setTrading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    getCompanies().then((r) => setCompanies(r.data))
  }, [])

  useEffect(() => {
    if (!selectedCompany || !simDate) return
    setCurrentPrice(null)
    setQty(1)
    setMsg('')
    getPriceHistory(selectedCompany.id, simDate, simDate)
      .then((r) => setCurrentPrice(r.data[0] ?? null))
      .catch(() => setCurrentPrice(null))
  }, [selectedCompany, simDate])

  const closePrice = currentPrice ? Number(currentPrice.close) : 0
  const holding    = holdings?.find(h => h.companyId === selectedCompany?.id)
  const heldQty    = holding?.quantity ?? 0
  const maxBuy     = closePrice > 0 ? Math.floor(Number(portfolio.cash) / closePrice) : 0
  const maxSell    = heldQty
  const maxQty     = tab === 'BUY' ? maxBuy : maxSell
  const clamp      = (v) => Math.min(Math.max(1, v), Math.max(1, maxQty))
  const orderAmt   = closePrice * qty

  const handleTrade = async () => {
    if (!selectedCompany || !closePrice) return
    setTrading(true)
    setMsg('')
    try {
      const r = await client.post(`/play/sessions/${sessionId}/trade`, {
        companyId: selectedCompany.id,
        action: tab,
        quantity: qty,
      })
      onTraded(r.data)
      setQty(1)
      setMsg(tab === 'BUY'
        ? `✓ ${selectedCompany.ticker} ${qty}주 매수 완료`
        : `✓ ${selectedCompany.ticker} ${qty}주 매도 완료`)
    } catch (e) {
      setMsg(e.response?.data?.message || '주문 오류')
    } finally {
      setTrading(false)
    }
  }

  return (
    <div style={s.root}>
      {/* 기업 선택 */}
      <div style={s.companyRow}>
        {companies.map((c) => {
          const h = holdings?.find(hh => hh.companyId === c.id)
          const isSelected = selectedCompany?.id === c.id
          return (
            <button
              key={c.id}
              style={{
                ...s.companyBtn,
                ...(isSelected ? s.companyBtnActive : {}),
                ...(h && !isSelected ? s.companyBtnHeld : {}),
              }}
              onClick={() => { setSelectedCompany(c); setTab('BUY'); setMsg('') }}
            >
              {c.ticker}
              {h && <span style={s.heldDot} />}
            </button>
          )
        })}
      </div>

      {!selectedCompany ? (
        <div style={s.placeholder}>기업을 선택해 주문하세요</div>
      ) : !currentPrice ? (
        <div style={s.placeholder}>주가 불러오는 중...</div>
      ) : (
        <>
          <div style={s.tabRow}>
            <button style={tab === 'BUY'  ? { ...s.tabBtn, background: upColor, color: '#fff' } : { ...s.tabBtn, ...s.tabOff }} onClick={() => { setTab('BUY');  setQty(1); setMsg('') }}>매수</button>
            <button style={tab === 'SELL' ? { ...s.tabBtn, background: dnColor, color: '#fff' } : { ...s.tabBtn, ...s.tabOff }} onClick={() => { setTab('SELL'); setQty(1); setMsg('') }}>매도</button>
          </div>

          <div style={s.rows}>
            <Row label="현재가">
              <span style={{ color: Number(currentPrice.close) >= Number(currentPrice.open) ? upColor : dnColor, fontWeight: 600 }}>
                {fmt(currentPrice.close)}
              </span>
            </Row>
            <div style={s.divider} />

            <Row label={tab === 'BUY' ? '매수가능' : '매도가능'}>
              <span><b style={{ color: '#e8e8e8' }}>{maxQty}</b><span style={{ color: '#555' }}> 주</span></span>
            </Row>

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

            <div style={s.quickRow}>
              {[10, 25, 50, 100].map((p) => (
                <button key={p} style={s.quickBtn} onClick={() => setQty(clamp(Math.floor(maxQty * p / 100)))}>
                  {p}%
                </button>
              ))}
            </div>

            <div style={s.divider} />
            <Row label="주문금액">
              <span style={{ fontWeight: 700, color: '#e8e8e8', fontSize: 16 }}>{fmt(orderAmt)}</span>
            </Row>
            {tab === 'BUY' && (
              <Row label="주문 후 예수금">
                <span style={{ color: '#888' }}>{fmt(Math.max(0, Number(portfolio.cash) - orderAmt))}</span>
              </Row>
            )}
          </div>

          <button
            style={{ ...(tab === 'BUY' ? s.orderBtnBuy : s.orderBtnSell), opacity: (trading || qty < 1 || qty > maxQty || maxQty === 0) ? 0.4 : 1 }}
            onClick={handleTrade}
            disabled={trading || qty < 1 || qty > maxQty || maxQty === 0}
          >
            {trading ? '처리 중...' : tab === 'BUY'
              ? `${selectedCompany.ticker} ${qty}주 매수`
              : `${selectedCompany.ticker} ${qty}주 매도`}
          </button>

          {msg && <div style={{ ...s.msg, color: msg.startsWith('✓') ? '#4ade80' : '#f87171' }}>{msg}</div>}
        </>
      )}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0' }}>
      <span style={{ color: '#666', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#aaa', fontSize: 14 }}>{children}</span>
    </div>
  )
}

const s = {
  root:            { display: 'flex', flexDirection: 'column', height: '100%' },
  companyRow:      { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  companyBtn:      { background: '#161616', border: '1px solid #252525', borderRadius: 8, padding: '6px 12px', color: '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer', position: 'relative' },
  companyBtnActive:{ borderColor: '#4ade80', color: '#4ade80' },
  companyBtnHeld:  { borderColor: '#f59e0b55', color: '#888' },
  heldDot:         { position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' },
  placeholder:     { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 13 },
  tabRow:          { display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #252525', marginBottom: 16 },
  tabBtn:          { flex: 1, border: 'none', padding: '11px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  tabOff:          { background: '#161616', color: '#333' },
  rows:            { flex: 1 },
  divider:         { borderTop: '1px solid #1e1e1e', margin: '4px 0' },
  qtyRow:          { display: 'flex', alignItems: 'center', gap: 8 },
  qtyBtn:          { width: 32, height: 32, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 6, color: '#ccc', fontSize: 18, cursor: 'pointer' },
  qtyInput:        { width: 64, background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 6, color: '#e8e8e8', fontSize: 15, textAlign: 'center', padding: '5px 0' },
  quickRow:        { display: 'flex', gap: 6, padding: '8px 0' },
  quickBtn:        { flex: 1, background: '#161616', border: '1px solid #222', borderRadius: 6, padding: '6px 0', color: '#666', fontSize: 12, cursor: 'pointer' },
  orderBtnBuy:     { width: '100%', background: '#f43f5e', border: 'none', borderRadius: 8, padding: '14px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 'auto' },
  orderBtnSell:    { width: '100%', background: '#3b82f6', border: 'none', borderRadius: 8, padding: '14px', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 'auto' },
  msg:             { textAlign: 'center', marginTop: 10, fontSize: 13 },
}
