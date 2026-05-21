import { useEffect, useRef, useState } from 'react'
import { createChart, LineSeries } from 'lightweight-charts'

const INDICATORS = [
  { key: 'sp500',      label: 'S&P 500',  unit: '',  color: '#3b82f6' },
  { key: 'nasdaq',     label: 'NASDAQ',   unit: '',  color: '#8b5cf6' },
  { key: 'fedRate',    label: 'FED Rate', unit: '%', color: '#f59e0b' },
  { key: 'us10yYield', label: 'US 10Y',   unit: '%', color: '#ef4444' },
  { key: 'us2yYield',  label: 'US 2Y',    unit: '%', color: '#f97316' },
  { key: 'vix',        label: 'VIX',      unit: '',  color: '#ec4899' },
  { key: 'dxy',        label: 'DXY',      unit: '',  color: '#06b6d4' },
  { key: 'wtiOil',     label: 'WTI Oil',  unit: '$', color: '#84cc16' },
  { key: 'gold',       label: 'Gold',     unit: '$', color: '#eab308' },
  { key: 'btc',        label: 'Bitcoin',  unit: '$', color: '#f97316' },
]

const fmtVal = (key, v) => {
  if (v == null) return '—'
  const n = Number(v)
  if (['fedRate', 'us10yYield', 'us2yYield'].includes(key)) return n.toFixed(2) + '%'
  if (['sp500', 'nasdaq', 'gold', 'btc'].includes(key)) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return n.toFixed(key === 'vix' ? 1 : 2)
}

function calcChg(curr, prev, key) {
  if (!curr || !prev) return null
  const c = Number(curr[key]), p = Number(prev[key])
  if (!c || !p) return null
  return ((c - p) / p) * 100
}

export default function MacroSheet({ macroList, onClose }) {
  const [selected, setSelected] = useState(null)
  const chartDiv = useRef(null)
  const chartRef = useRef(null)

  const curr = macroList?.[macroList.length - 1]
  const prev = macroList?.[macroList.length - 2]

  // 독립 차트
  useEffect(() => {
    if (!selected || !chartDiv.current || !macroList?.length) return
    const ind = INDICATORS.find(i => i.key === selected)
    if (!ind) return

    const chart = createChart(chartDiv.current, {
      autoSize: true,
      layout: { background: { color: '#fff' }, textColor: '#6b7280', fontSize: 10 },
      grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } },
      rightPriceScale: { borderColor: '#e5e7eb' },
      timeScale: { borderColor: '#e5e7eb', timeVisible: false },
    })
    const series = chart.addSeries(LineSeries, {
      color: ind.color, lineWidth: 2,
      priceLineVisible: false, lastValueVisible: true,
    })
    const data = macroList
      .filter(m => m[selected] != null)
      .map(m => ({ time: m.date, value: Number(m[selected]) }))
    series.setData(data)
    chart.timeScale().fitContent()
    chartRef.current = chart
    return () => { chart.remove(); chartRef.current = null }
  }, [selected, macroList])

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        {/* 헤더 */}
        <div style={s.header}>
          {selected ? (
            <button style={s.back} onClick={() => setSelected(null)}>← 전체</button>
          ) : (
            <span style={s.title}>시장 지표</span>
          )}
          <button style={s.close} onClick={onClose}>✕</button>
        </div>

        {selected ? (
          /* 독립 차트 */
          <div style={s.chartArea}>
            <div style={s.chartTitle}>
              <span style={{ color: INDICATORS.find(i => i.key === selected)?.color, fontWeight: 700 }}>
                {INDICATORS.find(i => i.key === selected)?.label}
              </span>
              <span style={{ color: '#111827', fontSize: 18, fontWeight: 700, marginLeft: 8 }}>
                {fmtVal(selected, curr?.[selected])}
              </span>
            </div>
            <div ref={chartDiv} style={{ flex: 1, minHeight: 0 }} />
          </div>
        ) : (
          /* 그리드 */
          <div style={s.grid}>
            {INDICATORS.map(ind => {
              const chg = calcChg(curr, prev, ind.key)
              const up  = chg === null ? null : chg >= 0
              return (
                <div key={ind.key} style={s.card} onClick={() => setSelected(ind.key)}>
                  <div style={{ ...s.cardLabel, color: ind.color }}>{ind.label}</div>
                  <div style={s.cardVal}>{fmtVal(ind.key, curr?.[ind.key])}</div>
                  {chg !== null && (
                    <div style={{ ...s.cardChg, color: up ? '#16a34a' : '#dc2626' }}>
                      {up ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'flex-end' },
  sheet:      { width: '100%', maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '80vh' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  title:      { fontSize: 15, fontWeight: 700, color: '#111827' },
  back:       { fontSize: 13, fontWeight: 600, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  close:      { width: 28, height: 28, background: '#f3f4f6', border: 'none', borderRadius: '50%', cursor: 'pointer', color: '#6b7280', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#f3f4f6', overflowY: 'auto', flex: 1 },
  card:       { background: '#fff', padding: '14px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 },
  cardLabel:  { fontSize: 10, fontWeight: 700, letterSpacing: 0.5 },
  cardVal:    { fontSize: 16, fontWeight: 700, color: '#111827' },
  cardChg:    { fontSize: 11, fontWeight: 600 },
  chartArea:  { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: 12 },
  chartTitle: { display: 'flex', alignItems: 'baseline', marginBottom: 8, flexShrink: 0 },
}
