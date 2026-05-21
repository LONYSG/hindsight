import { useEffect, useRef, useState } from 'react'
import { createChart, LineSeries } from 'lightweight-charts'

const INDICATORS = [
  { key: 'sp500',      label: 'S&P 500',  desc: '미국 대형주 500',  color: '#3b82f6', isRate: false },
  { key: 'nasdaq',     label: 'NASDAQ',   desc: '기술주 종합지수',   color: '#8b5cf6', isRate: false },
  { key: 'fedRate',    label: 'FED Rate', desc: '연준 기준금리',     color: '#f59e0b', isRate: true  },
  { key: 'us10yYield', label: 'US 10Y',   desc: '미국 10년물 금리',  color: '#ef4444', isRate: true  },
  { key: 'us2yYield',  label: 'US 2Y',    desc: '미국 2년물 금리',   color: '#f97316', isRate: true  },
  { key: 'vix',        label: 'VIX',      desc: '시장 공포 지수',    color: '#ec4899', isRate: false },
  { key: 'dxy',        label: 'DXY',      desc: '달러 인덱스',       color: '#06b6d4', isRate: false },
  { key: 'wtiOil',     label: 'WTI Oil',  desc: '원유 ($/배럴)',     color: '#84cc16', isRate: false },
  { key: 'gold',       label: 'Gold',     desc: '금 현물 ($/온스)',  color: '#eab308', isRate: false },
  { key: 'btc',        label: 'Bitcoin',  desc: '비트코인 (USD)',    color: '#f97316', isRate: false },
]

function chgInfo(curr, prev, key, isRate) {
  if (!curr || !prev) return null
  const c = Number(curr[key]), p = Number(prev[key])
  if (!c || !p) return null
  if (isRate) {
    const diff = c - p
    return { label: (diff >= 0 ? '+' : '') + diff.toFixed(2) + '%p', up: diff > 0, flat: Math.abs(diff) < 0.001 }
  } else {
    const pct = (c - p) / p * 100
    return { label: (pct >= 0 ? '▲' : '▼') + Math.abs(pct).toFixed(2) + '%', up: pct > 0, flat: Math.abs(pct) < 0.01 }
  }
}

const fmtVal = (key, v) => {
  if (v == null) return '—'
  const n = Number(v)
  if (['fedRate', 'us10yYield', 'us2yYield'].includes(key)) return n.toFixed(2) + '%'
  if (['sp500', 'nasdaq'].includes(key)) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (['gold', 'btc'].includes(key)) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (key === 'wtiOil') return '$' + n.toFixed(1)
  return n.toFixed(key === 'vix' ? 1 : 2)
}

function calcPctChg(curr, prev, key) {
  if (!curr || !prev) return null
  const c = Number(curr[key]), p = Number(prev[key])
  if (!c || !p) return null
  return (c - p) / p * 100
}

const ETF_COLORS = {
  SOXX: '#6366f1', XLK: '#3b82f6', XLE: '#84cc16',
  XLF:  '#f59e0b', XLV: '#10b981', XLI: '#64748b', XLY: '#f97316',
}

const ETF_DESC = {
  SOXX: '반도체', XLK: '기술주', XLE: '에너지',
  XLF:  '금융',   XLV: '헬스케어', XLI: '산업재', XLY: '소비재',
}

