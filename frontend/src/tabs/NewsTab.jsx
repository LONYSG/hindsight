import { useEffect, useState } from 'react'
import { getNews } from '../api/data'

const CATEGORY_META = {
  BUSINESS:    { label: 'Business',   color: '#60a5fa' },
  TECHNOLOGY:  { label: 'Technology', color: '#a78bfa' },
  WORLD:       { label: 'World',      color: '#34d399' },
  NVDA_DIRECT: { label: 'NVDA',       color: '#f59e0b' },
}

// UTC 기준 미국 동부 시장 시간 판단 (EST = UTC-5)
// 장 시작: 09:30 EST = 14:30 UTC / 장 마감: 16:00 EST = 21:00 UTC
function getMarketTiming(publishedAt) {
  if (!publishedAt) return null
  const utcHour = new Date(publishedAt).getUTCHours()
  const utcMin  = new Date(publishedAt).getUTCMinutes()
  const totalMin = utcHour * 60 + utcMin
  if (totalMin < 14 * 60 + 30)  return { label: '장전',  color: '#60a5fa', tip: '미국 장 시작 전 보도 → 당일 주가에 반영 가능' }
  if (totalMin <= 21 * 60)      return { label: '장중',  color: '#f59e0b', tip: '미국 장 중 보도 → 당일 주가에 실시간 반영' }
  return                               { label: '장후',  color: '#888',    tip: '미국 장 마감 후 보도 → 다음 거래일 주가에 반영' }
}

// 요약 텍스트 정리: "요약:", "요약 :" 등 prefix 제거 + 빈 줄 정리
function cleanSummary(text) {
  if (!text) return ''
  return text
    .replace(/^요약\s*:\s*/i, '')
    .replace(/^\[요약\]\s*/i, '')
    .trim()
}

export default function NewsTab({ simDate }) {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!simDate) return
    setLoading(true)
    setExpanded(null)
    getNews(simDate)
      .then((r) => setArticles(r.data))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false))
  }, [simDate])

  if (loading) return <div style={s.center}>뉴스 불러오는 중...</div>

  if (articles.length === 0) return (
    <div style={s.empty}>
      <div style={s.emptyIcon}>📰</div>
      <div style={s.emptyTitle}>수집된 뉴스가 없습니다</div>
      <div style={s.emptyDesc}>뉴스는 2020년 2월~4월 기간에 수집됐어요</div>
    </div>
  )

  return (
    <div style={s.root}>
      <div style={s.header}>{simDate} · {articles.length}건</div>
      {articles.map((a, i) => {
        const meta    = CATEGORY_META[a.category] || { label: a.category, color: '#888' }
        const timing  = getMarketTiming(a.publishedAt)
        const isOpen  = expanded === i
        const summary = cleanSummary(a.summary)

        return (
          <div key={i} style={s.card} onClick={() => setExpanded(isOpen ? null : i)}>
            {/* 배지 행 */}
            <div style={s.badges}>
              <span style={{ ...s.badge, color: meta.color, background: meta.color + '18', border: `1px solid ${meta.color}30` }}>
                {meta.label}
              </span>
              {timing && (
                <span style={{ ...s.timingBadge, color: timing.color }} title={timing.tip}>
                  {timing.label}
                </span>
              )}
              <span style={s.toggle}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* 제목: 한국어 제목 우선, 없으면 영문 원제 */}
            <div style={s.title}>{a.titleKo || a.title}</div>
            {a.titleKo && <div style={s.titleEn}>{a.title}</div>}

            {/* 펼쳐진 상태: AI 요약 */}
            {isOpen && (
              <div style={s.detail}>
                {summary ? (
                  <>
                    <div style={s.sectionLabel}>AI 요약</div>
                    <div style={s.summary}>
                      {/* \n 기준으로 단락 분리 */}
                      {summary.split('\n').filter(l => l.trim()).map((line, j) => (
                        <p key={j} style={s.summaryPara}>{line.trim()}</p>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={s.noSummary}>요약 없음</p>
                )}
                {timing && (
                  <div style={{ ...s.timingNote, color: timing.color }}>
                    ⏱ {timing.tip}
                  </div>
                )}
                <a href={a.url} target="_blank" rel="noopener noreferrer" style={s.link}
                   onClick={(e) => e.stopPropagation()}>
                  원문 보기 →
                </a>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const s = {
  root:        { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' },
  center:      { color: '#555', textAlign: 'center', paddingTop: 60, fontSize: 13 },
  header:      { color: '#555', fontSize: 11, marginBottom: 4 },
  card:        { background: '#161616', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', border: '1px solid #1e1e1e' },
  badges:      { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 },
  badge:       { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 },
  timingBadge: { fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'transparent', border: '1px solid #333' },
  toggle:      { color: '#444', fontSize: 10, marginLeft: 'auto' },
  title:       { color: '#e8e8e8', fontSize: 13, fontWeight: 500, lineHeight: 1.5 },
  titleEn:     { color: '#444', fontSize: 11, marginTop: 3, lineHeight: 1.4 },
  detail:      { marginTop: 12, borderTop: '1px solid #252525', paddingTop: 12 },
  sectionLabel:{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  summary:     { display: 'flex', flexDirection: 'column', gap: 8 },
  summaryPara: { color: '#bbb', fontSize: 13, lineHeight: 1.75, margin: 0 },
  noSummary:   { color: '#444', fontSize: 13 },
  timingNote:  { fontSize: 11, marginTop: 10, opacity: 0.8 },
  link:        { display: 'inline-block', marginTop: 10, color: '#60a5fa', fontSize: 12, textDecoration: 'none' },
  empty:       { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 },
  emptyIcon:   { fontSize: 36 },
  emptyTitle:  { color: '#555', fontSize: 15, fontWeight: 600 },
  emptyDesc:   { color: '#333', fontSize: 12, textAlign: 'center' },
}
