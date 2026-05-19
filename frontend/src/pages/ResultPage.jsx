import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getResult, getNewsViewThemes } from '../api/play'
import AppHeader from '../components/AppHeader'

const fmt = (n, d = 2) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (r) => { const v = (Number(r ?? 0) * 100); return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` }
const upColor   = '#f43f5e'
const downColor = '#3b82f6'
const rateColor = (v) => Number(v) >= 0 ? upColor : downColor

export default function ResultPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(false)
  const [viewedThemes, setViewedThemes] = useState([])

  useEffect(() => {
    getResult(sessionId)
      .then((r) => setResult(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    getNewsViewThemes(sessionId)
      .then((r) => setViewedThemes(r.data.themes ?? []))
      .catch(() => {})
  }, [sessionId])

  if (loading) return (
    <div style={s.loadingWrap}>
      <div style={s.spinner} />
      <div style={s.loadingText}>결과 계산 중...</div>
    </div>
  )
  if (error || !result) return <div style={s.center}>결과를 불러올 수 없습니다</div>

  const beatMarket  = Number(result.alpha) > 0
  const myReturnNum = Number(result.myReturn)
  const days        = Math.round((new Date(result.endDate) - new Date(result.startDate)) / 86400000)
  const tendencies  = getTendencies(result, days)

  // 수익률 비교: 내 수익률 + NASDAQ + M7 (내림차순)
  const compareItems = buildCompareItems(result)
  const maxAbs = Math.max(...compareItems.filter(it => !it.isDivider).map(it => Math.abs(it.value)), 0.01)

  return (
    <div style={s.root}>

      <AppHeader title="투자 결과 리포트" />

      <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* 서브 헤더 */}
      <div style={s.header}>
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
          <span style={s.alphaLabel}>알파 (vs NASDAQ)</span>
          <span style={{ ...s.alphaValue, color: rateColor(result.alpha) }}>{pct(result.alpha)}</span>
        </div>
        <div style={{ ...s.verdict, color: beatMarket ? upColor : downColor }}>
          {beatMarket ? '🏆 시장을 이겼습니다!' : '📉 시장에 졌습니다'}
        </div>
      </div>

      {/* 수익률 비교 — 0 기준 발산 바 차트 */}
      <div style={s.card}>
        <div style={s.sectionLabel}>수익률 비교</div>
        {compareItems.map(({ key, label, value, isMine, isDivider }) => {
          if (isDivider) return (
            <div key={key} style={s.dividerRow}>
              <div style={s.dividerLine} />
              <span style={s.dividerLabel}>종목별</span>
              <div style={s.dividerLine} />
            </div>
          )
          const halfW = Math.abs(value) / maxAbs * 50  // 전체 너비의 0~50%
          const color = rateColor(value)
          const isPos = value >= 0
          return (
            <div key={key} style={s.barRow}>
              <div style={{ ...s.barLabel, fontWeight: isMine ? 700 : 400, color: isMine ? '#111827' : '#6b7280' }}>{label}</div>
              <div style={s.divergeTrack}>
                {/* 0 기준선 */}
                <div style={{ position: 'absolute', left: '50%', top: 0, height: '100%', width: 1, background: '#d1d5db', zIndex: 1 }} />
                {/* 바 */}
                <div style={{
                  position: 'absolute', top: 0, height: '100%',
                  ...(isPos
                    ? { left: '50%', width: `${halfW}%`, borderRadius: '0 3px 3px 0' }
                    : { right: '50%', width: `${halfW}%`, borderRadius: '3px 0 0 3px' }
                  ),
                  background: color,
                  opacity: isMine ? 1 : 0.55,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ ...s.barValue, color, opacity: isMine ? 1 : 0.8 }}>
                {pct(value)}
              </div>
            </div>
          )
        })}
      </div>

      {/* 투자 성향 유형 */}
      {tendencies.length > 0 && (
        <div style={s.card}>
          <div style={s.sectionLabel}>투자 성향</div>
          <div style={s.tendencyBadges}>
            {tendencies.map(t => (
              <span key={t.label} style={{ ...s.tendencyBadge, background: t.bg, color: t.color, border: `1px solid ${t.color}40` }}>
                {t.label}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            {getTendencyLines(result, days).map((line, i) => (
              <p key={i} style={s.behaviorLine}>• {line}</p>
            ))}
          </div>
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

      {/* 투자 행동 수치 */}
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

      <button style={s.replayBtn} onClick={() => navigate('/setup')}>
        다시 하기
      </button>

      </div>
    </div>
  )
}

function buildCompareItems(result) {
  const items = []

  // 내 수익률 (고정 맨 위)
  items.push({ key: 'me', label: '내 수익률', value: Number(result.myReturn ?? 0), isMine: true })

  // NASDAQ
  items.push({ key: 'nasdaq', label: 'NASDAQ', value: Number(result.nasdaqReturn ?? 0) })

  // 구분선
  items.push({ key: '__divider__', isDivider: true })

  // M7 종목별 (이미 수익률 내림차순 정렬돼서 옴)
  const stocks = result.stockReturns ?? []
  stocks.forEach(st => {
    items.push({ key: st.ticker, label: st.ticker, value: Number(st.returnRate ?? 0) })
  })

  return items
}

function getTendencies(result, days) {
  const mdd          = Number(result.mdd ?? 0)
  const cashRatio    = Number(result.cashRatioAvg ?? 0)
  const tradeCount   = result.tradeCount ?? 0
  const tradesPerWeek = tradeCount / Math.max(days / 7, 1)

  const badges = []

  // 리스크 성향
  if (mdd < 0.15)      badges.push({ label: '안정 추구형', bg: '#f0fdf4', color: '#16a34a' })
  else if (mdd > 0.30) badges.push({ label: '고위험 감수형', bg: '#fff7ed', color: '#ea580c' })

  // 현금 성향
  if (cashRatio >= 0.50)     badges.push({ label: '현금 방어형', bg: '#eff6ff', color: '#2563eb' })
  else if (cashRatio < 0.20) badges.push({ label: '공격 투자형', bg: '#fef2f2', color: '#dc2626' })

  // 매매 스타일
  if (tradesPerWeek >= 3)     badges.push({ label: '단타형', bg: '#fdf4ff', color: '#9333ea' })
  else if (tradesPerWeek < 0.5) badges.push({ label: '장기 보유형', bg: '#f0fdfa', color: '#0d9488' })

  return badges.slice(0, 3)
}

function getTendencyLines(result, days) {
  const mdd          = Number(result.mdd ?? 0)
  const cashRatio    = Number(result.cashRatioAvg ?? 0)
  const tradeCount   = result.tradeCount ?? 0
  const tradesPerWeek = tradeCount / Math.max(days / 7, 1)

  const lines = []

  if (mdd >= 0.25)       lines.push('급락 구간에서 포지션을 오래 유지하는 경향이 있었습니다.')
  else if (mdd >= 0.12)  lines.push('적당한 손실 구간을 감내하며 투자를 이어갔습니다.')
  else                   lines.push('손실을 제한하며 안정적인 리스크 관리를 보여줬습니다.')

  if (cashRatio >= 0.6)       lines.push('현금 비중을 높게 유지하는 보수적인 접근을 선택했습니다.')
  else if (cashRatio >= 0.35) lines.push('현금과 투자를 균형 있게 배분했습니다.')
  else                        lines.push('자산 대부분을 주식에 집중 투자했습니다.')

  if (tradesPerWeek >= 3)      lines.push('잦은 매매로 시장 변동에 민감하게 반응했습니다.')
  else if (tradesPerWeek >= 1) lines.push('필요한 시점에만 선택적으로 거래했습니다.')
  else                         lines.push('장기 보유 성향으로 거래를 최소화했습니다.')

  return lines
}

function InfoRow({ label, value, color, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: last ? 'none' : '1px solid #f3f4f6' }}>
      <span style={{ color: '#6b7280', fontSize: 13 }}>{label}</span>
      <span style={{ color: color || '#374151', fontSize: 13, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

const s = {
  root:         { minHeight: '100vh', background: '#f5f6f8', display: 'flex', flexDirection: 'column' },
  center:       { color: '#9ca3af', textAlign: 'center', marginTop: 100, fontSize: 14 },
  loadingWrap:  { minHeight: '100vh', background: '#f5f6f8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 },
  spinner:      { width: 36, height: 36, border: '3px solid #e5e7eb', borderTop: '3px solid #16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText:  { color: '#6b7280', fontSize: 14, fontWeight: 500 },
  header:       { marginBottom: 4 },
  headerTitle:  { color: '#111827', fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' },
  headerSub:    { color: '#6b7280', fontSize: 12, marginTop: 4 },

  assetCard:    { background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e8eaed' },
  assetRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' },
  assetLabel:   { color: '#6b7280', fontSize: 13 },
  assetValue:   { color: '#111827', fontSize: 16, fontWeight: 600 },

  alphaCard:    { background: '#fff', borderRadius: 12, padding: '20px 16px', border: '1px solid' },
  myReturnRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  myReturnLabel:{ color: '#6b7280', fontSize: 13 },
  myReturnValue:{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px' },
  alphaRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, borderTop: '1px solid #f3f4f6' },
  alphaLabel:   { color: '#6b7280', fontSize: 12 },
  alphaValue:   { fontSize: 20, fontWeight: 700 },
  verdict:      { textAlign: 'center', marginTop: 14, fontSize: 15, fontWeight: 600 },

  card:         { background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e8eaed' },
  sectionLabel: { color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },

  barRow:       { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 },
  barLabel:     { color: '#6b7280', fontSize: 12, width: 58, flexShrink: 0 },
  divergeTrack: { flex: 1, height: 8, position: 'relative', background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  barValue:     { fontSize: 12, fontWeight: 600, width: 56, textAlign: 'right', flexShrink: 0 },

  dividerRow:   { display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' },
  dividerLine:  { flex: 1, height: 1, background: '#f3f4f6' },
  dividerLabel: { color: '#d1d5db', fontSize: 10, whiteSpace: 'nowrap' },

  tendencyBadges: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  tendencyBadge:  { fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20 },
  behaviorLine:   { color: '#6b7280', fontSize: 12, lineHeight: 1.7, margin: '3px 0' },

  themeRow:     { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  themeLabel:   { color: '#6b7280', fontSize: 12, width: 110, flexShrink: 0 },
  themeTrack:   { flex: 1, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  themeFill:    { height: '100%', background: '#6366f1', borderRadius: 3 },
  themeCount:   { color: '#9ca3af', fontSize: 11, width: 28, textAlign: 'right', flexShrink: 0 },

  replayBtn:    { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
}