export default function MacroSheet({ macroList, etfList = [], onClose }) {
  const [selected,    setSelected]    = useState(null) // macro key or ETF ticker
  const [selectedEtf, setSelectedEtf] = useState(null)
  const chartDiv = useRef(null)

  const curr = macroList?.[macroList.length - 1]
  const prev = macroList?.[macroList.length - 2]
  const ind  = INDICATORS.find(i => i.key === selected)
  const etf  = etfList.find(e => e.ticker === selectedEtf)

  const chartOpts = {
    autoSize: true,
    layout: { background: { color: '#fff' }, textColor: '#6b7280', fontSize: 10 },
    grid: { vertLines: { color: '#f9fafb' }, horzLines: { color: '#f9fafb' } },
    rightPriceScale: { borderColor: '#e5e7eb' },
    timeScale: { borderColor: '#e5e7eb', timeVisible: false },
  }

  // 거시 지표 차트
  useEffect(() => {
    if (!selected || !chartDiv.current || !macroList?.length) return
    const chart = createChart(chartDiv.current, chartOpts)
    const series = chart.addSeries(LineSeries, {
      color: ind?.color ?? '#3b82f6', lineWidth: 2,
      priceLineVisible: false, lastValueVisible: true,
    })
    series.setData(macroList.filter(m => m[selected] != null).map(m => ({ time: m.date, value: Number(m[selected]) })))
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [selected, macroList])

  // ETF 차트
  useEffect(() => {
    if (!selectedEtf || !chartDiv.current || !etf?.history?.length) return
    const chart = createChart(chartDiv.current, chartOpts)
    const series = chart.addSeries(LineSeries, {
      color: ETF_COLORS[selectedEtf] ?? '#6366f1', lineWidth: 2,
      priceLineVisible: false, lastValueVisible: true,
    })
    series.setData(etf.history.map(h => ({ time: h.date, value: Number(h.close) })))
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [selectedEtf, etf])

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.sheet}>
        {/* 헤더 */}
        <div style={s.header}>
          {(selected || selectedEtf)
            ? <button style={s.back} onClick={() => { setSelected(null); setSelectedEtf(null) }}>← 전체</button>
            : <span style={s.title}>시장 지표</span>
          }
          <button style={s.close} onClick={onClose}>✕</button>
        </div>

        {(selected || selectedEtf) ? (
          /* 독립 차트 */
          <div style={s.chartArea}>
            <div style={s.chartMeta}>
              {selected ? (
                <>
                  <span style={{ color: ind?.color, fontSize: 11, fontWeight: 700 }}>{ind?.label}</span>
                  <span style={{ color: '#111827', fontSize: 22, fontWeight: 700, marginLeft: 10 }}>
                    {fmtVal(selected, curr?.[selected])}
                  </span>
                  {(() => {
                    const chg = calcChg(curr, prev, selected)
                    if (!chg) return null
                    const up = chg >= 0
                    return <span style={{ color: up ? '#f43f5e' : '#3b82f6', fontSize: 12, fontWeight: 600, marginLeft: 6 }}>{up ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%</span>
                  })()}
                </>
              ) : (
                <>
                  <span style={{ color: ETF_COLORS[selectedEtf], fontSize: 11, fontWeight: 700 }}>{selectedEtf}</span>
                  <span style={{ color: '#111827', fontSize: 22, fontWeight: 700, marginLeft: 10 }}>
                    ${Number(etf?.currentClose ?? 0).toFixed(2)}
                  </span>
                  {etf?.currentClose && etf?.prevClose && (() => {
                    const chg = (Number(etf.currentClose) - Number(etf.prevClose)) / Number(etf.prevClose) * 100
                    const up = chg >= 0
                    return <span style={{ color: up ? '#f43f5e' : '#3b82f6', fontSize: 12, fontWeight: 600, marginLeft: 6 }}>{up ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%</span>
                  })()}
                </>
              )}
            </div>
            <div ref={chartDiv} style={{ height: 260 }} />
          </div>
        ) : (
          /* 리스트 */
          <div style={s.list}>
            {/* 거시 지표 */}
            <div style={s.sectionHeader}>거시 지표</div>
            {INDICATORS.map(item => {
              const info = chgInfo(curr, prev, item.key, item.isRate)
              return (
                <div key={item.key} style={s.row} onClick={() => setSelected(item.key)}>
                  <div style={{ ...s.dot, background: item.color }} />
                  <span style={s.rowLabel}>{item.label} <span style={s.rowDesc}>{item.desc}</span></span>
                  <span style={s.rowVal}>{fmtVal(item.key, curr?.[item.key])}</span>
                  <span style={{ ...s.rowChg, color: !info ? '#9ca3af' : info.flat ? '#9ca3af' : info.up ? '#f43f5e' : '#3b82f6' }}>
                    {!info ? '—' : info.flat ? '—' : info.label}
                  </span>
                </div>
              )
            })}

            {/* 섹터 ETF */}
            {etfList.length > 0 && (
              <>
                <div style={s.sectionHeader}>섹터 ETF</div>
                {etfList.map(etf => {
                  const chg = (etf.currentClose && etf.prevClose)
                    ? (Number(etf.currentClose) - Number(etf.prevClose)) / Number(etf.prevClose) * 100
                    : null
                  const up = chg === null ? null : chg >= 0
                  return (
                    <div key={etf.ticker} style={s.row} onClick={() => setSelectedEtf(etf.ticker)}>
                      <div style={{ ...s.dot, background: ETF_COLORS[etf.ticker] ?? '#6366f1' }} />
                      <span style={s.rowLabel}>{etf.ticker} <span style={s.rowDesc}>{ETF_DESC[etf.ticker]}</span></span>
                      <span style={s.rowVal}>${Number(etf.currentClose ?? 0).toFixed(2)}</span>
                      {(() => {
                        const info = (etf.currentClose && etf.prevClose) ? (() => {
                          const pct = (Number(etf.currentClose) - Number(etf.prevClose)) / Number(etf.prevClose) * 100
                          return { label: (pct >= 0 ? '▲' : '▼') + Math.abs(pct).toFixed(2) + '%', up: pct > 0, flat: Math.abs(pct) < 0.01 }
                        })() : null
                        return (
                          <span style={{ ...s.rowChg, color: !info ? '#9ca3af' : info.flat ? '#9ca3af' : info.up ? '#f43f5e' : '#3b82f6' }}>
                            {!info ? '—' : info.flat ? '—' : info.label}
                          </span>
                        )
                      })()}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', alignItems: 'flex-end' },
  sheet:     { width: '100%', maxWidth: 480, margin: '0 auto', background: '#fff', borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '65vh' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 12px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 },
  title:     { fontSize: 14, fontWeight: 700, color: '#111827' },
  back:      { fontSize: 13, fontWeight: 600, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, outline: 'none' },
  close:     { width: 26, height: 26, background: '#f3f4f6', border: 'none', borderRadius: '50%', cursor: 'pointer', color: '#6b7280', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' },
  list:      { flex: 1, overflowY: 'auto' },
  row:       { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: '1px solid #f9fafb', cursor: 'pointer' },
  dot:       { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  rowLabel:  { flex: 1, fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'baseline', gap: 5 },
  rowDesc:   { fontSize: 10, fontWeight: 400, color: '#9ca3af' },
  rowVal:    { fontSize: 13, fontWeight: 700, color: '#111827', minWidth: 80, textAlign: 'right' },
  rowChg:    { fontSize: 11, fontWeight: 700, minWidth: 72, textAlign: 'right' },
  chartArea:     { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '12px 14px' },
  chartMeta:     { display: 'flex', alignItems: 'baseline', marginBottom: 10, flexShrink: 0 },
  sectionHeader: { padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.8, background: '#f9fafb' },
}
