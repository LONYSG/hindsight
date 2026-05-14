import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStartPoints, getCompanies } from '../api/data'
import { startSession } from '../api/play'

export default function SetupPage() {
  const navigate = useNavigate()
  const [startPoints, setStartPoints] = useState([])
  const [companies, setCompanies] = useState([])
  const [selectedStartPoint, setSelectedStartPoint] = useState(null)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [seedMoney, setSeedMoney] = useState(10000000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getStartPoints(), getCompanies()]).then(([spRes, cRes]) => {
      setStartPoints(spRes.data)
      setCompanies(cRes.data)
    })
  }, [])

  const handleStart = async () => {
    if (!selectedStartPoint || !selectedCompany) {
      setError('시작점과 기업을 선택해주세요.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await startSession(selectedStartPoint.id, selectedCompany.id, seedMoney)
      navigate(`/play/${res.data.sessionId}`, { state: { initialState: res.data } })
    } catch (err) {
      setError(err.response?.data?.message || '오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        <h2 style={styles.title}>시뮬레이션 설정</h2>

        <section style={styles.section}>
          <h3 style={styles.label}>시작점 선택</h3>
          <div style={styles.cardGrid}>
            {startPoints.map((sp) => (
              <div
                key={sp.id}
                style={selectedStartPoint?.id === sp.id ? styles.cardActive : styles.card}
                onClick={() => setSelectedStartPoint(sp)}
              >
                <div style={styles.cardTitle}>{sp.name}</div>
                <div style={styles.cardDesc}>{sp.description}</div>
                <div style={styles.cardDate}>{sp.startDate}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.label}>기업 선택</h3>
          <div style={styles.cardGrid}>
            {companies.map((c) => (
              <div
                key={c.id}
                style={selectedCompany?.id === c.id ? styles.cardActive : styles.card}
                onClick={() => setSelectedCompany(c)}
              >
                <div style={styles.cardTitle}>{c.ticker}</div>
                <div style={styles.cardDesc}>{c.name}</div>
                <div style={styles.cardDate}>{c.exchange}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.label}>시드머니</h3>
          <div style={styles.seedRow}>
            {[1000000, 5000000, 10000000, 50000000].map((v) => (
              <button
                key={v}
                style={seedMoney === v ? styles.seedActive : styles.seed}
                onClick={() => setSeedMoney(v)}
              >
                {(v / 10000).toLocaleString()}만원
              </button>
            ))}
          </div>
        </section>

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.startBtn} onClick={handleStart} disabled={loading}>
          {loading ? '시작 중...' : '시뮬레이션 시작 →'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#0f0f0f', padding: '40px 20px' },
  inner: { maxWidth: 720, margin: '0 auto' },
  title: { color: '#fff', fontSize: 24, marginBottom: 32 },
  section: { marginBottom: 32 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  cardGrid: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  card: { background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', flex: 1, minWidth: 180 },
  cardActive: { background: '#1a1a1a', border: '2px solid #4ade80', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', flex: 1, minWidth: 180 },
  cardTitle: { color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 6 },
  cardDesc: { color: '#888', fontSize: 12, marginBottom: 8, lineHeight: 1.5 },
  cardDate: { color: '#4ade80', fontSize: 12 },
  seedRow: { display: 'flex', gap: 10 },
  seed: { background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '10px 16px', color: '#aaa', cursor: 'pointer', fontSize: 14 },
  seedActive: { background: '#1a1a1a', border: '2px solid #4ade80', borderRadius: 8, padding: '10px 16px', color: '#4ade80', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  error: { color: '#f87171', fontSize: 13 },
  startBtn: { width: '100%', background: '#4ade80', color: '#000', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
}
