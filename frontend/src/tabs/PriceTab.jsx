import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import { getCompanies, getPriceHistory, getIndicators } from '../api/data'

const fmt    = (n) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum = (n) => Number(n ?? 0).toLocaleString('en-US')
const upColor = '#f43f5e'
const dnColor = '#3b82f6'

// 시뮬 시작일 6개월 전 계산
function chartFrom(startDate) {
  const d = new Date(startDate)
  d.setMonth(d.getMonth() - 6)
  return d.toISOString().slice(0, 10)
}

export default function PriceTab({ state, startDate }) {
  const { simDate, holdings = [] } = state
  const chartRef = useRef(null)
  const chartInstance = useRef(null)
  const candleRef = useRef(null)
  const rsiRef = useRef(null)
  const macdRef = useRef(null)
  const macdHistRef = useRef(null)
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

  // 차트 초기화 (마운트 시 1회)
  useEffect(() => {
    if (!chartRef.current) return

    const chart = createChart(chartRef.current, {
      layout: { background: { color: '#0f0f0f' }, textColor: '#666', fontSize: 10 },
      grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
      crosshair: { vertLine: { color: '#333' }, horzLine: { color: '#333' } },
      rightPriceScale: { borderColor: '#1a1a1a', textColor: '#666' },
      timeScale: { borderColor: '#1a1a1a', timeVisible: false },
      handleScroll: true,
      handleScale: true,
    })

    // 캔들 (메인 패널 pane 0)
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor, downColor: dnColor,
      borderUpColor: upColor, borderDownColor: dnColor,
      wickUpColor: upColor, wickDownColor: dnColor,
    })

    // RSI (pane 1)
    rsiRef.current = chart.addSeries(LineSeries, {
      color: '#a78bfa', lineWidth: 1.5,
      pane: 1,
      priceScaleId: 'rsi',
    })
    chart.panes()[1]?.setHeight(80)

    // MACD 라인 (pane 2)
    macdRef.current = chart.addSeries(LineSeries, {
      color: '#60a5fa', lineWidth: 1.5,
      pane: 2,
      priceScaleId: 'macd',
    })
    // MACD Signal (pane 2 공유)
    const macdSignal = chart.addSeries(LineSeries, {
      color: '#f59e0b', lineWidth: 1, lineStyle: 2,
      pane: 2,
      priceScaleId: 'macd',
    })
    // MACD Histogram (pane 2 공유)
    macdHistRef.current = { signal: macdSignal }
    chart.panes()[2]?.setHeight(70)

    chartInstance.current = chart
    setReady(true)

    const observer = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth })
    })
    observer.observe(chartRef.current)
    return () => { observer.disconnect(); chart.remove() }
  }, [])

  // 데이터 로드
  useEffect(() => {
    if (!ready || !selectedCompany || !startDate || !simDate) return

    const from = chartFrom(startDate)

    Promise.all([
      getPriceHistory(selectedCompany.id, from, simDate),
      getIndicators(selectedCompany.id, from, simDate),
    ]).then(([priceRes, indRes]) => {
      const candles = priceRes.data.map((p) => ({
        time: p.date, open: Number(p.open), high: Number(p.high),
        low: Number(p.low), close: Number(p.close),
      }))
      candleRef.current.setData(candles)

      const rsiData    = indRes.data.filter(i => i.rsi != null).map(i => ({ time: i.date, value: Number(i.rsi) }))
      const macdData   = indRes.data.filter(i => i.macd != null).map(i => ({ time: i.date, value: Number(i.macd) }))
      const signalData = indRes.data.filter(i => i.macdSignal != null).map(i => ({ time: i.date, value: Number(i.macdSignal) }))

      rsiRef.current.setData(rsiData)
      macdRef.current.setData(macdData)
      macdHistRef.current.signal.setData(signalData)

      chartInstance.current.timeScale().fitContent()
      setCurrentPrice(priceRes.data[priceRes.data.length - 1] ?? null)
    }).catch(() => {})
  }, [ready, simDate, selectedCompany, startDate])

  const price = currentPrice
  const up = price ? Number(price.close) >= Number(price.open) : true

  return (
    <div style={s.root}>
      {/* 기업 선택 */}
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

      {/* 현재가 + OHLV */}
      {price && (
        <div style={s.priceSection}>
          <div style={s.priceRow}>
            <span style={{ ...s.closePrice, color: up ? upColor : dnColor }}>{fmt(price.close)}</span>
            <span style={{ color: up ? upColor : dnColor, fontSize: 14, fontWeight: 600 }}>
              {up ? '▲' : '▼'} {Math.abs(((Number(price.close) - Number(price.open)) / Number(price.open)) * 100).toFixed(2)}%
            </span>
          </div>
          <div style={s.ohlv}>
            <OhlvItem label="시가"   value={fmt(price.open)} />
            <OhlvItem label="고가"   value={fmt(price.high)}  color={upColor} />
            <OhlvItem label="저가"   value={fmt(price.low)}   color={dnColor} />
            <OhlvItem label="거래량" value={fmtNum(price.volume)} />
          </div>
        </div>
      )}

      {/* 차트 (캔들 + RSI + MACD 패널 포함) */}
      <div ref={chartRef} style={s.chartWrap} />
    </div>
  )
}

function OhlvItem({ label, value, color }) {
  return (
    <div style={s.ohlvItem}>
      <span style={s.ohlvLabel}>{label}</span>
      <span style={{ color: color || '#e8e8e8', fontSize: 12, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

const s = {
  root:             { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: 8 },
  companyRow:       { display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 },
  companyBtn:       { background: '#161616', border: '1px solid #252525', borderRadius: 8, padding: '5px 10px', color: '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer', position: 'relative' },
  companyBtnActive: { borderColor: '#4ade80', color: '#4ade80' },
  companyBtnHeld:   { borderColor: '#f59e0b55', color: '#888' },
  heldDot:          { position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' },
  priceSection:     { flexShrink: 0 },
  priceRow:         { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  closePrice:       { fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px' },
  ohlv:             { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 0', background: '#161616', borderRadius: 8, padding: '8px 12px' },
  ohlvItem:         { display: 'flex', justifyContent: 'space-between', paddingRight: 10, alignItems: 'center' },
  ohlvLabel:        { color: '#666', fontSize: 11 },
  chartWrap:        { flex: 1, minHeight: 0 },  // minHeight:0 이 핵심 - flex overflow 방지
}
