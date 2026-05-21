import { useEffect, useRef, useState } from 'react'

const INDICATORS = [
  { key: 'sp500',      label: 'S&P500',  fmt: (v) => v?.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
  { key: 'nasdaq',     label: 'NASDAQ',  fmt: (v) => v?.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
  { key: 'fedRate',    label: 'FED',     fmt: (v) => v?.toFixed(2) + '%' },
  { key: 'us10yYield', label: 'US10Y',   fmt: (v) => v?.toFixed(2) + '%' },
  { key: 'vix',        label: 'VIX',     fmt: (v) => v?.toFixed(1) },
  { key: 'dxy',        label: 'DXY',     fmt: (v) => v?.toFixed(1) },
  { key: 'wtiOil',     label: 'WTI',     fmt: (v) => '$' + v?.toFixed(1) },
  { key: 'gold',       label: 'GOLD',    fmt: (v) => '$' + v?.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
  { key: 'btc',        label: 'BTC',     fmt: (v) => '$' + v?.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
]

function calcChg(curr, prev, key) {
  if (!curr || !prev) return null
  const c = Number(curr[key])
  const p = Number(prev[key])
  if (!c || !p) return null
  return ((c - p) / p) * 100
}

export default function MacroTicker({ macroList, onOpen }) {
  const curr = macroList?.[macroList.length - 1]
  const prev = macroList?.[macroList.length - 2]

  const [paused, setPaused] = useState(false)
  const tickerRef = useRef(null)

  // 자동 스크롤 애니메이션
  useEffect(() => {
    const el = tickerRef.current
    if (!el || paused) return
    let raf
    let pos = 0
    const speed = 0.5
    const total = el.scrollWidth / 2

    function step() {
      pos += speed
      if (pos >= total) pos = 0
      el.scrollLeft = pos
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [paused, macroList])

  if (!curr) return null

  const items = INDICATORS.map(ind => {
    const val = Number(curr[ind.key])
    const chg = calcChg(curr, prev, ind.key)
    const up  = chg === null ? null : chg >= 0
    return { ...ind, val, chg, up }
  })

  // 2배 복제해서 무한 스크롤 효과
  const doubled = [...items, ...items]

  return (
    <div style={s.wrap}>
      <div
        ref={tickerRef}
        style={s.ticker}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {doubled.map((item, i) => (
          <span key={i} style={s.item}>
            <span style={s.label}>{item.label}</span>
            <span style={s.val}>{item.fmt(item.val)}</span>
            {item.chg !== null && (
              <span style={{ ...s.chg, color: item.up ? '#16a34a' : '#dc2626' }}>
                {item.up ? '▲' : '▼'}{Math.abs(item.chg).toFixed(2)}%
              </span>
            )}
            <span style={s.div}>|</span>
          </span>
        ))}
      </div>
      <button style={s.btn} onClick={onOpen} onMouseDown={e => e.preventDefault()}>≡</button>
    </div>
  )
}

const s = {
  wrap:   { display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', flexShrink: 0, height: 28 },
  ticker: { flex: 1, display: 'flex', alignItems: 'center', overflowX: 'hidden', scrollbarWidth: 'none', whiteSpace: 'nowrap', gap: 0 },
  item:   { display: 'inline-flex', alignItems: 'center', gap: 4, paddingLeft: 10, fontSize: 10 },
  label:  { color: '#6b7280', fontWeight: 700 },
  val:    { color: '#111827', fontWeight: 600 },
  chg:    { fontSize: 9, fontWeight: 700 },
  div:    { color: '#d1d5db', paddingLeft: 6 },
  btn:    { flexShrink: 0, width: 28, height: 28, border: 'none', borderLeft: '1px solid #e5e7eb', background: '#f1f5f9', color: '#374151', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' },
}
