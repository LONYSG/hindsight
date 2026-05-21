import { useState } from 'react'

// isRate: true → 절대 변화(%p 단위), false → 상대 변화(%)
const MACRO_INDICATORS = [
  { key: 'sp500',      label: 'S&P500', isRate: false, fmt: (v) => v?.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
  { key: 'nasdaq',     label: 'NASDAQ', isRate: false, fmt: (v) => v?.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
  { key: 'fedRate',    label: 'FED',    isRate: true,  fmt: (v) => v?.toFixed(2) + '%' },
  { key: 'us10yYield', label: 'US10Y',  isRate: true,  fmt: (v) => v?.toFixed(2) + '%' },
  { key: 'vix',        label: 'VIX',    isRate: false, fmt: (v) => v?.toFixed(1) },
  { key: 'dxy',        label: 'DXY',    isRate: false, fmt: (v) => v?.toFixed(1) },
  { key: 'wtiOil',     label: 'WTI',    isRate: false, fmt: (v) => '$' + v?.toFixed(1) },
  { key: 'gold',       label: 'GOLD',   isRate: false, fmt: (v) => '$' + v?.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
  { key: 'btc',        label: 'BTC',    isRate: false, fmt: (v) => '$' + v?.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
]

// 변화 계산: 금리는 절대차(%p), 가격은 상대%(%)
function calcChgInfo(curr, prev, key, isRate) {
  if (!curr || !prev) return null
  const c = Number(curr[key]), p = Number(prev[key])
  if (!c || !p) return null
  if (isRate) {
    const diff = c - p
    return { value: diff, label: (diff >= 0 ? '+' : '') + diff.toFixed(2) + '%p', up: diff > 0, flat: Math.abs(diff) < 0.001 }
  } else {
    const pct = (c - p) / p * 100
    return { value: pct, label: (pct >= 0 ? '▲' : '▼') + Math.abs(pct).toFixed(2) + '%', up: pct > 0, flat: Math.abs(pct) < 0.01 }
  }
}

export default function MacroTicker({ macroList, etfList = [], onOpen }) {
  const [paused, setPaused] = useState(false)

  const curr = macroList?.[macroList.length - 1]
  const prev = macroList?.[macroList.length - 2]

  if (!curr) return null

  const macroItems = MACRO_INDICATORS.map(ind => {
    const val  = Number(curr[ind.key])
    const chg  = calcChgInfo(curr, prev, ind.key, ind.isRate)
    return { label: ind.label, valStr: ind.fmt(val), chg }
  })

  const etfItems = etfList.map(etf => {
    const val = Number(etf.currentClose ?? 0)
    const chg = (etf.currentClose && etf.prevClose)
      ? (() => {
          const pct = (Number(etf.currentClose) - Number(etf.prevClose)) / Number(etf.prevClose) * 100
          return { value: pct, label: (pct >= 0 ? '▲' : '▼') + Math.abs(pct).toFixed(2) + '%', up: pct > 0, flat: Math.abs(pct) < 0.01 }
        })()
      : null
    return { label: etf.ticker, valStr: '$' + val.toFixed(2), chg }
  })

  const items = [...macroItems, ...etfItems]

  const renderItem = (item, i) => (
    <span key={i} style={s.item}>
      <span style={s.label}>{item.label}</span>
      <span style={s.val}>{item.valStr}</span>
      {item.chg && (
        item.chg.flat
          ? <span style={{ ...s.chg, color: '#9ca3af' }}>—</span>
          : <span style={{ ...s.chg, color: item.chg.up ? '#f43f5e' : '#3b82f6' }}>{item.chg.label}</span>
      )}
      <span style={s.div}>·</span>
    </span>
  )

  return (
    <div style={s.wrap}>
      <div style={s.viewport}>
        <div
          className={`ticker-track${paused ? ' paused' : ''}`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          {items.map((item, i) => renderItem(item, i))}
          {items.map((item, i) => renderItem(item, i + items.length))}
        </div>
      </div>
      <button style={s.btn} onClick={onOpen} onMouseDown={e => e.preventDefault()}>≡</button>
    </div>
  )
}

const s = {
  wrap:  { display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', flexShrink: 0, height: 28 },
  viewport: { flex: 1, overflow: 'hidden' },
  item:  { display: 'inline-flex', alignItems: 'center', gap: 4, paddingLeft: 12, fontSize: 10, whiteSpace: 'nowrap' },
  label: { color: '#374151', fontWeight: 700 },
  val:   { color: '#111827', fontWeight: 600 },
  chg:   { fontSize: 9, fontWeight: 700 },
  div:   { color: '#d1d5db', paddingLeft: 8, fontSize: 11 },
  btn:   { flexShrink: 0, width: 28, height: 28, border: 'none', borderLeft: '1px solid #e5e7eb', background: '#f1f5f9', color: '#374151', fontSize: 13, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', paddingBottom: 1 },
}
