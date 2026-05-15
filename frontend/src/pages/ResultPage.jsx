import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getResult, getNewsViewThemes } from '../api/play'

const fmt = (n, d = 2) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (r) => { const v = (Number(r ?? 0) * 100); return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` }
const upColor   = '#f43f5e'
const downColor = '#3b82f6'
const rateColor = (v) => Number(v) >= 0 ? upColor : downColor

const BENCHMARKS = [
  { key: 'myReturn',     label: '내 수익률',  isMine: true },
  { key: 'stockReturn',  label: 'NVDA' },
  { key: 'nasdaqReturn', label: 'NASDAQ' },
  { key: 'sp500Return',  label: 'S&P 500' },
]

export default function ResultPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewedThemes, setViewedThemes] = useState([])

  useEffect(() => {
    getResult(sessionId)
      .then((r) => setResult(r.data))
      .finally(() => setLoading(false))
    getNewsViewThemes(sessionId)
      .then((r) => setViewedThemes(r.data.themes ?? []))
      .catch(() => {})
  }, [sessionId])

  if (loading) return <div style={s.center}>결과 계산 중...</div>
  if (!result)  return <div style={s.center}>결과를 불러올 수 없습니다</div>

  const beatMarket = Number(result.alpha) > 0
  const myReturnNum = Number(result.myReturn)
  const alphaNum    = Number(result.alpha)

  const behaviorText = getBehaviorText(result)

  // 비교 차트용 최대 절댓값
  const allRates = BENCHMARKS.map(b => Math.abs(Number(result[b.key] ?? 0)))
  const maxAbs   = Math.max(...allRates, 0.01)

  const days = Math.round((new Date(result.endDate) - new Date(result.startDate)) / 86400000)

  return (
    <div style={s.root}>

      {/* 헤더 */}
      <div style={s.header}>
        <div style={s.headerTitle}>게임 결과</div>
        <div style={s.headerSub}>{result.startDate} → {result.endDate} ({days}일)</div>
      </div>

      {/* 최종 자산 */}
      <div style={s.assetCard}>
        <div style={s.assetRow}>
          <span style={s.assetLabel}>시드머니</span>
          <span style={s.assetValue}>{fmt(result.seedMoney)}</span>
        </div>
        <div style={s.assetRow}>
          <span style={s.assetLabel}>최종 자산</span>
          <span style={{ ...s.assetValue, color: rateColor(result.myReturn), fontSize: 22 }}>{fmt(result.finalValue)}</span>
        </div>
      </div>

      {/* 알파 메인 카드 */}
      <div style={{ ...s.alphaCard, borderColor: beatMarket ? upColor + '44' : downColor + '44' }}>
        <div style={s.myReturnRow}>
          <span style={s.myReturnLabel}>내 수익률</span>
          <span style={{ ...s.myReturnValue, color: rateColor(result.myReturn) }}>{pct(result.myReturn)}</span>
        </div>
        <div style={s.alphaRow}>
          <span style={s.alphaLabel}>알파 (vs S&P500)</span>
          <span style={{ ...s.alphaValue, color: rateColor(result.alpha) }}>{pct(result.alpha)}</span>
        </div>
        <div style={{ ...s.verdict, color: beatMarket ? upColor : downColor }}>
          {beatMarket ? '🏆 시장을 이겼습니다!' : '📉 시장에 졌습니다'}
        </div>
      </div>

      {/* 수익률 비교 바 차트 */}
      <div style={s.card}>
        <div style={s.sectionLabel}>수익률 비교</div>
        {BENCHMARKS.map(({ key, label, isMine }) => {
          const val    = Number(result[key] ?? 0)
          const barW   = Math.abs(val) / maxAbs * 100
          const color  = isMine
            ? (val >= 0 ? upColor : downColor)
            : '#444'
          return (
            <div key={key} style={s.barRow}>
              <div style={s.barLabel}>{label}</div>
              <div style={s.barTrack}>
                <div style={{ ...s.barFill, width: `${barW}%`, background: color }} />
              </div>
              <div style={{ ...s.barValue, color: isMine ? rateColor(val) : '#888' }}>
                {pct(result[key])}
              </div>
            </div>
          )
        })}
      </div>

      {/* 투자 성향 텍스트 */}
      {result.mdd != null && (
        <div style={s.card}>
          <div style={s.sectionLabel}>당신의 투자 스타일</div>
          {behaviorText.map((line, i) => (
            <p key={i} style={s.behaviorLine}>• {line}</p>
          ))}
        </div>
      )}

      {/* 뉴스 소비 테마 */}
      {viewedThemes.length > 0 && (
        <div style={s.card}>
          <div style={s.sectionLabel}>주로 조회한 뉴스 테마</div>
          {viewedThemes.map(({ theme, count }, i) => {
            const maxCount = viewedThemes[0].count
            const barW = Math.round(count / maxCount * 100)
            return (
              <div key={theme} style={s.themeRow}>
                <span style={s.themeLabel}>{theme}</span>
                <div style={s.themeTrack}>
                  <div style={{ ...s.themeFill, width: `${barW}%`, opacity: 1 - i * 0.15 }} />
                </div>
                <span style={s.themeCount}>{count}회</span>
              </div>
            )
          })}
        </div>
      )}

      {/* 부가 정보 */}
      <div style={s.card}>
        <div style={s.sectionLabel}>투자 행동 분석</div>
        <InfoRow label="최대 낙폭 (MDD)"
          value={result.mdd != null ? `-${(Number(result.mdd) * 100).toFixed(2)}%` : '-'}
          color={Number(result.mdd) > 0.2 ? downColor : Number(result.mdd) > 0.1 ? '#f59e0b' : '#4ade80'}
        />
        <InfoRow label="평균 현금 비율"
          value={result.cashRatioAvg != null ? `${(Number(result.cashRatioAvg) * 100).toFixed(1)}%` : '-'}
        />
        <InfoRow label="총 거래 횟수"  value={`${result.tradeCount}회`} />
        <InfoRow label="플레이 기간"   value={`${days}일`} last />
      </div>

      {/* 버튼 */}
      <button style={s.replayBtn} onClick={() => navigate('/setup')}>
        다시 하기
      </button>

    </div>
  )
}

function getBehaviorText(result) {
  const mdd         = Number(result.mdd ?? 0)
  const cashRatio   = Number(result.cashRatioAvg ?? 0)
  const tradeCount  = result.tradeCount ?? 0
  const days        = Math.round((new Date(result.endDate) - new Date(result.startDate)) / 86400000)
  const tradesPerWeek = tradeCount / (days / 7)

  const lines = []

  if (mdd >= 0.25)       lines.push('급락 구간에서 포지션을 오래 유지하는 경향이 있었습니다.')
  else if (mdd >= 0.12)  lines.push('적당한 손실 구간을 감내하며 투자를 이어갔습니다.')
  else                   lines.push('손실을 제한하며 안정적인 리스크 관리를 보여줬습니다.')

  if (cashRatio >= 0.6)       lines.push('현금 비중을 높게 유지하는 보수적인 접근을 선택했습니다.')
  else if (cashRatio >= 0.35) lines.push('현금과 투자를 균형 있게 배분했습니다.')
  else                        lines.push('자산 대부분을 주식에 집중 투자했습니다.')

  if (tradesPerWeek >= 3)       lines.push('잦은 매매로 시장 변동에 민감하게 반응했습니다.')
  else if (tradesPerWeek >= 1)  lines.push('필요한 시점에만 선택적으로 거래했습니다.')
  else                          lines.push('장기 보유 성향으로 거래를 최소화했습니다.')

  return lines
}

function InfoRow({ label, value, color, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: last ? 'none' : '1px solid #1e1e1e' }}>
      <span style={{ color: '#666', fontSize: 13 }}>{label}</span>
      <span style={{ color: color || '#bbb', fontSize: 13, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

const s = {
  root:         { minHeight: '100vh', background: '#0f0f0f', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  center:       { color: '#888', textAlign: 'center', marginTop: 100, fontSize: 14 },
  header:       { marginBottom: 4 },
  headerTitle:  { color: '#e8e8e8', fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' },
  headerSub:    { color: '#555', fontSize: 12, marginTop: 4 },

  assetCard:    { background: '#161616', borderRadius: 12, padding: '16px' },
  assetRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' },
  assetLabel:   { color: '#666', fontSize: 13 },
  assetValue:   { color: '#e8e8e8', fontSize: 16, fontWeight: 600 },

  alphaCard:    { background: '#161616', borderRadius: 12, padding: '20px 16px', border: '1px solid' },
  myReturnRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  myReturnLabel:{ color: '#888', fontSize: 13 },
  myReturnValue:{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px' },
  alphaRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, borderTop: '1px solid #252525' },
  alphaLabel:   { color: '#666', fontSize: 12 },
  alphaValue:   { fontSize: 20, fontWeight: 700 },
  verdict:      { textAlign: 'center', marginTop: 14, fontSize: 15, fontWeight: 600 },

  card:         { background: '#161616', borderRadius: 12, padding: '16px' },
  sectionLabel: { color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },

  barRow:       { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel:     { color: '#888', fontSize: 12, width: 60, flexShrink: 0 },
  barTrack:     { flex: 1, height: 8, background: '#252525', borderRadius: 4, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 4, transition: 'width 0.6s ease' },
  barValue:     { fontSize: 13, fontWeight: 600, width: 60, textAlign: 'right', flexShrink: 0 },

  infoRow:      { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e1e1e' },
  infoLabel:    { color: '#666', fontSize: 13 },
  infoValue:    { color: '#bbb', fontSize: 13, fontWeight: 500 },

  replayBtn:    { background: '#4ade80', color: '#000', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
  behaviorLine: { color: '#aaa', fontSize: 13, lineHeight: 1.7, margin: '4px 0' },
  themeRow:     { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  themeLabel:   { color: '#888', fontSize: 12, width: 110, flexShrink: 0 },
  themeTrack:   { flex: 1, height: 6, background: '#252525', borderRadius: 3, overflow: 'hidden' },
  themeFill:    { height: '100%', background: '#6366f1', borderRadius: 3 },
  themeCount:   { color: '#555', fontSize: 11, width: 28, textAlign: 'right', flexShrink: 0 },
}
