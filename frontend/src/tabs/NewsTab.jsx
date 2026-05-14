const EVENT_META = {
  PRICE_SPIKE:  { label: '주가 급변',   desc: '당일 주가 변동폭 ±3% 초과', color: '#f59e0b' },
  VOLUME_SPIKE: { label: '거래량 급증', desc: '20일 평균 대비 거래량 200% 초과', color: '#818cf8' },
  FOMC:         { label: 'FOMC',        desc: '연방공개시장위원회 금리 결정', color: '#34d399' },
  CPI:          { label: 'CPI 발표',    desc: '소비자물가지수 발표', color: '#34d399' },
  EARNINGS:     { label: '실적 발표',   desc: '분기 실적 발표', color: '#60a5fa' },
}

export default function NewsTab({ events }) {
  if (events.length === 0) {
    return (
      <div style={s.empty}>
        <div style={s.emptyIcon}>📰</div>
        <div style={s.emptyTitle}>오늘은 조용한 날</div>
        <div style={s.emptyDesc}>특별한 이벤트가 없는 날입니다.<br />날짜를 이동해 이벤트를 찾아보세요.</div>
      </div>
    )
  }

  return (
    <div style={s.root}>
      {events.map((e, i) => {
        const meta = EVENT_META[e.eventType] || { label: e.eventType, desc: '', color: '#888' }
        return (
          <div key={i} style={s.card}>
            <div style={{ ...s.badge, background: meta.color + '22', color: meta.color, border: `1px solid ${meta.color}44` }}>
              {meta.label}
            </div>
            {e.summary ? (
              <p style={s.summary}>{e.summary}</p>
            ) : (
              <p style={s.noSummary}>{meta.desc}</p>
            )}
          </div>
        )
      })}
      <div style={s.notice}>
        뉴스 AI 요약은 이벤트 발생일에 제공됩니다.
      </div>
    </div>
  )
}

const s = {
  root:       { display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', height: '100%' },
  card:       { background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: '16px' },
  badge:      { display: 'inline-block', borderRadius: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600, marginBottom: 10 },
  summary:    { color: '#ccc', fontSize: 14, lineHeight: 1.7, margin: 0 },
  noSummary:  { color: '#444', fontSize: 13, lineHeight: 1.6, margin: 0 },
  notice:     { color: '#333', fontSize: 11, textAlign: 'center', paddingBottom: 8 },
  empty:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { color: '#555', fontSize: 16, fontWeight: 600 },
  emptyDesc:  { color: '#333', fontSize: 13, textAlign: 'center', lineHeight: 1.6 },
}
