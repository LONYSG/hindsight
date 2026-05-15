import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, LineSeries } from 'lightweight-charts'
import { getCompanies, getPriceHistory, getIndicators } from '../api/data'

const fmt    = (n) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum = (n) => Number(n ?? 0).toLocaleString('en-US')
const upColor = '#f43f5e'
const dnColor = '#3b82f6'

function chartFrom(startDate) {
  const d = new Date(startDate)
  d.setMonth(d.getMonth() - 6)
  return d.toISOString().slice(0, 10)
}

function calcMA(candles, period) {
  return candles.map((c, i) => {
    if (i < period - 1) return null
    const avg = candles.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0) / period
    return { time: c.time, value: avg }
  }).filter(Boolean)
}

function calcBB(candles, period = 20, mult = 2) {
  const upper = [], lower = []
  candles.forEach((c, i) => {
    if (i < period - 1) return
    const slice = candles.slice(i - period + 1, i + 1)
    const mean = slice.reduce((s, x) => s + x.close, 0) / period
    const std  = Math.sqrt(slice.reduce((s, x) => s + (x.close - mean) ** 2, 0) / period)
    upper.push({ time: c.time, value: mean + mult * std })
    lower.push({ time: c.time, value: mean - mult * std })
  })
  return { upper, lower }
}

const BASE_OPTS = {
  autoSize: true,
  layout: { background: { color: '#0f0f0f' }, textColor: '#555', fontSize: 10 },
  grid: { vertLines: { color: '#111' }, horzLines: { color: '#111' } },
  crosshair: { vertLine: { color: '#2a2a2a' }, horzLine: { color: '#2a2a2a' } },
  rightPriceScale: { borderColor: '#1a1a1a', textColor: '#555' },
  timeScale: { borderColor: '#1a1a1a', timeVisible: false },
  handleScroll: true, handleScale: true,
}

const MA_COLORS = { 5: '#f59e0b', 20: '#60a5fa', 60: '#4ade80' }

