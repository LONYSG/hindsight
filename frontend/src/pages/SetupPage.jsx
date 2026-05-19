import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStartPoints } from '../api/data'
import { startSession } from '../api/play'
import AppHeader from '../components/AppHeader'

const LOGO = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

// 시나리오별 기업 상황 요약 — 당시 시점 기준, 미래 정보 없음
const SCENARIO_CONTEXT = {
  '2020-02-20': [
    { ticker: 'NVDA', name: 'NVIDIA',   logo: LOGO('nvidia.com'),    summary: '게이밍 GPU 시장 선두. RTX 20 시리즈로 레이 트레이싱 기술 선도 중. 4분기 게이밍 매출 회복세로 투자자 기대감 상승.' },
    { ticker: 'AAPL', name: 'Apple',    logo: LOGO('apple.com'),     summary: 'iPhone 11 수요 호조로 실적 서프라이즈. 서비스 매출 성장이 하드웨어 의존도를 낮추는 중. 중국 공급망 관련 우려 제기 시작.' },
    { ticker: 'MSFT', name: 'Microsoft',logo: LOGO('microsoft.com'), summary: 'Azure 클라우드 매출 60%대 성장 지속. 기업용 구독(Office 365) 전환 가속. 분기마다 시장 예상을 상회하는 안정적 실적.' },
    { ticker: 'GOOGL', name: 'Alphabet',logo: LOGO('google.com'),    summary: '검색 광고 시장 점유율 90%대 유지. YouTube 광고 수익 첫 공시. EU 독점 규제 리스크는 여전히 진행 중.' },
    { ticker: 'AMZN', name: 'Amazon',   logo: LOGO('amazon.com'),    summary: 'AWS 클라우드 고성장 지속, 전체 영업이익의 대부분 기여. 이커머스 당일 배송 인프라 확장. 광고 매출이 신성장 동력으로 부상.' },
    { ticker: 'META', name: 'Facebook', logo: LOGO('facebook.com'),  summary: '월간 활성 사용자 26억 명 돌파. 광고 단가 꾸준히 상승 중. FTC·법무부의 반독점 조사 진행 중으로 규제 리스크 상존.' },
    { ticker: 'TSLA', name: 'Tesla',    logo: LOGO('tesla.com'),     summary: '상하이 기가팩토리 1월 가동 시작. 4분기 흑자 전환 성공으로 신뢰 회복. 주가는 연초 이후 이미 두 배 가까이 급등해 공매도 세력과 팽팽한 대치 중.' },
  ],
  '2021-11-01': [
    { ticker: 'NVDA', name: 'NVIDIA',   logo: LOGO('nvidia.com'),    summary: '게이밍·암호화폐 채굴 수요로 GPU 공급 부족 지속. 데이터센터 매출 급증. 밸류에이션 논란 속 주가 사상 최고치 부근.' },
    { ticker: 'AAPL', name: 'Apple',    logo: LOGO('apple.com'),     summary: 'iPhone 13 출시 흥행. 반도체 쇼티지 속에서도 상대적으로 선방. 시총 3조 달러 달성 직전.' },
    { ticker: 'MSFT', name: 'Microsoft',logo: LOGO('microsoft.com'), summary: 'Azure 성장률 50%대 유지. 팀즈(Teams) 기업용 협업 툴 지배력 확대. 나스닥 내 방어주로 평가받는 분위기.' },
    { ticker: 'GOOGL', name: 'Alphabet',logo: LOGO('google.com'),    summary: '광고 시장 회복으로 사상 최대 실적 경신. 유튜브 광고 성장 지속. 클라우드(GCP) 점유율 경쟁 가속.' },
    { ticker: 'AMZN', name: 'Amazon',   logo: LOGO('amazon.com'),    summary: '팬데믹 수혜 둔화로 이커머스 성장 감속 우려. AWS는 고성장 지속. 물류 비용 증가로 수익성 압박.' },
    { ticker: 'META', name: 'Meta',     logo: LOGO('meta.com'),      summary: '사명을 Facebook에서 Meta로 변경. 메타버스 전략 발표로 논란. 광고 매출은 견조하나 틱톡 경쟁 심화.' },
    { ticker: 'TSLA', name: 'Tesla',    logo: LOGO('tesla.com'),     summary: '일론 머스크의 지분 매각 발언으로 주가 변동성 급증. 텍사스·베를린 기가팩토리 가동 준비 중. 인도량은 사상 최고 경신.' },
  ],
  '2023-01-03': [
    { ticker: 'NVDA', name: 'NVIDIA',   logo: LOGO('nvidia.com'),    summary: '2022년 급락에서 반등 시도. 데이터센터 수요 회복 기대. ChatGPT 출시로 AI 인프라 수요가 부각되기 시작.' },
    { ticker: 'AAPL', name: 'Apple',    logo: LOGO('apple.com'),     summary: '중국 생산 차질과 수요 둔화 우려. iPhone 15 사이클 불확실성. 시장 내 방어적 포지션으로 인식.' },
    { ticker: 'MSFT', name: 'Microsoft',logo: LOGO('microsoft.com'), summary: 'OpenAI 파트너십 심화 및 투자 확대 소식. Azure에 ChatGPT 통합 계획 발표. AI 경쟁의 선두 주자로 급부상.' },
    { ticker: 'GOOGL', name: 'Alphabet',logo: LOGO('google.com'),    summary: 'ChatGPT에 검색 시장 주도권을 위협받는다는 위기감 고조. Bard 출시를 서두르는 분위기. 광고 시장 둔화도 지속.' },
    { ticker: 'AMZN', name: 'Amazon',   logo: LOGO('amazon.com'),    summary: '대규모 인력 감축 발표. AWS 성장 둔화 우려. 클라우드 시장 AI 전환 수혜 여부에 시장 관심 집중.' },
    { ticker: 'META', name: 'Meta',     logo: LOGO('meta.com'),      summary: '메타버스 투자 실패 비판 속 대규모 구조조정 단행. "효율의 해" 선언. 주가는 2022년 폭락 이후 저점 부근.' },
    { ticker: 'TSLA', name: 'Tesla',    logo: LOGO('tesla.com'),     summary: '머스크의 트위터 인수로 집중력 분산 비판. 가격 인하 공세로 마진 우려 확대. 중국 경쟁사 BYD와 점유율 경쟁 심화.' },
  ],
}

