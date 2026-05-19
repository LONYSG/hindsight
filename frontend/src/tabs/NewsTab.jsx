import { useEffect, useState } from 'react'
import { getNews } from '../api/data'
import { recordNewsView } from '../api/play'

const CATEGORY_META = {
  BUSINESS:   { label: 'Business',   color: '#2563eb' },
  TECHNOLOGY: { label: 'Technology', color: '#a78bfa' },
  WORLD:      { label: 'World',      color: '#34d399' },
  COMPANY:    { label: 'Company',    color: '#f59e0b' },
}

const IMPORTANCE_LABEL = { 5: '★★★★★', 4: '★★★★', 3: '★★★', 2: '★★', 1: '★' }
const IMPORTANCE_COLOR = { 5: '#f59e0b', 4: '#f59e0b', 3: '#888', 2: '#555', 1: '#444' }

const THEME_COLOR = '#6366f1'

// 미국 DST: 3월 둘째 일요일 ~ 11월 첫째 일요일 = EDT(UTC-4)
// 나머지 = EST(UTC-5)
function nthSundayOfMonth(year, month, n) {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const dow = first.getUTCDay() // 0=Sun
  const daysToFirst = dow === 0 ? 0 : 7 - dow
  return new Date(Date.UTC(year, month - 1, 1 + daysToFirst + (n - 1) * 7))
}

function isEDT(date) {
  const year = date.getUTCFullYear()
  const dstStart = nthSundayOfMonth(year, 3, 2)  // 3월 둘째 일요일
  const dstEnd   = nthSundayOfMonth(year, 11, 1) // 11월 첫째 일요일
  return date >= dstStart && date < dstEnd
}

// UTC 기준 미국 동부 시장 시간 판단 (DST 반영)
function getMarketTiming(publishedAt) {
  if (!publishedAt) return null
  const d = new Date(publishedAt)
  const edt = isEDT(d)
  // EDT: 장 13:30~20:00 UTC / EST: 장 14:30~21:00 UTC
  const openMin  = edt ? 13 * 60 + 30 : 14 * 60 + 30
  const closeMin = edt ? 20 * 60       : 21 * 60
  const totalMin = d.getUTCHours() * 60 + d.getUTCMinutes()
  if (totalMin < openMin)  return { label: '장전', color: '#2563eb', tip: '미국 장 시작 전 보도 → 당일 주가에 반영 가능' }
  if (totalMin <= closeMin) return { label: '장중', color: '#f59e0b', tip: '미국 장 중 보도 → 당일 주가에 실시간 반영' }
  return                           { label: '장후', color: '#9ca3af', tip: '미국 장 마감 후 보도 → 다음 거래일 주가에 반영' }
}

function cleanSummary(text) {
  if (!text) return ''
  return text.replace(/^요약\s*:\s*/i, '').replace(/^\[요약\]\s*/i, '').trim()
}

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토']

function getDateSepInfo(dateStr, simDate, prevTradingDay) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  const formatted = `${y}.${String(m).padStart(2,'0')}.${String(d).padStart(2,'0')} (${DAYS_KO[dow]})`

  if (dateStr === simDate)       return { formatted, tag: null }
  if (dateStr === prevTradingDay) return { formatted, tag: '전일 장후', tagBg: '#eff6ff', tagColor: '#1d4ed8' }
  if (dow === 6) return { formatted, tag: '토요일', tagBg: '#fef3c7', tagColor: '#92400e' }
  if (dow === 0) return { formatted, tag: '일요일', tagBg: '#fef3c7', tagColor: '#92400e' }
  // 평일인데 prevTradingDay도 simDate도 아님 → 공휴일
  return { formatted, tag: '공휴일', tagBg: '#fce7f3', tagColor: '#9d174d' }
}

const IMP_FILTERS = [
  { label: '전체',      value: 1 },
  { label: '★★★ 이상',  value: 3 },
  { label: '★★★★ 이상', value: 4 },
  { label: '★★★★★만',  value: 5 },
]