export default function PriceTab({ state, startDate }) {
  const { simDate, holdings = [] } = state

  const [companies, setCompanies] = useState([])
  const [selected, setSelected]   = useState(null)
  const [currentPrice, setCurrentPrice] = useState(null)

  // 오버레이 토글 (메인 차트 위)
  const [showMA,   setShowMA]   = useState({ 5: true, 20: true, 60: false })
  const [showBB,   setShowBB]   = useState(false)
  const [showIchi, setShowIchi] = useState(false)

  // 패널 토글 (하단 별도 차트)
  const [showRSI,  setShowRSI]  = useState(false)
  const [showMACD, setShowMACD] = useState(false)

  // DOM refs
  const mainDiv = useRef(null)
  const rsiDiv  = useRef(null)
  const macdDiv = useRef(null)

  // 차트 인스턴스
  const mainChart = useRef(null)
  const rsiChart  = useRef(null)
  const macdChart = useRef(null)

  // 시리즈 refs
  const candleSr   = useRef(null)
  const maSr       = useRef({})
  const bbUpperSr  = useRef(null)
  const bbLowerSr  = useRef(null)
  const ichiSr     = useRef({})  // tenkan, kijun, senkouA, senkouB
  const rsiSr      = useRef(null)
  const macdSr     = useRef(null)
  const signalSr   = useRef(null)

  // 데이터 캐시
  const priceCache = useRef([])
  const indCache   = useRef([])
  const syncing    = useRef(false)

  useEffect(() => {
    getCompanies().then(r => {
      setCompanies(r.data)
      const held = r.data.find(c => holdings.some(h => h.companyId === c.id))
      setSelected(held || r.data[0] || null)
    })
  }, [])

  // 메인 차트 초기화
  useEffect(() => {
    if (!mainDiv.current) return
    const chart = createChart(mainDiv.current, BASE_OPTS)

    candleSr.current = chart.addSeries(CandlestickSeries, {
      upColor, downColor: dnColor,
      borderUpColor: upColor, borderDownColor: dnColor,
      wickUpColor: upColor, wickDownColor: dnColor,
    })

    // MA 시리즈
    ;[5, 20, 60].forEach(p => {
      maSr.current[p] = chart.addSeries(LineSeries, {
        color: MA_COLORS[p], lineWidth: 1, visible: showMA[p],
        priceLineVisible: false, lastValueVisible: false,
      })
    })

    // 볼린저 밴드 (숨김 상태로 생성)
    const bbStyle = { lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, visible: false }
    bbUpperSr.current = chart.addSeries(LineSeries, { ...bbStyle, color: '#8b5cf6' })
    bbLowerSr.current = chart.addSeries(LineSeries, { ...bbStyle, color: '#8b5cf6' })

    // 이치모쿠 시리즈 (숨김 상태로 생성)
    const ichiColors = { tenkan: '#f43f5e', kijun: '#3b82f6', senkouA: '#4ade8066', senkouB: '#f59e0b66' }
    Object.entries(ichiColors).forEach(([key, color]) => {
      ichiSr.current[key] = chart.addSeries(LineSeries, {
        color, lineWidth: key.startsWith('senkou') ? 1 : 1.5,
        lineStyle: key.startsWith('senkou') ? 2 : 0,
        priceLineVisible: false, lastValueVisible: false, visible: false,
      })
    })

    mainChart.current = chart
    return () => { chart.remove(); mainChart.current = null }
  }, [])

  // RSI 차트
  useEffect(() => {
    if (!rsiDiv.current || !showRSI) return
    const chart = createChart(rsiDiv.current, {
      ...BASE_OPTS,
      rightPriceScale: { ...BASE_OPTS.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
    })
    rsiSr.current = chart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false })
    rsiSr.current.createPriceLine({ price: 70, color: '#f43f5e55', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '70' })
    rsiSr.current.createPriceLine({ price: 30, color: '#3b82f655', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '30' })
    rsiSr.current.createPriceLine({ price: 50, color: '#33333388', lineWidth: 1, lineStyle: 2, axisLabelVisible: false })
    const rsi = indCache.current.filter(i => i.rsi != null).map(i => ({ time: i.date, value: Number(i.rsi) }))
    if (rsi.length) rsiSr.current.setData(rsi)
    rsiChart.current = chart
    syncCharts(mainChart.current, chart)
    return () => { chart.remove(); rsiChart.current = null; rsiSr.current = null }
  }, [showRSI])

  // MACD 차트
  useEffect(() => {
    if (!macdDiv.current || !showMACD) return
    const chart = createChart(macdDiv.current, BASE_OPTS)
    macdSr.current   = chart.addSeries(LineSeries, { color: '#60a5fa', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false })
    signalSr.current = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false })
    const macd   = indCache.current.filter(i => i.macd != null).map(i => ({ time: i.date, value: Number(i.macd) }))
    const signal = indCache.current.filter(i => i.macdSignal != null).map(i => ({ time: i.date, value: Number(i.macdSignal) }))
    if (macd.length)   macdSr.current.setData(macd)
    if (signal.length) signalSr.current.setData(signal)
    macdChart.current = chart
    syncCharts(mainChart.current, chart)
    return () => { chart.remove(); macdChart.current = null; macdSr.current = null; signalSr.current = null }
  }, [showMACD])

  // 데이터 로드
  useEffect(() => {
    if (!selected || !startDate || !simDate || !candleSr.current) return
    const from = chartFrom(startDate)
    Promise.all([
      getPriceHistory(selected.id, from, simDate),
      getIndicators(selected.id, from, simDate),
    ]).then(([priceRes, indRes]) => {
      const candles = priceRes.data.map(p => ({
        time: p.date, open: Number(p.open), high: Number(p.high),
        low: Number(p.low), close: Number(p.close),
      }))
      priceCache.current = candles
      indCache.current   = indRes.data

      candleSr.current.setData(candles)
      ;[5, 20, 60].forEach(p => maSr.current[p]?.setData(calcMA(candles, p)))

      const { upper, lower } = calcBB(candles)
      bbUpperSr.current.setData(upper)
      bbLowerSr.current.setData(lower)

      const iData = {
        tenkan:   indRes.data.filter(i => i.ichimokuTenkan  != null).map(i => ({ time: i.date, value: Number(i.ichimokuTenkan) })),
        kijun:    indRes.data.filter(i => i.ichimokuKijun   != null).map(i => ({ time: i.date, value: Number(i.ichimokuKijun) })),
        senkouA:  indRes.data.filter(i => i.ichimokuSenkouA != null).map(i => ({ time: i.date, value: Number(i.ichimokuSenkouA) })),
        senkouB:  indRes.data.filter(i => i.ichimokuSenkouB != null).map(i => ({ time: i.date, value: Number(i.ichimokuSenkouB) })),
      }
      Object.entries(iData).forEach(([k, d]) => ichiSr.current[k]?.setData(d))

      if (rsiSr.current) {
        const rsi = indRes.data.filter(i => i.rsi != null).map(i => ({ time: i.date, value: Number(i.rsi) }))
        rsiSr.current.setData(rsi)
      }
      if (macdSr.current) {
        const macd   = indRes.data.filter(i => i.macd != null).map(i => ({ time: i.date, value: Number(i.macd) }))
        const signal = indRes.data.filter(i => i.macdSignal != null).map(i => ({ time: i.date, value: Number(i.macdSignal) }))
        macdSr.current.setData(macd)
        signalSr.current.setData(signal)
      }

      mainChart.current.timeScale().fitContent()
      setCurrentPrice(priceRes.data[priceRes.data.length - 1] ?? null)
    }).catch(() => {})
  }, [selected, simDate, startDate])

  const toggleMA = (p) => {
    const next = !showMA[p]
    setShowMA(prev => ({ ...prev, [p]: next }))
    maSr.current[p]?.applyOptions({ visible: next })
  }
  const toggleBB = () => {
    const next = !showBB
    setShowBB(next)
    bbUpperSr.current?.applyOptions({ visible: next })
    bbLowerSr.current?.applyOptions({ visible: next })
  }
  const toggleIchi = () => {
    const next = !showIchi
    setShowIchi(next)
    Object.values(ichiSr.current).forEach(s => s?.applyOptions({ visible: next }))
  }

  function syncCharts(a, b) {
    if (!a || !b) return
    a.timeScale().subscribeVisibleLogicalRangeChange(r => {
      if (syncing.current || !r) return
      syncing.current = true; b.timeScale().setVisibleLogicalRange(r); syncing.current = false
    })
    b.timeScale().subscribeVisibleLogicalRangeChange(r => {
      if (syncing.current || !r) return
      syncing.current = true; a.timeScale().setVisibleLogicalRange(r); syncing.current = false
    })
  }

  const price = currentPrice
  const up = price ? Number(price.close) >= Number(price.open) : true

  return (
    <div style={s.root}>
      {/* 기업 선택 */}
      <div style={s.companyRow}>
        {companies.map(c => {
          const isSel = selected?.id === c.id
          const held  = holdings.some(h => h.companyId === c.id)
          return (
            <button key={c.id}
              style={{ ...s.chip, ...(isSel ? s.chipActive : {}), ...(held && !isSel ? s.chipHeld : {}) }}
              onClick={() => setSelected(c)}>
              {c.ticker}{held && <span style={s.dot} />}
            </button>
          )
        })}
      </div>

      {/* 지표 토글 */}
      <div style={s.indRow}>
        <span style={s.indGroup}>
          {[5, 20, 60].map(p => (
            <button key={p} style={{ ...s.indChip, ...(showMA[p] ? { borderColor: MA_COLORS[p] + 'bb', color: MA_COLORS[p] } : {}) }}
              onClick={() => toggleMA(p)}>MA{p}</button>
          ))}
          <button style={{ ...s.indChip, ...(showBB ? s.bbOn : {}) }} onClick={toggleBB}>BB</button>
          <button style={{ ...s.indChip, ...(showIchi ? s.ichiOn : {}) }} onClick={toggleIchi}>일목</button>
        </span>
        <div style={s.sep} />
        <span style={s.indGroup}>
          <button style={{ ...s.indChip, ...(showRSI ? s.rsiOn : {}) }} onClick={() => setShowRSI(v => !v)}>RSI</button>
          <button style={{ ...s.indChip, ...(showMACD ? s.macdOn : {}) }} onClick={() => setShowMACD(v => !v)}>MACD</button>
        </span>
      </div>

      {/* 현재가 */}
      {price && (
        <div style={s.priceRow}>
          <span style={{ color: up ? upColor : dnColor, fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>{fmt(price.close)}</span>
          <span style={{ color: up ? upColor : dnColor, fontSize: 12, fontWeight: 600 }}>{up ? '▲' : '▼'} {Math.abs(((Number(price.close) - Number(price.open)) / Number(price.open)) * 100).toFixed(2)}%</span>
          <span style={{ color: '#3a3a3a', fontSize: 11 }}>H {fmt(price.high)} · L {fmt(price.low)} · {fmtNum(price.volume)}</span>
        </div>
      )}

      {/* 메인 차트 */}
      <div ref={mainDiv} style={{ flex: 3, minHeight: 0 }} />

      {/* RSI 패널 */}
      {showRSI && (
        <div style={s.panel}>
          <div style={s.panelHdr}>
            <span style={{ color: '#a78bfa', fontWeight: 700 }}>RSI 14</span>
            <span style={{ color: '#333' }}>· 70 과매수 / 30 과매도</span>
          </div>
          <div ref={rsiDiv} style={{ flex: 1, minHeight: 0 }} />
        </div>
      )}

      {/* MACD 패널 */}
      {showMACD && (
        <div style={s.panel}>
          <div style={s.panelHdr}>
            <span style={{ color: '#60a5fa', fontWeight: 700 }}>MACD 12/26/9</span>
            <span style={{ color: '#60a5fa' }}>— MACD</span>
            <span style={{ color: '#f59e0b' }}>-- Signal</span>
          </div>
          <div ref={macdDiv} style={{ flex: 1, minHeight: 0 }} />
        </div>
      )}
    </div>
  )
}

const s = {
  root:       { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: 6 },
  companyRow: { display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 },
  chip:       { background: '#161616', border: '1px solid #252525', borderRadius: 6, padding: '4px 8px', color: '#555', fontSize: 11, fontWeight: 700, cursor: 'pointer', position: 'relative' },
  chipActive: { borderColor: '#4ade80', color: '#4ade80' },
  chipHeld:   { borderColor: '#f59e0b44', color: '#777' },
  dot:        { position: 'absolute', top: 2, right: 2, width: 4, height: 4, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' },
  indRow:     { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  indGroup:   { display: 'flex', gap: 4 },
  indChip:    { background: '#161616', border: '1px solid #252525', borderRadius: 5, padding: '3px 7px', color: '#444', fontSize: 10, fontWeight: 700, cursor: 'pointer' },
  sep:        { width: 1, height: 12, background: '#2a2a2a' },
  bbOn:       { borderColor: '#8b5cf688', color: '#8b5cf6' },
  ichiOn:     { borderColor: '#e879f988', color: '#e879f9' },
  rsiOn:      { borderColor: '#a78bfa88', color: '#a78bfa' },
  macdOn:     { borderColor: '#60a5fa88', color: '#60a5fa' },
  priceRow:   { display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 },
  panel:      { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderTop: '1px solid #1a1a1a' },
  panelHdr:   { display: 'flex', gap: 6, alignItems: 'center', padding: '3px 0', fontSize: 10, flexShrink: 0 },
}