export default function SetupPage() {
  const navigate = useNavigate()
  const [startPoints, setStartPoints] = useState([])
  const [selectedStartPoint, setSelectedStartPoint] = useState(null)
  const [seedMoney, setSeedMoney] = useState(10000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getStartPoints().then((r) => setStartPoints(r.data))
  }, [])

  const handleStart = async () => {
    if (!selectedStartPoint) {
      setError('시작점을 선택해주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await startSession(selectedStartPoint.id, seedMoney)
      navigate(`/play/${res.data.sessionId}`, {
        state: { initialState: res.data, startDate: selectedStartPoint.startDate }
      })
    } catch (err) {
      setError(err.response?.data?.message || '오류가 발생했습니다.')
      setLoading(false)
    }
  }

  const companyContext = selectedStartPoint
    ? (SCENARIO_CONTEXT[selectedStartPoint.startDate] ?? [])
    : []

  return (
    <div style={s.container}>
      <AppHeader title="새 시뮬레이션" />
      <div style={s.inner}>

        <section style={s.section}>
          <h3 style={s.label}>시나리오 선택</h3>
          <div style={s.cardGrid}>
            {startPoints.map((sp) => (
              <div
                key={sp.id}
                style={{
                  ...(selectedStartPoint?.id === sp.id ? s.cardActive : s.card),
                  ...(!sp.available && s.cardDisabled),
                }}
                onClick={() => sp.available && setSelectedStartPoint(sp)}
              >
                {!sp.available && <span style={s.comingSoon}>준비 중</span>}
                <div style={{ ...s.cardTitle, color: sp.available ? '#111827' : '#9ca3af' }}>{sp.name}</div>
                <div style={s.cardDesc}>{sp.description}</div>
                <div style={s.cardDate}>{sp.startDate}</div>
              </div>
            ))}
          </div>

          {/* 기업별 당시 상황 요약 */}
          {companyContext.length > 0 && (
            <div style={s.contextBox}>
              <div style={s.contextTitle}>당시 M7 기업 상황</div>
              {companyContext.map(c => (
                <div key={c.ticker} style={s.contextRow}>
                  <div style={s.contextHeader}>
                    <img src={c.logo} alt={c.ticker} style={s.contextLogo} onError={e => { e.target.style.display='none' }} />
                    <span style={s.contextTicker}>{c.ticker}</span>
                    <span style={s.contextName}>{c.name}</span>
                  </div>
                  <p style={s.contextSummary}>{c.summary}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={s.section}>
          <h3 style={s.label}>시드머니</h3>
          <div style={s.seedRow}>
            {[1000, 10000, 50000, 100000].map((v) => (
              <button
                key={v}
                style={seedMoney === v ? s.seedActive : s.seed}
                onClick={() => setSeedMoney(v)}
              >
                ${v.toLocaleString()}
              </button>
            ))}
          </div>
        </section>

        {error && <p style={s.error}>{error}</p>}

        <button style={s.startBtn} onClick={handleStart} disabled={loading}>
          {loading ? '시작 중...' : '시뮬레이션 시작 →'}
        </button>
      </div>
    </div>
  )
}

const s = {
  container:    { minHeight: '100vh', background: '#f5f6f8' },
  inner:        { maxWidth: 480, margin: '0 auto', padding: '20px 16px' },
  section:      { marginBottom: 24 },
  label:        { color: '#9ca3af', fontSize: 11, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  cardGrid:     { display: 'flex', gap: 8, flexWrap: 'wrap' },
  card:         { position: 'relative', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px', cursor: 'pointer', flex: '1 1 140px' },
  cardActive:   { position: 'relative', background: '#fff', border: '2px solid #16a34a', borderRadius: 10, padding: '14px', cursor: 'pointer', flex: '1 1 140px' },
  cardDisabled: { cursor: 'default', opacity: 0.6 },
  comingSoon:   { position: 'absolute', top: 8, right: 8, background: '#f3f4f6', color: '#9ca3af', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, letterSpacing: 0.3 },
  cardTitle:    { color: '#111827', fontWeight: 600, fontSize: 14, marginBottom: 5 },
  cardDesc:     { color: '#6b7280', fontSize: 11, marginBottom: 8, lineHeight: 1.5 },
  cardDate:     { color: '#16a34a', fontSize: 11 },

  contextBox:   { marginTop: 16, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' },
  contextTitle: { color: '#9ca3af', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, padding: '12px 14px 8px' },
  contextRow:   { padding: '10px 14px', borderTop: '1px solid #f3f4f6' },
  contextHeader:{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  contextLogo:  { width: 20, height: 20, borderRadius: 4, objectFit: 'contain', flexShrink: 0 },
  contextTicker:{ color: '#111827', fontSize: 13, fontWeight: 700 },
  contextName:  { color: '#9ca3af', fontSize: 11 },
  contextSummary: { color: '#374151', fontSize: 12, lineHeight: 1.7, margin: 0 },

  seedRow:      { display: 'flex', gap: 8, flexWrap: 'wrap' },
  seed:         { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', color: '#9ca3af', cursor: 'pointer', fontSize: 13, flex: '1 1 80px' },
  seedActive:   { background: '#fff', border: '2px solid #16a34a', borderRadius: 8, padding: '10px 14px', color: '#16a34a', cursor: 'pointer', fontSize: 13, fontWeight: 600, flex: '1 1 80px' },
  error:        { color: '#ef4444', fontSize: 13 },
  startBtn:     { width: '100%', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
}
