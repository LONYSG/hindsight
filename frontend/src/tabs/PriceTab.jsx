import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import { getCompanies, getPriceHistory, getIndicators } from '../api/data'
import OrderBottomSheet from '../components/OrderBottomSheet'
import { getDisplayTicker, getDisplayCompany } from '../utils/companyDisplay'

const fmt    = (n) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum = (n) => Number(n ?? 0).toLocaleString('en-US')
const upColor = '#f43f5e'
const dnColor = '#3b82f6'

// ── localStorage ──────────────────────────────────────────
const PREF_KEY = 'hindsight_chart_prefs'

const DEFAULT_PREFS = {
  showMA:   { 5: false, 20: false, 60: false },
  showBB:   false,
  showIchi: false,
  showRSI:  false,
  showMACD: false,
  showVol:  true,   // 거래량만 기본 ON
}

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}')
    return {
      showMA:   { ...DEFAULT_PREFS.showMA,   ...(saved.showMA   || {}) },
      showBB:   saved.showBB   ?? DEFAULT_PREFS.showBB,
      showIchi: saved.showIchi ?? DEFAULT_PREFS.showIchi,
      showRSI:  saved.showRSI  ?? DEFAULT_PREFS.showRSI,
      showMACD: saved.showMACD ?? DEFAULT_PREFS.showMACD,
      showVol:  saved.showVol  ?? DEFAULT_PREFS.showVol,
    }
  } catch { return DEFAULT_PREFS }
}

function savePrefs(prefs) {
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
}

// ── 지표 계산 ─────────────────────────────────────────────
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

// ── 차트 공통 옵션 ────────────────────────────────────────
const BASE_OPTS = {
  autoSize: true,
  layout: { background: { color: '#ffffff' }, textColor: '#6b7280', fontSize: 10 },
  grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } },
  crosshair: { vertLine: { color: '#d1d5db' }, horzLine: { color: '#d1d5db' } },
  rightPriceScale: { borderColor: '#e5e7eb', textColor: '#9ca3af' },
  timeScale: { borderColor: '#e5e7eb', timeVisible: false },
  handleScroll: true, handleScale: true,
}

const MA_COLORS = { 5: '#f59e0b', 20: '#60a5fa', 60: '#4ade80' }