export default function NewsTab({ simDate, sessionId }) {
  const [articles, setArticles]             = useState([])
  const [prevTradingDay, setPrevTradingDay]  = useState(null)
  const [loading, setLoading]               = useState(false)
  const [expanded, setExpanded]             = useState(null)
  const [minImp, setMinImp]                 = useState(3)
  const [selectedTickers, setSelectedTickers] = useState([])
  const [newsTab, setNewsTab]               = useState('market') // 'market' | 'company'

  useEffect(() => {
    if (!simDate) return
    setLoading(true)
    setExpanded(null)
    getNews(simDate, minImp)
      .then((r) => {
        setArticles(r.data.articles ?? [])
        setPrevTradingDay(r.data.prevTradingDay ?? null)
      })
      .catch(() => { setArticles([]); setPrevTradingDay(null) })
      .finally(() => setLoading(false))
  }, [simDate, minImp])

  if (loading) return <div style={s.center}>뉴스 불러오는 중...</div>

  // 글로벌 / 기업 분리
  const globalArticles  = articles.filter(a => a.sourceType !== 'company')
  const companyArticles = articles.filter(a => a.sourceType === 'company')

  // 날짜별 그룹핑 헬퍼
  const groupByDate = (list) => {
    const map = list.reduce((acc, a) => {
      const d = a.date || (a.publishedAt ? a.publishedAt.slice(0, 10) : simDate)
      if (!acc[d]) acc[d] = []
      acc[d].push(a)
      return acc
    }, {})
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }

  const globalGroups = groupByDate(globalArticles)

  // 기업 뉴스 ticker 필터
  const availableTickers = [...new Set(companyArticles.flatMap(a => a.tickers ?? []))]
  const filteredCompany  = selectedTickers.length === 0
    ? companyArticles
    : companyArticles.filter(a => a.tickers?.some(t => selectedTickers.includes(t)))
  const companyGroups = groupByDate(filteredCompany)

  const toggleTicker = (ticker) => {
    setSelectedTickers(prev =>
      prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]
    )
  }

  // 카드 렌더 공통 함수
  const renderCard = (a, isTodayGroup) => {
    const isCompany = a.sourceType === 'company'
    const meta    = isCompany
      ? { label: a.tickers?.[0] ?? 'Company', color: '#f59e0b' }
      : (CATEGORY_META[a.category] || { label: a.category, color: '#888' })
    const timing  = isTodayGroup && !isCompany ? getMarketTiming(a.publishedAt) : null
    const isOpen  = expanded === a.id
    const summary = cleanSummary(a.summary)
    const imp     = a.importance ?? null

    return (
      <div key={a.id} style={s.card}
           onClick={() => {
             const opening = !isOpen
             setExpanded(opening ? a.id : null)
             if (opening && sessionId && a.id) recordNewsView(sessionId, a.id)
           }}>
        <div style={s.badges}>
          <span style={{ ...s.badge, color: meta.color, background: meta.color + '15', border: `1px solid ${meta.color}40` }}>
            {meta.label}
          </span>
          {timing && (
            <span style={{ ...s.timingBadge, color: timing.color }} title={timing.tip}>
              {timing.label}
            </span>
          )}
          {imp !== null && (
            <span style={{ ...s.impBadge, color: IMPORTANCE_COLOR[imp] }}
                  title={`당시 투자자 중요도 ${imp}점`}>
              {IMPORTANCE_LABEL[imp]}
            </span>
          )}
          <span style={s.toggle}>{isOpen ? '▲' : '▼'}</span>
        </div>

        <div style={s.title}>{a.titleKo || a.title}</div>
        {!isOpen && a.brief && <div style={s.brief}>{a.brief}</div>}
        {isOpen && a.titleKo && <div style={s.titleEn}>{a.title}</div>}

        {isOpen && (
          <div style={s.detail}>
            {summary ? (
              <>
                <div style={s.sectionLabel}>AI 요약</div>
                <div style={s.summary}>
                  {summary.split(/\n\s*\n/).filter(l => l.trim()).map((line, j) => (
                    <p key={j} style={s.summaryPara}>{line.trim()}</p>
                  ))}
                </div>
              </>
            ) : (
              <p style={s.noSummary}>요약 준비 중</p>
            )}
            {timing && (
              <div style={{ fontSize: 11, color: timing.color, marginTop: 10, opacity: 0.8 }}>
                ⏱ {timing.tip}
              </div>
            )}
            {a.themes?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                {a.themes.map(t => <span key={t} style={s.themeBadge}>{t}</span>)}
              </div>
            )}
            <a href={a.url} target="_blank" rel="noopener noreferrer" style={s.link}
               onClick={e => e.stopPropagation()}>
              원문 보기 →
            </a>
          </div>
        )}
      </div>
    )
  }

  // 날짜별 그룹 렌더
  const renderGroups = (groups) => groups.map(([dateStr, dateArticles]) => {
    const sepInfo      = getDateSepInfo(dateStr, simDate, prevTradingDay)
    const isTodayGroup = dateStr === simDate
    return (
      <div key={dateStr}>
        <div style={s.dateSep}>
          <div style={s.dateSepLine} />
          <div style={s.dateSepLabel}>
            <span style={s.dateSepDate}>{sepInfo.formatted}</span>
            {sepInfo.tag && (
              <span style={{ ...s.dateSepTag, background: sepInfo.tagBg, color: sepInfo.tagColor }}>
                {sepInfo.tag}
              </span>
            )}
          </div>
          <div style={s.dateSepLine} />
        </div>
        {dateArticles.map(a => renderCard(a, isTodayGroup))}
      </div>
    )
  })

  if (articles.length === 0) return (
    <div style={s.empty}>
      <div style={s.emptyIcon}>📰</div>
      <div style={s.emptyTitle}>수집된 뉴스가 없습니다</div>
      <div style={s.emptyDesc}>뉴스는 2020년 2~4월 기간에 수집됐어요</div>
    </div>
  )

  return (
    <div style={s.root}>

      {/* ─── 서브탭 바 ─── */}
      <div style={s.subTabBar}>
        <button
          style={{ ...s.subTab, ...(newsTab === 'market' ? s.subTabActive : {}) }}
          onMouseDown={e => e.preventDefault()}
          onClick={() => setNewsTab('market')}>
          🌎 시장 <span style={s.subTabCount}>{globalArticles.length}</span>
        </button>
        <button
          style={{ ...s.subTab, ...(newsTab === 'company' ? s.subTabActive : {}) }}
          onMouseDown={e => e.preventDefault()}
          onClick={() => setNewsTab('company')}>
          📈 기업 <span style={s.subTabCount}>{companyArticles.length}</span>
        </button>
      </div>

      {/* ─── 시장 뉴스 탭 ─── */}
      {newsTab === 'market' && (
        <>
          <div style={s.filterRow}>
            {IMP_FILTERS.map(f => (
              <button key={f.value}
                style={{ ...s.filterBtn, borderColor: minImp === f.value ? '#16a34a' : '#e5e7eb', color: minImp === f.value ? '#16a34a' : '#9ca3af', background: minImp === f.value ? '#f0fdf4' : 'none' }}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setMinImp(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          {globalArticles.length === 0
            ? <div style={s.sectionEmpty}>오늘 시장 뉴스가 없습니다</div>
            : renderGroups(globalGroups)
          }
        </>
      )}

      {/* ─── 기업 뉴스 탭 ─── */}
      {newsTab === 'company' && (
        <>
          <div style={s.tickerRow}>
            <button
              style={{ ...s.tickerChip, borderColor: selectedTickers.length === 0 ? '#16a34a' : '#e5e7eb', color: selectedTickers.length === 0 ? '#16a34a' : '#9ca3af', background: selectedTickers.length === 0 ? '#f0fdf4' : '#fff' }}
              onMouseDown={e => e.preventDefault()}
              onClick={() => setSelectedTickers([])}>
              전체
            </button>
            {availableTickers.map(ticker => {
              const active = selectedTickers.includes(ticker)
              return (
                <button key={ticker}
                  style={{ ...s.tickerChip, borderColor: active ? '#f59e0b' : '#e5e7eb', color: active ? '#92400e' : '#9ca3af', background: active ? '#fef3c7' : '#fff' }}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => toggleTicker(ticker)}>
                  {ticker}
                </button>
              )
            })}
          </div>
          {companyArticles.length === 0
            ? <div style={s.sectionEmpty}>오늘 기업 뉴스가 없습니다</div>
            : filteredCompany.length === 0
              ? <div style={s.sectionEmpty}>해당 기업 뉴스가 없습니다</div>
              : renderGroups(companyGroups)
          }
        </>
      )}
    </div>
  )
}

const s = {
  root:        { display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingBottom: 12 },
  dateSep:     { display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 2px' },
  dateSepLine: { flex: 1, height: 1, background: '#e8eaed' },
  dateSepLabel:{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  dateSepDate: { fontSize: 11, color: '#9ca3af', fontWeight: 500, whiteSpace: 'nowrap' },
  dateSepTag:  { fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' },
  center:      { color: '#9ca3af', textAlign: 'center', paddingTop: 60, fontSize: 13 },
  subTabBar:   { display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: 10, flexShrink: 0 },
  subTab:      { flex: 1, background: '#f9fafb', border: 'none', borderRight: '1px solid #e5e7eb', padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 },
  subTabActive:{ background: '#fff', color: '#111827' },
  subTabCount: { fontSize: 10, color: '#9ca3af', background: '#f3f4f6', borderRadius: 10, padding: '1px 6px' },
  filterRow:   { display: 'flex', gap: 4, marginBottom: 8 },
  filterBtn:   { borderWidth: 1, borderStyle: 'solid', borderRadius: 5, padding: '3px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  tickerRow:   { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  tickerChip:  { borderWidth: 1, borderStyle: 'solid', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  sectionEmpty:{ color: '#9ca3af', fontSize: 12, padding: '12px 0', textAlign: 'center' },
  card:        { background: '#fff', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', border: '1px solid #e8eaed', marginBottom: 10 },
  badges:      { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  badge:       { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 },
  timingBadge: { fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, border: '1px solid #e5e7eb' },
  impBadge:    { fontSize: 11, marginLeft: 'auto' },
  toggle:      { color: '#d1d5db', fontSize: 10, marginLeft: 4 },
  title:       { color: '#111827', fontSize: 13, fontWeight: 600, lineHeight: 1.6 },
  brief:       { color: '#6b7280', fontSize: 12, marginTop: 6, lineHeight: 1.6 },
  titleEn:     { color: '#d1d5db', fontSize: 11, marginTop: 4, lineHeight: 1.4 },
  detail:      { marginTop: 14, borderTop: '1px solid #f3f4f6', paddingTop: 14 },
  sectionLabel:{ color: '#9ca3af', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  summary:     { display: 'flex', flexDirection: 'column', gap: 8 },
  summaryPara: { color: '#374151', fontSize: 13, lineHeight: 1.75, margin: 0 },
  noSummary:   { color: '#d1d5db', fontSize: 13 },
  link:        { display: 'inline-block', marginTop: 10, color: '#2563eb', fontSize: 12, textDecoration: 'none' },
  themeBadge:  { fontSize: 10, color: THEME_COLOR, background: THEME_COLOR + '15', border: `1px solid ${THEME_COLOR}33`, borderRadius: 3, padding: '2px 6px', fontWeight: 600 },
  empty:       { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 },
  emptyIcon:   { fontSize: 36 },
  emptyTitle:  { color: '#9ca3af', fontSize: 15, fontWeight: 600 },
  emptyDesc:   { color: '#333', fontSize: 12, textAlign: 'center' },
}
