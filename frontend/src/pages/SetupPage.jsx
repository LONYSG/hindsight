import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStartPoints } from '../api/data'
import { startSession } from '../api/play'
import AppHeader from '../components/AppHeader'

const LOGO = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

const SCENARIO_META = {
  '2020-02-03': {
    period: '2020.02 – 2021.10',
    tags: ['공급망', '글로벌 경기', '중앙은행'],
    accent: '#16a34a', bg: '#f0fdf4',
  },
  '2021-11-01': {
    period: '2021.11 – 2022.12',
    tags: ['연준 정책', '인플레이션', '금리'],
    accent: '#f97316', bg: '#fff7ed',
  },
  '2023-01-03': {
    period: '2023.01 – 2024.12',
    tags: ['AI 기술', '반도체', '클라우드'],
    accent: '#3b82f6', bg: '#eff6ff',
  },
}

// CAGR 기준 기간: 시나리오 시작일 기준 직전 3년
const SCENARIO_CONTEXT = {
  '2020-02-03': {
    cagrPeriod: '2017–2020',
    companies: [
      { ticker: 'NVDA', name: 'NVIDIA',    logo: LOGO('nvidia.com'),
        price: '$240', cagr: '+34%',
        summary: '게이밍 GPU 시장 선두. RTX 20 시리즈 출시 1년차, 레이 트레이싱 기술 선도. 4분기 매출 $3.1B(YoY +41%). 데이터센터 매출이 처음으로 게이밍을 위협하기 시작.' },
      { ticker: 'AAPL', name: 'Apple',     logo: LOGO('apple.com'),
        price: '$323', cagr: '+40%',
        summary: 'iPhone 11 출시 5개월, 수요 호조로 실적 서프라이즈. 서비스 매출 연간 $46B(YoY +16%)로 하드웨어 의존도 낮추는 중. 중국 매출 비중 약 17%, 공급망 관련 우려 제기 시작.' },
      { ticker: 'MSFT', name: 'Microsoft', logo: LOGO('microsoft.com'),
        price: '$187', cagr: '+45%',
        summary: 'Azure 클라우드 성장률 62%(FY2020 Q2). 전체 매출 중 클라우드 비중 33% 돌파. Office 365 기업 구독 전환 가속, 분기마다 시장 예상 상회하는 안정적 실적 행진.' },
      { ticker: 'GOOGL', name: 'Alphabet', logo: LOGO('google.com'),
        price: '$1,523', cagr: '+24%',
        summary: '검색 광고 점유율 92% 유지. YouTube 광고 수익 첫 단독 공시($15.1B/연). 광고 매출 YoY +18%. EU 반독점 규제 리스크는 여전히 진행형.' },
      { ticker: 'AMZN', name: 'Amazon',   logo: LOGO('amazon.com'),
        price: '$2,009', cagr: '+39%',
        summary: 'AWS 분기 매출 $9.95B(YoY +34%), 전체 영업이익의 67% 기여. 이커머스 당일·익일 배송 확대. 광고 매출 $4.8B(YoY +41%)로 구글·페이스북에 이은 3위 부상.' },
      { ticker: 'FB',  name: 'Facebook', logo: LOGO('facebook.com'),
        price: '$222', cagr: '+24%',
        summary: '월간 활성 사용자 25억 명 돌파. 광고 단가 YoY +8%. 4분기 매출 $21.1B(YoY +25%). FTC·법무부의 반독점 조사 진행 중.' },
      { ticker: 'TSLA',  name: 'Tesla',    logo: LOGO('tesla.com'),
        price: '$791', cagr: '+54%',
        summary: '상하이 기가팩토리 1월 가동 시작. 4분기 최초 흑자 전환($105M). 연간 인도량 36.7만 대. 강성 공매도 세력과 대치 중, S&P500 편입 여부가 시장 관심사.' },
    ],
  },
  '2021-11-01': {
    cagrPeriod: '2018–2021',
    companies: [
      { ticker: 'NVDA', name: 'NVIDIA',    logo: LOGO('nvidia.com'),
        price: '$297', cagr: '+85%',
        summary: '게이밍·데이터센터 동반 급성장. GPU 공급 부족 심각. 데이터센터 분기 매출 $2.9B(YoY +55%). 멜라녹스 인수 효과 본격화. P/E 80x 수준의 높은 밸류에이션.' },
      { ticker: 'AAPL', name: 'Apple',     logo: LOGO('apple.com'),
        price: '$150', cagr: '+47%',
        summary: 'iPhone 13 출시 흥행, 반도체 쇼티지 속 상대적 선방. 서비스 매출 분기 $18.3B(YoY +26%). 시총 $2.5T로 글로벌 최대 기업. M1 칩 전환 가속.' },
      { ticker: 'MSFT', name: 'Microsoft', logo: LOGO('microsoft.com'),
        price: '$330', cagr: '+51%',
        summary: 'Azure 성장률 50% 유지. Teams 월간 활성 사용자 2.5억 명. FY2022 Q1 매출 $45.3B(YoY +22%). Nuance 인수($19.7B)로 의료 AI 진출.' },
      { ticker: 'GOOGL', name: 'Alphabet', logo: LOGO('google.com'),
        price: '$2,977', cagr: '+33%',
        summary: '광고 시장 회복으로 3분기 매출 $65.1B(YoY +41%) 사상 최대. YouTube 광고 $7.2B/분기. GCP 성장률 45% 유지. 주식 20:1 분할 검토 중.' },
      { ticker: 'AMZN', name: 'Amazon',   logo: LOGO('amazon.com'),
        price: '$3,468', cagr: '+38%',
        summary: '이커머스 성장 둔화 우려. 물류 비용 급증으로 순이익 압박. AWS는 분기 매출 $16.1B(YoY +39%) 고성장 지속. 광고 사업 $9.5B/분기로 새 성장 축 부상.' },
      { ticker: 'FB',  name: 'Meta',     logo: LOGO('meta.com'),
        price: '$330', cagr: '+24%',
        summary: '사명 Facebook → Meta 변경(2021.10.28). 메타버스 R&D 연간 $10B 투자 계획 발표. 3분기 광고 매출 $28.3B(YoY +33%). iOS 개인정보 정책 변화로 광고 타겟팅 효율 저하 우려.' },
      { ticker: 'TSLA',  name: 'Tesla',    logo: LOGO('tesla.com'),
        price: '$1,145', cagr: '+109%',
        summary: '3분기 인도량 24.1만 대(YoY +73%) 사상 최고. 영업이익률 14.3%로 개선. 텍사스·베를린 기가팩토리 가동 준비 중. 머스크의 지분 매각 발언으로 주가 변동성 급증.' },
    ],
  },
  '2023-01-03': {
    cagrPeriod: '2020–2022',
    companies: [
      { ticker: 'NVDA', name: 'NVIDIA',    logo: LOGO('nvidia.com'),
        price: '$146', cagr: '+36%',
        summary: '2022년 급락 이후 저점 모색 중. 게이밍 매출 급감(YoY -51%), 데이터센터는 견조. ChatGPT 출시(2022.11)로 AI 가속기 수요 가능성 부각. FY2023 Q3 가이던스는 시장 기대 하회.' },
      { ticker: 'AAPL', name: 'Apple',     logo: LOGO('apple.com'),
        price: '$130', cagr: '+24%',
        summary: '중국 정저우 공장 생산 차질로 iPhone 14 Pro 공급 부족. 4분기 매출 $117B(YoY -5%) 전망. 서비스 매출 $20.8B으로 견조. 인도 생산 비중 확대 중.' },
      { ticker: 'MSFT', name: 'Microsoft', logo: LOGO('microsoft.com'),
        price: '$239', cagr: '+24%',
        summary: 'OpenAI에 추가 투자 협의 중. Azure에 ChatGPT 탑재 계획 발표. FY2023 Q2 Azure 성장률 31%로 둔화 우려. 직원 1만 명 감원 발표. Activision 인수 규제 심사 중.' },
      { ticker: 'GOOGL', name: 'Alphabet', logo: LOGO('google.com'),
        price: '$89', cagr: '+9%',
        summary: '2022년 급락 이후 저점 부근. ChatGPT 등장으로 검색 시장 패권 우려 고조. 광고 매출 성장 둔화. 2만 명 감원 발표. 자체 대화형 AI 프로젝트 가속화 중.' },
      { ticker: 'AMZN', name: 'Amazon',   logo: LOGO('amazon.com'),
        price: '$84', cagr: '+9%',
        summary: '2022년 급락 이후 저점 부근. 이커머스 적자 지속으로 대규모 인력 감축(1.8만 명). AWS 성장률 둔화(YoY +12%). 비용 구조 개선과 클라우드 AI 전환 수혜 여부가 관심사.' },
      { ticker: 'META',  name: 'Meta',     logo: LOGO('meta.com'),
        price: '$120', cagr: '+2%',
        summary: '2022년 급락 이후 저점 부근. 메타버스 투자 비판 속 "효율의 해" 선언, 대규모 감원 단행. Reels 광고 수익화 초기 단계. P/E 13x로 M7 중 가장 낮은 밸류에이션.' },
      { ticker: 'TSLA',  name: 'Tesla',    logo: LOGO('tesla.com'),
        price: '$123', cagr: '+39%',
        summary: '2022년 급락 이후 저점 부근. 머스크의 트위터 인수 후 경영 집중도 분산 비판. 가격 인하(최대 -20%) 발표로 수익성 우려. 중국 BYD와 글로벌 EV 점유율 경쟁 심화.' },
    ],
  },
}

