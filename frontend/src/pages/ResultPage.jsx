import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getResult, getNewsViewThemes } from '../api/play'
import AppHeader from '../components/AppHeader'

const fmt = (n, d = 2) => '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (r) => { const v = (Number(r ?? 0) * 100); return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` }
const upColor   = '#f43f5e'
const downColor = '#3b82f6'
const rateColor = (v) => Number(v) >= 0 ? upColor : downColor

function shareKakao(result, tendencies, sessionId) {
  if (!window.Kakao?.isInitialized()) return
  const myReturnPct = pct(result.myReturn)
  const alphaPct    = pct(result.alpha)
  const beatMarket  = Number(result.alpha) > 0
  const badge       = tendencies[0]?.label ?? '투자자'
  const title       = beatMarket ? `🏆 시장을 이겼습니다! ${myReturnPct}` : `📉 시장에 졌습니다 ${myReturnPct}`
  const desc        = `알파 ${alphaPct} · 투자 성향: ${badge}\nHindsight에서 당신의 투자 성향을 확인해보세요`
  const resultUrl   = `http://localhost:5173/result/${sessionId}`

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title,
      description: desc,
      imageUrl: 'https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_medium.png',
      link: { mobileWebUrl: resultUrl, webUrl: resultUrl },
    },
    buttons: [
      { title: '결과 보기', link: { mobileWebUrl: resultUrl, webUrl: resultUrl } },
    ],
  })
}

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

  const isOwner     = !!localStorage.getItem('token')
  const beatMarket  = Number(result.alpha) > 0
  const myReturnNum = Number(result.myReturn)
  const days        = Math.round((new Date(result.endDate) - new Date(result.startDate)) / 86400000)
  const tendencies  = getTendencies(result, days)

  // 수익률 비교: 내 수익률 + NASDAQ + M7 (내림차순)
  const compareItems = buildCompareItems(result)
  const maxAbs = Math.max(...compareItems.filter(it => !it.isDivider).map(it => Math.abs(it.value)), 0.01)

  return (
    <div style={s.root}>

      {isOwner
        ? <AppHeader title="투자 결과 리포트" />
        : <div style={s.viewerHeader}><span style={s.viewerTitle}>투자 결과 리포트</span></div>
      }

      <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* 서브 헤더 */}
      <div style={s.header}>
        <div style={s.playerName}>{result.playerName} 님의 투자 기록</div>
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

      {/* 전문가 비교 */}
      {getExperts(result.startDate).length > 0 && (
        <div style={s.card}>
          <div style={s.sectionLabel}>같은 시기 전문 투자자들은?</div>
          <p style={s.expertNote}>{getExpertNote(result.startDate)}</p>
          {getExperts(result.startDate).map(e => (
            <div key={e.name} style={s.expertCard}>
              <div style={s.expertTop}>
                <div style={s.expertLeft}>
                  <span style={s.expertEmoji}>{e.emoji}</span>
                  <div>
                    <div style={s.expertName}>{e.name}</div>
                    <div style={s.expertFund}>{e.fund}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...s.expertReturn, color: rateColor(e.returnValue) }}>{e.returnLabel}</div>
                  <div style={s.expertPeriod}>{e.period}</div>
                </div>
              </div>
              <div style={s.expertStyle}>{e.style}</div>
              <p style={s.expertSummary}>{e.summary}</p>
            </div>
          ))}
        </div>
      )}

      {isOwner ? (
        <>
          <button style={s.shareBtn} onClick={() => shareKakao(result, tendencies, sessionId)}>
            <img src="https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_small.png"
              alt="" style={{ width: 18, marginRight: 8 }} />
            카카오톡으로 결과 공유하기
          </button>
          <button style={s.replayBtn} onClick={() => navigate('/setup')}>
            다시 하기
          </button>
        </>
      ) : (
        <button style={s.replayBtn} onClick={() => navigate('/login')}>
          나도 해보기 →
        </button>
      )}

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

