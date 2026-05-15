import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries } from 'lightweight-charts'
import { getCompanies, getPriceHistory } from '../api/data'

const fmt = (n) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum = (n) => Number(n ?? 0).toLocaleString('en-US')
const upColor = '#f43f5e'
const dnColor = '#3b82f6'

export default function PriceTab({ state, startDate }) {
  const { simDate, holdings = [] } = state
  const chartRef = useRef(null)
  const chartInstance = useRef(null)
  const seriesRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [currentPrice, setCurrentPrice] = useState(null)

  useEffect(() => {
    getCompanies().then((r) => {
      setCompanies(r.data)
      const held = r.data.find(c => holdings.some(h => h.companyId === c.id))
      setSelectedCompany(held || r.data[0] || null)
    })
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    const chart = createChart(chartRef.current, {
      layout: { background: { color: '#0f0f0f' }, textColor: '#666', fontSize: 11 },
      grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
      crosshair: { vertLine: { color: '#333' }, horzLine: { color: '#333' } },
      rightPriceScale: { borderColor: '#1a1a1a', textColor: '#666' },
      timeScale: { borderColor: '#1a1a1a', timeVisible: false },
      handleScroll: true, handleScale: true,
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor, downColor: dnColor, borderUpColor: upColor, borderDownColor: dnColor,
      wickUpColor: upColor, wickDownColor: dnColor,
    })
    chartInstance.current = chart
    seriesRef.current = series
    setReady(true)
    const observer = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth })
    })
    observer.observe(chartRef.current)
    return () => { observer.disconnect(); chart.remove() }
  }, [])

  useEffect(() => {
    if (!ready || !seriesRef.current || !selectedCompany || !startDate || !simDate) return
    getPriceHistory(selectedCompany.id, startDate, simDate)
      .then((r) => {
        const candles = r.data.map((p) => ({
          time: p.date, open: Number(p.open), high: Number(p.high),
          low: Number(p.low), close: Number(p.close),
        }))
        seriesRef.current.setData(candles)
        chartInstance.current.timeScale().fitContent()
        setCurrentPrice(r.data[r.data.length - 1] ?? null)
      })
      .catch(() => {})
  }, [ready, simDate, selectedCompany, startDate])

  const price = currentPrice
  const up = price ? Number(price.close) >= Number(price.open) : true

  return (
    <div style={s.root}>
      <div style={s.companyRow}>
        {companies.map((c) => {
          const isSelected = selectedCompany?.id === c.id
          const held = holdings.some(h => h.companyId === c.id)
          return (
            <button
              key={c.id}
              style={{ ...s.companyBtn, ...(isSelected ? s.companyBtnActive : {}), ...(held && !isSelected ? s.companyBtnHeld : {}) }}
              onClick={() => setSelectedCompany(c)}
            >
              {c.ticker}
              {held && <span style={s.heldDot} />}
            </button>
          )
        })}
      </div>

      {price && (
        <>
          <div style={s.priceRow}>
            <span style={{ ...s.closePrice, color: up ? upColor : dnColor }}>{fmt(price.close)}</span>
            <span style={{ color: up ? upColor : dnColor, fontSize: 15, fontWeight: 600 }}>
              {up ? '▲' : '▼'} {Math.abs(((Number(price.close) - Number(price.open)) / Number(price.open)) * 100).toFixed(2)}%
            </span>
          </div>
          <div style={s.ohlv}>
            <OhlvItem label="시가"   value={fmt(price.open)} />
            <OhlvItem label="고가"   value={fmt(price.high)} color={upColor} />
            <OhlvItem label="저가"   value={fmt(price.low)}  color={dnColor} />
            <OhlvItem label="거래량" value={fmtNum(price.volume)} />
          </div>
        </>
      )}

      <div ref={chartRef} style={s.chartWrap} />
    </div>
  )
}

function OhlvItem({ label, value, color }) {
  return (
    <div style={s.ohlvItem}>
      <span style={s.ohlvLabel}>{label}</span>
      <span style={{ color: color || '#e8e8e8', fontSize: 13, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

const s = {
  root:             { display: 'flex', flexDirection: 'column', height: '100%', gap: 10 },
  companyRow:       { display: 'flex', flexWrap: 'wrap', gap: 6 },
  companyBtn:       { background: '#161616', border: '1px solid #252525', borderRadius: 8, padding: '5px 10px', color: '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer', position: 'relative' },
  companyBtnActive: { borderColor: '#4ade80', color: '#4ade80' },
  companyBtnHeld:   { borderColor: '#f59e0b55', color: '#888' },
  heldDot:          { position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' },
  priceRow:         { display: 'flex', alignItems: 'baseline', gap: 10 },
  closePrice:       { fontSize: 30, fontWeight: 700, letterSpacing: '-0.5px' },
  ohlv:             { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 0', background: '#161616', borderRadius: 10, padding: '10px 14px' },
  ohlvItem:         { display: 'flex', justifyContent: 'space-between', paddingRight: 12, alignItems: 'center' },
  ohlvLabel:        { color: '#666', fontSize: 12 },
  chartWrap:        { flex: 1, minHeight: 180 },
}