export default function SetupPage() {
  const navigate = useNavigate()
  const [startPoints, setStartPoints] = useState([])
  const [modalSp, setModalSp] = useState(null) // 팝업에 표시할 시나리오
  const [seedMoney, setSeedMoney] = useState(10000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getStartPoints().then(r => setStartPoints(r.data))
  }, [])

  const handleStart = async () => {
    setLoading(true); setError('')
    try {
      const res = await startSession(modalSp.id, seedMoney)
      navigate(`/play/${res.data.sessionId}`, {
        state: { initialState: res.data, startDate: modalSp.startDate }
      })
    } catch (err) {
      setError(err.response?.data?.message || '오류가 발생했습니다.')
      setLoading(false)
    }
  }

  const ctx = modalSp ? SCENARIO_CONTEXT[modalSp.startDate] : null
  const meta = modalSp ? SCENARIO_META[modalSp.startDate] ?? {} : {}

  return (
    <div style={s.container}>
      <AppHeader title="새 시뮬레이션" />
      <div style={s.inner}>
        <h3 style={s.label}>시나리오 선택</h3>
        <div style={s.scenarioList}>
          {startPoints.map(sp => {
            const m = SCENARIO_META[sp.startDate] ?? {}
            return (
              <div key={sp.id}
                style={{ ...s.scenarioCard, opacity: sp.available ? 1 : 0.55, cursor: sp.available ? 'pointer' : 'default' }}
                onClick={() => sp.available && setModalSp(sp)}
              >
                <div style={s.scenarioTop}>
                  <div style={s.scenarioLeft}>
                    <div style={{ ...s.accent, background: m.accent ?? '#e5e7eb' }} />
                    <div>
                      <div style={s.scenarioName}>{sp.name}</div>
                      <div style={s.scenarioPeriod}>{m.period ?? sp.startDate}</div>
                    </div>
                  </div>
                  {!sp.available
                    ? <span style={s.comingSoon}>준비 중</span>
                    : <span style={{ ...s.arrowBtn, color: m.accent }}>자세히 →</span>
                  }
                </div>
                <p style={s.scenarioDesc}>{sp.description}</p>
                <div style={s.tagRow}>
                  {(m.tags ?? []).map(t => (
                    <span key={t} style={{ ...s.tag, background: m.bg ?? '#f3f4f6', color: m.accent ?? '#6b7280' }}>{t}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 모달 */}
      {modalSp && (
        <div style={s.overlay} onClick={() => setModalSp(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div style={s.modalHeader}>
              <div>
                <div style={{ ...s.modalTitle, color: meta.accent }}>{modalSp.name}</div>
                <div style={s.modalPeriod}>{meta.period}</div>
              </div>
              <button style={s.closeBtn} onClick={() => setModalSp(null)}>✕</button>
            </div>

            {/* 시드머니 선택 */}
            <div style={s.seedSection}>
              <div style={s.seedLabel}>시드머니</div>
              <div style={s.seedRow}>
                {[1000, 10000, 50000, 100000].map(v => (
                  <button key={v}
                    style={seedMoney === v ? { ...s.seed, ...s.seedActive, borderColor: meta.accent, color: meta.accent } : s.seed}
                    onClick={() => setSeedMoney(v)}>
                    ${v.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* M7 기업 정보 */}
            {ctx && (
              <div style={s.companySection}>
                <div style={s.companyLabel}>당시 M7 기업 현황</div>
                <div style={s.companyList}>
                  {ctx.companies.map(c => (
                    <div key={c.ticker} style={s.companyRow}>
                      <div style={s.companyLeft}>
                        <img src={c.logo} alt={c.ticker} style={s.companyLogo} onError={e => { e.target.style.display='none' }} />
                        <div style={s.companyInfo}>
                          <div style={s.companyTopRow}>
                            <span style={s.ticker}>{c.ticker}</span>
                            <span style={s.companyName}>{c.name}</span>
                          </div>
                          <p style={s.companySummary}>{c.summary}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <p style={s.error}>{error}</p>}

            <button
              style={{ ...s.startBtn, background: meta.accent ?? '#16a34a' }}
              onClick={handleStart} disabled={loading}>
              {loading ? '시작 중...' : `${modalSp.name} 시작하기 →`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  container:    { minHeight: '100vh', background: '#f5f6f8' },
  inner:        { maxWidth: 480, margin: '0 auto', padding: '20px 16px' },
  label:        { color: '#9ca3af', fontSize: 11, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },

  scenarioList:   { display: 'flex', flexDirection: 'column', gap: 10 },
  scenarioCard:   { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px' },
  scenarioTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scenarioLeft:   { display: 'flex', alignItems: 'center', gap: 10 },
  accent:         { width: 4, height: 36, borderRadius: 2, flexShrink: 0 },
  scenarioName:   { color: '#111827', fontWeight: 700, fontSize: 15, marginBottom: 2 },
  scenarioPeriod: { color: '#9ca3af', fontSize: 11 },
  comingSoon:     { background: '#f3f4f6', color: '#9ca3af', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20 },
  arrowBtn:       { fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' },
  scenarioDesc:   { color: '#374151', fontSize: 12, lineHeight: 1.7, margin: '0 0 10px', paddingLeft: 14 },
  tagRow:         { display: 'flex', gap: 6, paddingLeft: 14 },
  tag:            { fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 20 },

  // 모달
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end' },
  modal:        { background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '90vh', overflowY: 'auto', padding: '20px 16px 32px' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 2 },
  modalPeriod:  { color: '#9ca3af', fontSize: 12 },
  closeBtn:     { background: 'none', border: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer', padding: '0 4px' },

  seedSection:  { marginBottom: 16 },
  seedLabel:    { color: '#9ca3af', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  seedRow:      { display: 'flex', gap: 8 },
  seed:         { flex: 1, background: '#fff', borderWidth: 1, borderStyle: 'solid', borderColor: '#e5e7eb', borderRadius: 8, padding: '9px 0', color: '#9ca3af', cursor: 'pointer', fontSize: 13, textAlign: 'center' },
  seedActive:   { fontWeight: 600, borderWidth: 2 },

  companySection: { marginBottom: 16 },
  companyLabel:   { color: '#9ca3af', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  cagrNote:       { textTransform: 'none', letterSpacing: 0, fontWeight: 400 },
  companyList:    { display: 'flex', flexDirection: 'column', gap: 0 },
  companyRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #f3f4f6' },
  companyLeft:    { display: 'flex', gap: 8, flex: 1, minWidth: 0 },
  companyLogo:    { width: 22, height: 22, borderRadius: 5, objectFit: 'contain', flexShrink: 0, marginTop: 1 },
  companyInfo:    { flex: 1, minWidth: 0 },
  companyTopRow:  { display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 },
  ticker:         { color: '#111827', fontSize: 12, fontWeight: 700 },
  companyName:    { color: '#9ca3af', fontSize: 11 },
  companySummary: { color: '#374151', fontSize: 11, lineHeight: 1.6, margin: 0 },
  companyStats:   { textAlign: 'right', flexShrink: 0, marginLeft: 8 },
  statPrice:      { color: '#9ca3af', fontSize: 11, marginLeft: 4 },

  error:    { color: '#ef4444', fontSize: 13, marginBottom: 8 },
  startBtn: { width: '100%', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
}