const EXPERT_DATA = {
  '2020': {
    note: '참고: 2020년 연간 기준 공개 데이터',
    experts: [
      {
        name: '워런 버핏',
        fund: 'Berkshire Hathaway',
        emoji: '🏦',
        returnLabel: '+2.4%',
        returnValue: 0.024,
        period: '2020년 연간',
        style: '가치 투자 · 장기 보유',
        summary: '코로나 급락에서 "아직 매수할 게 없다"며 현금을 비축. 항공주를 전량 손절하고 실수를 공개 인정. 시장 대비 크게 언더퍼폼했지만 장기 원칙은 고수했다.',
      },
      {
        name: '캐시 우드',
        fund: 'ARK Innovation (ARKK)',
        emoji: '🚀',
        returnLabel: '+156%',
        returnValue: 1.56,
        period: '2020년 연간',
        style: '혁신 성장 투자 · 고위험',
        summary: '급락 구간에서 테슬라·줌·텔라닥을 공격적으로 매수. "5년 후를 보라"며 단기 변동성을 무시했다. 2020년 최고 성과 펀드 중 하나로 이름을 알렸다.',
      },
      {
        name: '레이 달리오',
        fund: 'Bridgewater All Weather',
        emoji: '🌐',
        returnLabel: '-12%',
        returnValue: -0.12,
        period: '2020년 연간',
        style: '거시 분산 투자',
        summary: '"현금은 쓰레기"를 외치며 분산 원칙을 고수했지만, All Weather 전략도 코로나 급락은 피하지 못했다. 위기 초반 낙관론을 고수해 비판을 받았다.',
      },
    ],
  },
  '2021': {
    note: '참고: 2022년 연간 기준 공개 데이터 (연준 금리인상 사이클)',
    experts: [
      {
        name: '워런 버핏',
        fund: 'Berkshire Hathaway',
        emoji: '🏦',
        returnLabel: '+4.0%',
        returnValue: 0.04,
        period: '2022년 연간',
        style: '가치 투자 · 에너지 집중',
        summary: 'S&P500이 -18% 폭락하는 동안 +4% 방어. 쉐브론·옥시덴탈에 수백억 달러를 집중 매수. "금리가 오르면 가치주가 빛난다"는 원칙이 정확히 맞아떨어졌다.',
      },
      {
        name: '레이 달리오',
        fund: 'Bridgewater Pure Alpha',
        emoji: '🌐',
        returnLabel: '+32%',
        returnValue: 0.32,
        period: '2022년 연간',
        style: '거시 헤지 · 채권 공매도',
        summary: '2020년 All Weather로 손실을 봤지만 Pure Alpha 펀드로 설욕. 인플레이션 초기부터 채권 공매도·원자재 롱 포지션을 구축해 금리 인상 사이클을 정확히 공략했다.',
      },
      {
        name: '캐시 우드',
        fund: 'ARK Innovation (ARKK)',
        emoji: '🚀',
        returnLabel: '-67%',
        returnValue: -0.67,
        period: '2022년 연간',
        style: '혁신 성장 투자',
        summary: '2020년 +156%의 영웅이 2022년 최대 피해자로. 금리 상승이 고성장·고밸류 기술주에 직격탄을 날렸다. 테슬라·줌·코인베이스를 끝까지 보유하며 "장기 혁신의 가치"를 주장했다.',
      },
    ],
  },
  '2023': {
    note: '참고: 2023년 연간 기준 공개 데이터 (AI 혁명 원년)',
    experts: [
      {
        name: '캐시 우드',
        fund: 'ARK Innovation (ARKK)',
        emoji: '🚀',
        returnLabel: '+68%',
        returnValue: 0.68,
        period: '2023년 연간',
        style: '혁신 성장 투자',
        summary: '2022년 -67% 참패 이후 극적인 반등. AI·혁신 기술주 중심 포트폴리오가 부활했다. 2022년 내내 "혁신의 가치는 변하지 않는다"며 버텼던 것이 결실을 맺었다.',
      },
      {
        name: '워런 버핏',
        fund: 'Berkshire Hathaway',
        emoji: '🏦',
        returnLabel: '+15.8%',
        returnValue: 0.158,
        period: '2023년 연간',
        style: '가치 투자 · AI 무관심',
        summary: 'S&P500(+26%)보다 낮은 수익률. AI 관련 기업을 직접 편입하지 않았지만, 포트폴리오의 50%를 차지한 애플이 AI 수혜주로 부상하며 수익을 견인했다.',
      },
      {
        name: '마이클 버리',
        fund: 'Scion Asset Management',
        emoji: '🐻',
        returnLabel: '손실 (추정)',
        returnValue: -0.15,
        period: '2023년',
        style: '역발상 공매도',
        summary: '2008년 금융위기를 예측한 "빅쇼트"가 AI 랠리에서 틀렸다. 2023년 중반 S&P500·나스닥 풋옵션을 대규모로 매수했지만 시장은 계속 올랐다. 전설도 AI의 파괴력을 과소평가했다.',
      },
    ],
  },
}

function getExperts(startDate) {
  if (!startDate) return []
  if (startDate >= '2020-01-01' && startDate <= '2020-12-31') return EXPERT_DATA['2020'].experts
  if (startDate >= '2021-01-01' && startDate <= '2022-12-31') return EXPERT_DATA['2021'].experts
  if (startDate >= '2023-01-01' && startDate <= '2024-12-31') return EXPERT_DATA['2023'].experts
  return []
}

function getExpertNote(startDate) {
  if (!startDate) return ''
  if (startDate >= '2020-01-01' && startDate <= '2020-12-31') return EXPERT_DATA['2020'].note
  if (startDate >= '2021-01-01' && startDate <= '2022-12-31') return EXPERT_DATA['2021'].note
  if (startDate >= '2023-01-01' && startDate <= '2024-12-31') return EXPERT_DATA['2023'].note
  return ''
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
  playerName:   { color: '#111827', fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 4 },
  headerSub:    { color: '#9ca3af', fontSize: 12 },

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

  viewerHeader: { position: 'sticky', top: 0, zIndex: 100, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderBottom: '1px solid #f0f0f0', flexShrink: 0 },
  viewerTitle:  { color: '#111827', fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px' },
  shareBtn:     { width: '100%', background: '#FEE500', color: '#000000CC', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  replayBtn:    { width: '100%', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 },

  expertNote:   { color: '#9ca3af', fontSize: 11, marginBottom: 12, marginTop: -4 },
  expertCard:   { paddingTop: 14, paddingBottom: 14, borderBottom: '1px solid #f3f4f6' },
  expertTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  expertLeft:   { display: 'flex', alignItems: 'center', gap: 10 },
  expertEmoji:  { fontSize: 26, lineHeight: 1 },
  expertName:   { color: '#111827', fontSize: 14, fontWeight: 700 },
  expertFund:   { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  expertReturn: { fontSize: 16, fontWeight: 700 },
  expertPeriod: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  expertStyle:  { display: 'inline-block', background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20, marginBottom: 8 },
  expertSummary:{ color: '#374151', fontSize: 12, lineHeight: 1.7, margin: 0 },
}