export default function PriceTab({ state, startDate, sessionId, onTraded }) {
  const { simDate, holdings = [], portfolio } = state
  const [orderTab, setOrderTab] = useState(null) // 'BUY' | 'SELL' | null

  const [companies, setCompanies] = useState([])
  const [selected, setSelected]   = useState(null)
  const [currentPrice, setCurrentPrice] = useState(null)
  const [prevClose, setPrevClose]       = useState(null)

  // 저장된 설정 로드
  const prefs = useRef(loadPrefs())
  const [showMA,   setShowMA]   = useState(prefs.current.showMA)
  const [showBB,   setShowBB]   = useState(prefs.current.showBB)
  const [showIchi, setShowIchi] = useState(prefs.current.showIchi)
  const [showRSI,  setShowRSI]  = useState(prefs.current.showRSI)
  const [showMACD, setShowMACD] = useState(prefs.current.showMACD)
  const [showVol,  setShowVol]  = useState(prefs.current.showVol)

  // 설정 저장 헬퍼
  const persist = (patch) => {
    prefs.current = { ...prefs.current, ...patch }
    savePrefs(prefs.current)
  }

  // DOM refs
  const mainDiv = useRef(null)
  const rsiDiv  = useRef(null)
  const macdDiv = useRef(null)

  // 차트 인스턴스
  const mainChart = useRef(null)
  const rsiChart  = useRef(null)
  const macdChart = useRef(null)

  // 시리즈 refs
  const candleSr  = useRef(null)
  const volSr     = useRef(null)
  const maSr      = useRef({})
  const bbUpperSr = useRef(null)
  const bbLowerSr = useRef(null)
  const ichiSr    = useRef({})
  const rsiSr     = useRef(null)
  const macdSr    = useRef(null)
  const signalSr  = useRef(null)

  const indCache      = useRef([])
  const syncing       = useRef(false)
  const prevSelectedId = useRef(null)

  useEffect(() => {
    getCompanies().then(r => {
      setCompanies(r.data)
      const held = r.data.find(c => holdings.some(h => h.companyId === c.id))
      setSelected(held || r.data[0] || null)
    })
  }, [])

  // ── 메인 차트 초기화 ─────────────────────────────────────
  useEffect(() => {
    if (!mainDiv.current) return
    const chart = createChart(mainDiv.current, BASE_OPTS)

    // 캔들
    candleSr.current = chart.addSeries(CandlestickSeries, {
      upColor, downColor: dnColor,
      borderUpColor: upColor, borderDownColor: dnColor,
      wickUpColor: upColor, wickDownColor: dnColor,
    })

    // 거래량 (메인 차트 하단 15% 영역)
    volSr.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      visible: prefs.current.showVol,
    })
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
      visible: false,
    })

    // MA
    ;[5, 20, 60].forEach(p => {
      maSr.current[p] = chart.addSeries(LineSeries, {
        color: MA_COLORS[p], lineWidth: 1,
        visible: prefs.current.showMA[p],
        priceLineVisible: false, lastValueVisible: false,
      })
    })

    // 볼린저 밴드
    const bbStyle = { lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }
    bbUpperSr.current = chart.addSeries(LineSeries, { ...bbStyle, color: '#8b5cf6', visible: prefs.current.showBB })
    bbLowerSr.current = chart.addSeries(LineSeries, { ...bbStyle, color: '#8b5cf6', visible: prefs.current.showBB })

    // 이치모쿠
    ichiSr.current.tenkan  = chart.addSeries(LineSeries, { color: '#f43f5e', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, visible: prefs.current.showIchi })
    ichiSr.current.kijun   = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, visible: prefs.current.showIchi })
    ichiSr.current.senkouA = chart.addSeries(LineSeries, { color: '#4ade8066', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, visible: prefs.current.showIchi })
    ichiSr.current.senkouB = chart.addSeries(LineSeries, { color: '#f59e0b66', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, visible: prefs.current.showIchi })

    mainChart.current = chart
    return () => { chart.remove(); mainChart.current = null }
  }, [])

  // ── RSI 차트 ──────────────────────────────────────────────
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

  // ── MACD 차트 ─────────────────────────────────────────────
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

  // ── 데이터 로드 ───────────────────────────────────────────
  useEffect(() => {
    if (!selected || !startDate || !simDate || !candleSr.current) return
    const from = chartFrom(startDate)
    Promise.all([
      getPriceHistory(selected.id, from, simDate),
      getIndicators(selected.id, from, simDate),
    ]).then(([priceRes, indRes]) => {
      const candles = priceRes.data.map(p => ({
        time: p.date, open: Number(p.open), high: Number(p.high),
        low: Number(p.low), close: Number(p.close), volume: Number(p.volume),
      }))
      indCache.current = indRes.data

      candleSr.current.setData(candles)

      // 거래량
      volSr.current.setData(candles.map(c => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? upColor + '55' : dnColor + '55',
      })))

      // MA
      ;[5, 20, 60].forEach(p => maSr.current[p]?.setData(calcMA(candles, p)))

      // 볼린저
      const { upper, lower } = calcBB(candles)
      bbUpperSr.current.setData(upper)
      bbLowerSr.current.setData(lower)

      // 이치모쿠
      const iData = {
        tenkan:  indRes.data.filter(i => i.ichimokuTenkan  != null).map(i => ({ time: i.date, value: Number(i.ichimokuTenkan) })),
        kijun:   indRes.data.filter(i => i.ichimokuKijun   != null).map(i => ({ time: i.date, value: Number(i.ichimokuKijun) })),
        senkouA: indRes.data.filter(i => i.ichimokuSenkouA != null).map(i => ({ time: i.date, value: Number(i.ichimokuSenkouA) })),
        senkouB: indRes.data.filter(i => i.ichimokuSenkouB != null).map(i => ({ time: i.date, value: Number(i.ichimokuSenkouB) })),
      }
      Object.entries(iData).forEach(([k, d]) => ichiSr.current[k]?.setData(d))

      // RSI/MACD (패널 열려있을 때)
      if (rsiSr.current) {
        rsiSr.current.setData(indRes.data.filter(i => i.rsi != null).map(i => ({ time: i.date, value: Number(i.rsi) })))
      }
      if (macdSr.current) {
        macdSr.current.setData(indRes.data.filter(i => i.macd != null).map(i => ({ time: i.date, value: Number(i.macd) })))
        signalSr.current.setData(indRes.data.filter(i => i.macdSignal != null).map(i => ({ time: i.date, value: Number(i.macdSignal) })))
      }

      const isCompanyChange = prevSelectedId.current !== selected?.id
      prevSelectedId.current = selected?.id
      if (isCompanyChange) {
        mainChart.current.timeScale().fitContent()
      } else {
        mainChart.current.timeScale().scrollToRealTime()
      }
      const last = priceRes.data[priceRes.data.length - 1] ?? null
      const prev = priceRes.data[priceRes.data.length - 2] ?? null
      setCurrentPrice(last)
      setPrevClose(prev ? Number(prev.close) : null)
    }).catch(() => {})
  }, [selected, simDate, startDate])

  // ── 토글 함수 ─────────────────────────────────────────────
  const toggleMA = (p) => {
    const next = !showMA[p]
    const updated = { ...showMA, [p]: next }
    setShowMA(updated)
    persist({ showMA: updated })
    maSr.current[p]?.applyOptions({ visible: next })
  }
  const toggleBB = () => {
    const next = !showBB
    setShowBB(next); persist({ showBB: next })
    bbUpperSr.current?.applyOptions({ visible: next })
    bbLowerSr.current?.applyOptions({ visible: next })
  }
  const toggleIchi = () => {
    const next = !showIchi
    setShowIchi(next); persist({ showIchi: next })
    Object.values(ichiSr.current).forEach(s => s?.applyOptions({ visible: next }))
  }
  const toggleVol = () => {
    const next = !showVol
    setShowVol(next); persist({ showVol: next })
    volSr.current?.applyOptions({ visible: next })
  }
  const toggleRSI = () => {
    const next = !showRSI
    setShowRSI(next); persist({ showRSI: next })
  }
  const toggleMACD = () => {
    const next = !showMACD
    setShowMACD(next); persist({ showMACD: next })
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
  const closeNum = price ? Number(price.close) : 0
  const dayChgPct = (prevClose && prevClose > 0)
    ? ((closeNum - prevClose) / prevClose) * 100
    : ((price && Number(price.open) > 0) ? ((closeNum - Number(price.open)) / Number(price.open)) * 100 : 0)
  const up = dayChgPct >= 0

  return (
    <div style={s.root}>
      {/* 기업 선택 */}
      <div style={s.companyRow}>
        {companies.map(c => {
          const isSel = selected?.id === c.id
          const held  = holdings.some(h => h.companyId === c.id)
          return (
            <button key={c.id}
              style={{ ...s.chip,
                borderColor: isSel ? '#22c55e' : held ? '#fcd34d' : '#e5e7eb',
                color:       isSel ? '#16a34a' : held ? '#92400e' : '#9ca3af',
              }}
              onMouseDown={e => e.preventDefault()}
              onClick={() => setSelected(c)}>
              {getDisplayTicker(c.ticker, simDate)}{held && <span style={s.dot} />}
            </button>
          )
        })}
      </div>

      {/* 지표 토글 */}
      <div style={s.indRow} className="hide-scrollbar">
        <span style={s.group}>
          <button style={{ ...s.ind, borderColor: showVol ? '#64748b' : '#e5e7eb', color: showVol ? '#475569' : '#9ca3af' }} onMouseDown={e => e.preventDefault()} onClick={toggleVol}>거래량</button>
        </span>
        <div style={s.sep} />
        <span style={s.group}>
          {[5, 20, 60].map(p => (
            <button key={p} style={{ ...s.ind, borderColor: showMA[p] ? MA_COLORS[p] + 'bb' : '#e5e7eb', color: showMA[p] ? MA_COLORS[p] : '#9ca3af' }}
              onMouseDown={e => e.preventDefault()} onClick={() => toggleMA(p)}>MA{p}</button>
          ))}
          <button style={{ ...s.ind, borderColor: showBB ? '#8b5cf6' : '#e5e7eb', color: showBB ? '#7c3aed' : '#9ca3af' }} onMouseDown={e => e.preventDefault()} onClick={toggleBB}>BB</button>
          <button style={{ ...s.ind, borderColor: showIchi ? '#d946ef' : '#e5e7eb', color: showIchi ? '#a21caf' : '#9ca3af' }} onMouseDown={e => e.preventDefault()} onClick={toggleIchi}>일목</button>
        </span>
        <div style={s.sep} />
        <span style={s.group}>
          <button style={{ ...s.ind, borderColor: showRSI ? '#a78bfa' : '#e5e7eb', color: showRSI ? '#7c3aed' : '#9ca3af' }} onMouseDown={e => e.preventDefault()} onClick={toggleRSI}>RSI</button>
          <button style={{ ...s.ind, borderColor: showMACD ? '#60a5fa' : '#e5e7eb', color: showMACD ? '#2563eb' : '#9ca3af' }} onMouseDown={e => e.preventDefault()} onClick={toggleMACD}>MACD</button>
        </span>
      </div>

      {/* 현재가 */}
      {price && (
        <div style={s.priceRow}>
          <span style={{ color: up ? upColor : dnColor, fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>{fmt(price.close)}</span>
          <span style={{ color: up ? upColor : dnColor, fontSize: 12, fontWeight: 600 }}>{up ? '▲' : '▼'} {Math.abs(dayChgPct).toFixed(2)}%</span>
          <span style={{ color: '#9ca3af', fontSize: 11 }}>H {fmt(price.high)} · L {fmt(price.low)} · {fmtNum(price.volume)}</span>
        </div>
      )}

      {/* 메인 차트 */}
      <div ref={mainDiv} style={{ flex: 3, minHeight: 0 }} />

      {/* RSI 패널 */}
      {showRSI && (
        <div style={s.panel}>
          <div style={s.panelHdr}>
            <span style={{ color: '#a78bfa', fontWeight: 700 }}>RSI 14</span>
            <span style={{ color: '#9ca3af' }}>· 70 과매수 / 30 과매도</span>
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

      {/* 매수/매도 버튼 */}
      {selected && (
        <div style={s.tradeRow}>
          <button style={s.buyBtn}  onClick={() => setOrderTab('BUY')}>매수</button>
          <button style={s.sellBtn} onClick={() => setOrderTab('SELL')}>매도</button>
        </div>
      )}

      {/* 바텀시트 주문창 */}
      {orderTab && (
        <OrderBottomSheet
          company={getDisplayCompany(selected, simDate)}
          price={currentPrice}
          portfolio={portfolio}
          holdings={holdings}
          sessionId={sessionId}
          onTraded={onTraded}
          onClose={() => setOrderTab(null)}
          initialTab={orderTab}
        />
      )}
    </div>
  )
}

const s = {
  root:       { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: 6 },
  companyRow: { display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 },
  chip:       { background: '#fff', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', borderRadius: 6, padding: '4px 8px', color: '#9ca3af', fontSize: 11, fontWeight: 700, cursor: 'pointer', position: 'relative', outline: 'none' },
  chipActive: { borderColor: '#22c55e', color: '#16a34a' },
  chipHeld:   { borderColor: '#fcd34d', color: '#92400e' },
  dot:        { position: 'absolute', top: 2, right: 2, width: 4, height: 4, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' },
  indRow:     { display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' },
  group:      { display: 'flex', gap: 4 },
  sep:        { width: 1, height: 12, background: '#e5e7eb' },
  ind:        { background: '#fff', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', borderRadius: 5, padding: '3px 7px', color: '#9ca3af', fontSize: 10, fontWeight: 700, cursor: 'pointer', outline: 'none' },
  volOn:      { borderColor: '#64748b', color: '#475569' },
  bbOn:       { borderColor: '#8b5cf6', color: '#7c3aed' },
  ichiOn:     { borderColor: '#d946ef', color: '#a21caf' },
  rsiOn:      { borderColor: '#a78bfa', color: '#7c3aed' },
  macdOn:     { borderColor: '#60a5fa', color: '#2563eb' },
  priceRow:   { display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 },
  panel:      { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderTop: '1px solid #e5e7eb' },
  panelHdr:   { display: 'flex', gap: 6, alignItems: 'center', padding: '3px 0', fontSize: 10, flexShrink: 0 },
  tradeRow:   { display: 'flex', gap: 8, flexShrink: 0 },
  buyBtn:     { flex: 1, background: '#f43f5e', border: 'none', borderRadius: 8, padding: '12px 0', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', outline: 'none' },
  sellBtn:    { flex: 1, background: '#3b82f6', border: 'none', borderRadius: 8, padding: '12px 0', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', outline: 'none' },
}
