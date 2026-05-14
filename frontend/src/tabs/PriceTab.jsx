import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getPriceHistory } from '../api/data'

const fmt = (n) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum = (n) => Number(n ?? 0).toLocaleString('en-US')
const priceColor = (v) => (Number(v) >= 0 ? '#ef4444' : '#3b82f6')

export default function PriceTab({ state, companyId, startDate }) {
  const { simDate, price } = state
  const [history, setHistory] = useState([])
  const up = Number(price.changeRate) >= 0

  useEffect(() => {
    getPriceHistory(companyId, startDate, simDate).then((r) => {
      setHistory(r.data.map((p) => ({ date: p.date, close: Number(p.close) })))
    })
  }, [simDate, companyId, startDate])

  const minClose = history.length ? Math.min(...history.map((h) => h.close)) * 0.98 : 0
  const maxClose = history.length ? Math.max(...history.map((h) => h.close)) * 1.02 : 0

  return (
    <div style={s.root}>
      {/* 현재가 */}
      <div style={s.priceRow}>
        <span style={{ ...s.closePrice, color: priceColor(price.changeRate) }}>
          {fmt(price.close)}
        </span>
        <span style={{ ...s.changeRate, color: priceColor(price.changeRate) }}>
          {up ? '▲' : '▼'} {Math.abs(Number(price.changeRate) * 100).toFixed(2)}%
        </span>
      </div>

      {/* OHLV */}
      <div style={s.ohlv}>
        <OhlvItem label="시가" value={fmt(price.open)} />
        <OhlvItem label="고가" value={fmt(price.high)} color="#ef4444" />
        <OhlvItem label="저가" value={fmt(price.low)} color="#3b82f6" />
        <OhlvItem label="거래량" value={fmtNum(price.volume)} />
      </div>

      {/* 차트 */}
      <div style={s.chartWrap}>
        {history.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={up ? '#ef4444' : '#3b82f6'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={up ? '#ef4444' : '#3b82f6'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: '#444', fontSize: 10 }}
                tickFormatter={(d) => d.slice(5)} // MM-DD만 표시
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[minClose, maxClose]}
                tick={{ fill: '#444', fontSize: 10 }}
                tickFormatter={(v) => `$${v.toFixed(1)}`}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: '#888' }}
                itemStyle={{ color: '#fff' }}
                formatter={(v) => [`$${Number(v).toFixed(2)}`, '종가']}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={up ? '#ef4444' : '#3b82f6'}
                strokeWidth={1.5}
                fill="url(#priceGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={s.chartEmpty}>차트 데이터 로딩 중...</div>
        )}
      </div>
    </div>
  )
}

function OhlvItem({ label, value, color }) {
  return (
    <div style={s.ohlvItem}>
      <span style={s.ohlvLabel}>{label}</span>
      <span style={{ ...s.ohlvValue, color: color || '#ccc' }}>{value}</span>
    </div>
  )
}

const s = {
  root:       { display: 'flex', flexDirection: 'column', height: '100%', gap: 16 },
  priceRow:   { display: 'flex', alignItems: 'baseline', gap: 12 },
  closePrice: { fontSize: 36, fontWeight: 700 },
  changeRate: { fontSize: 16, fontWeight: 600 },
  ohlv:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 0', background: '#111', borderRadius: 8, padding: '12px 16px' },
  ohlvItem:   { display: 'flex', justifyContent: 'space-between', paddingRight: 16 },
  ohlvLabel:  { color: '#555', fontSize: 12 },
  ohlvValue:  { fontSize: 13, fontWeight: 500 },
  chartWrap:  { flex: 1, minHeight: 0 },
  chartEmpty: { color: '#444', textAlign: 'center', paddingTop: 40, fontSize: 13 },
}
