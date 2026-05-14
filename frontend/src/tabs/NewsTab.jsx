import { useEffect, useState } from 'react'
import { getNews } from '../api/data'

const CATEGORY_META = {
  BUSINESS:    { label: 'Business',   color: '#60a5fa' },
  TECHNOLOGY:  { label: 'Technology', color: '#a78bfa' },
  WORLD:       { label: 'World',      color: '#34d399' },
  NVDA_DIRECT: { label: 'NVDA',       color: '#f59e0b' },
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
      <div style={s.emptyTitle}>오늘은 조용한 날</div>
      <div style={s.emptyDesc}>수집된 뉴스가 없습니다</div>
    </div>
  )

  return (
    <div style={s.root}>
      <div style={s.header}>{simDate} · {articles.length}건</div>
      {articles.map((a, i) => {
        const meta = CATEGORY_META[a.category] || { label: a.category, color: '#888' }
        const isOpen = expanded === i
        return (
          <div key={i} style={s.card} onClick={() => setExpanded(isOpen ? null : i)}>
            <div style={s.cardTop}>
              <span style={{ ...s.badge, color: meta.color, background: meta.color + '18', border: `1px solid ${meta.color}30` }}>
                {meta.label}
              </span>
              <span style={s.toggle}>{isOpen ? '▲' : '▼'}</span>
            </div>
            <div style={s.title}>{a.title}</div>

            {isOpen && (
              <div style={s.detail}>
                {a.summary ? (
                  <>
                    <div style={s.sectionLabel}>AI 요약</div>
                    <p style={s.summary}>{a.summary}</p>
                  </>
                ) : (
                  <p style={s.noSummary}>요약 없음</p>
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
  cardTop:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge:       { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 },
  toggle:      { color: '#444', fontSize: 10 },
  title:       { color: '#e8e8e8', fontSize: 13, fontWeight: 500, lineHeight: 1.5 },
  detail:      { marginTop: 12, borderTop: '1px solid #252525', paddingTop: 12 },
  sectionLabel:{ color: '#555', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  summary:     { color: '#bbb', fontSize: 13, lineHeight: 1.7, margin: 0 },
  noSummary:   { color: '#444', fontSize: 13 },
  link:        { display: 'inline-block', marginTop: 10, color: '#60a5fa', fontSize: 12, textDecoration: 'none' },
  empty:       { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 },
  emptyIcon:   { fontSize: 36 },
  emptyTitle:  { color: '#555', fontSize: 15, fontWeight: 600 },
  emptyDesc:   { color: '#333', fontSize: 13 },
}
