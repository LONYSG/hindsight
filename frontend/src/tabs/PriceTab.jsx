import { useEffect, useRef, useState } from 'react'
import { createChart } from 'lightweight-charts'
import { getPriceHistory } from '../api/data'

const fmt = (n) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum = (n) => Number(n ?? 0).toLocaleString('en-US')
const upColor = '#f43f5e'
const dnColor = '#3b82f6'

export default function PriceTab({ state, companyId, startDate }) {
  const { simDate, price } = state
  const chartRef = useRef(null)
  const chartInstance = useRef(null)
  const seriesRef = useRef(null)
  const [ready, setReady] = useState(false)
  const up = Number(price.changeRate) >= 0

  // 차트 초기화 (마운트 시 1회)
  useEffect(() => {
    if (!chartRef.current) return

    const chart = createChart(chartRef.current, {
      layout: {
        background: { color: '#0f0f0f' },
        textColor: '#666',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        vertLine: { color: '#333' },
        horzLine: { color: '#333' },
      },
      rightPriceScale: {
        borderColor: '#1a1a1a',
        textColor: '#666',
      },
      timeScale: {
        borderColor: '#1a1a1a',
        timeVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    })

    const series = chart.addCandlestickSeries({
      upColor,
      downColor: dnColor,
      borderUpColor: upColor,
      borderDownColor: dnColor,
      wickUpColor: upColor,
      wickDownColor: dnColor,
    })

    chartInstance.current = chart
    seriesRef.current = series
    setReady(true)

    // 컨테이너 크기 변화 대응
    const observer = new ResizeObserver(() => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth })
      }
    })
    observer.observe(chartRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
    }
  }, [])

  // 데이터 로드 (날짜 바뀔 때마다)
  useEffect(() => {
    if (!ready || !seriesRef.current) return
    if (!companyId || !startDate || !simDate) return

    getPriceHistory(companyId, startDate, simDate)
      .then((r) => {
        const candles = r.data.map((p) => ({
          time:  p.date,
          open:  Number(p.open),
          high:  Number(p.high),
          low:   Number(p.low),
          close: Number(p.close),
        }))
        seriesRef.current.setData(candles)
        chartInstance.current.timeScale().fitContent()
      })
      .catch(() => {})
  }, [ready, simDate, companyId, startDate])

  return (
    <div style={s.root}>
      {/* 현재가 */}
      <div style={s.priceRow}>
        <span style={{ ...s.closePrice, color: up ? upColor : dnColor }}>{fmt(price.close)}</span>
        <span style={{ color: up ? upColor : dnColor, fontSize: 15, fontWeight: 600 }}>
          {up ? '▲' : '▼'} {Math.abs(Number(price.changeRate) * 100).toFixed(2)}%
        </span>
      </div>

      {/* OHLV */}
      <div style={s.ohlv}>
        <OhlvItem label="시가" value={fmt(price.open)} />
        <OhlvItem label="고가" value={fmt(price.high)} color={upColor} />
        <OhlvItem label="저가" value={fmt(price.low)} color={dnColor} />
        <OhlvItem label="거래량" value={fmtNum(price.volume)} />
      </div>

      {/* 캔들 차트 */}
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
  root:      { display: 'flex', flexDirection: 'column', height: '100%', gap: 14 },
  priceRow:  { display: 'flex', alignItems: 'baseline', gap: 10 },
  closePrice:{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.5px' },
  ohlv:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 0', background: '#161616', borderRadius: 10, padding: '12px 14px' },
  ohlvItem:  { display: 'flex', justifyContent: 'space-between', paddingRight: 12, alignItems: 'center' },
  ohlvLabel: { color: '#666', fontSize: 12 },
  chartWrap: { flex: 1, minHeight: 200 },
}
