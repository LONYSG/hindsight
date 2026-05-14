import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getPriceHistory } from '../api/data'

const fmt = (n) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum = (n) => Number(n ?? 0).toLocaleString('en-US')
const upColor = '#f43f5e'
const downColor = '#3b82f6'

export default function PriceTab({ state, companyId, startDate }) {
  const { simDate, price } = state
  const [history, setHistory] = useState([])
  const up = Number(price.changeRate) >= 0
  const lineColor = up ? upColor : downColor

  useEffect(() => {
    if (!companyId || !startDate || !simDate) return
    getPriceHistory(companyId, startDate, simDate)
      .then((r) => {
        const data = r.data.map((p) => ({ date: p.date, close: Number(p.close) }))
        setHistory(data)
      })
      .catch(() => setHistory([]))
  }, [simDate, companyId, startDate])

  const closes = history.map((h) => h.close)
  const minClose = closes.length ? Math.min(...closes) * 0.995 : 0
  const maxClose = closes.length ? Math.max(...closes) * 1.005 : 0

  return (
    <div style={s.root}>
      {/* 현재가 */}
      <div style={s.priceRow}>
        <span style={{ ...s.closePrice, color: lineColor }}>{fmt(price.close)}</span>
        <span style={{ ...s.changeRate, color: lineColor }}>
          {up ? '▲' : '▼'} {Math.abs(Number(price.changeRate) * 100).toFixed(2)}%
        </span>
      </div>

      {/* OHLV */}
      <div style={s.ohlv}>
        <OhlvItem label="시가" value={fmt(price.open)} />
        <OhlvItem label="고가" value={fmt(price.high)} color={upColor} />
        <OhlvItem label="저가" value={fmt(price.low)} color={downColor} />
        <OhlvItem label="거래량" value={fmtNum(price.volume)} />
      </div>

      {/* 차트 */}
      <div style={s.chartWrap}>
        {history.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={lineColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: '#555', fontSize: 10 }}
                tickFormatter={(d) => d.slice(5)}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[minClose, maxClose]}
                tick={{ fill: '#555', fontSize: 10 }}
                tickFormatter={(v) => `$${v.toFixed(1)}`}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: '#888' }}
                itemStyle={{ color: '#e8e8e8' }}
                formatter={(v) => [`$${Number(v).toFixed(2)}`, '종가']}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={1.5}
                fill="url(#priceGrad)"
                dot={false}
                activeDot={{ r: 3, fill: lineColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={s.chartEmpty}>차트 로딩 중...</div>
        )}
      </div>
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
  root:       { display: 'flex', flexDirection: 'column', height: '100%', gap: 14 },
  priceRow:   { display: 'flex', alignItems: 'baseline', gap: 10 },
  closePrice: { fontSize: 34, fontWeight: 700, letterSpacing: '-0.5px' },
  changeRate: { fontSize: 15, fontWeight: 600 },
  ohlv:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 0', background: '#161616', borderRadius: 10, padding: '12px 14px' },
  ohlvItem:   { display: 'flex', justifyContent: 'space-between', paddingRight: 12, alignItems: 'center' },
  ohlvLabel:  { color: '#666', fontSize: 12 },
  chartWrap:  { flex: 1, minHeight: 180 },
  chartEmpty: { color: '#444', textAlign: 'center', paddingTop: 60, fontSize: 13 },
}
