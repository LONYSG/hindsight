export default function FullScreenLoader({ text = '불러오는 중...' }) {
  return (
    <div style={s.wrap}>
      <div style={s.spinner} />
      {text && <p style={s.text}>{text}</p>}
    </div>
  )
}

const s = {
  wrap:    { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#f5f6f8' },
  spinner: { width: 32, height: 32, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#16a34a', animation: 'spin 0.8s linear infinite' },
  text:    { color: '#9ca3af', fontSize: 13, fontWeight: 500 },
}
