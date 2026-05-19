import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStartPoints } from '../api/data'
import { startSession } from '../api/play'
import AppHeader from '../components/AppHeader'

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
                style={selectedStartPoint?.id === sp.id ? s.cardActive : s.card}
                onClick={() => setSelectedStartPoint(sp)}
              >
                <div style={s.cardTitle}>{sp.name}</div>
                <div style={s.cardDesc}>{sp.description}</div>
                <div style={s.cardDate}>{sp.startDate}</div>
              </div>
            ))}
          </div>
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
  container: { minHeight: '100vh', background: '#f5f6f8' },
  inner:     { maxWidth: 480, margin: '0 auto', padding: '20px 16px' },
  section:   { marginBottom: 24 },
  label:     { color: '#9ca3af', fontSize: 11, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  cardGrid:  { display: 'flex', gap: 8, flexWrap: 'wrap' },
  card:      { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px', cursor: 'pointer', flex: '1 1 140px' },
  cardActive:{ background: '#fff', border: '2px solid #16a34a', borderRadius: 10, padding: '14px', cursor: 'pointer', flex: '1 1 140px' },
  cardTitle: { color: '#111827', fontWeight: 600, fontSize: 14, marginBottom: 5 },
  cardDesc:  { color: '#6b7280', fontSize: 11, marginBottom: 8, lineHeight: 1.5 },
  cardDate:  { color: '#16a34a', fontSize: 11 },
  seedRow:   { display: 'flex', gap: 8, flexWrap: 'wrap' },
  seed:      { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', color: '#9ca3af', cursor: 'pointer', fontSize: 13, flex: '1 1 80px' },
  seedActive:{ background: '#fff', border: '2px solid #16a34a', borderRadius: 8, padding: '10px 14px', color: '#16a34a', cursor: 'pointer', fontSize: 13, fontWeight: 600, flex: '1 1 80px' },
  error:     { color: '#ef4444', fontSize: 13 },
  startBtn:  { width: '100%', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
}
