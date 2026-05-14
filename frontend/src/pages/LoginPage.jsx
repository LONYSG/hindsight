import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, signup } from '../api/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const res = await login(email, password)
        localStorage.setItem('token', res.data.accessToken)
        navigate('/setup')
      } else {
        await signup(email, password)
        setMode('login')
        setError('회원가입 완료! 로그인해주세요.')
      }
    } catch (err) {
      setError(err.response?.data?.message || '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Hindsight</h1>
        <p style={styles.subtitle}>과거로 돌아가 시장을 이겨라</p>

        <div style={styles.tabRow}>
          <button
            style={mode === 'login' ? styles.tabActive : styles.tab}
            onClick={() => setMode('login')}
          >
            로그인
          </button>
          <button
            style={mode === 'signup' ? styles.tabActive : styles.tab}
            onClick={() => setMode('signup')}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0f0f',
    padding: '20px 16px',
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 12,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 360,
  },
  title: { color: '#fff', fontSize: 28, margin: 0, textAlign: 'center' },
  subtitle: { color: '#888', fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 24 },
  tabRow: { display: 'flex', marginBottom: 20, borderBottom: '1px solid #333' },
  tab: { flex: 1, background: 'none', border: 'none', color: '#666', padding: '8px 0', cursor: 'pointer', fontSize: 14 },
  tabActive: { flex: 1, background: 'none', border: 'none', color: '#4ade80', padding: '8px 0', cursor: 'pointer', fontSize: 14, borderBottom: '2px solid #4ade80' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { background: '#111', border: '1px solid #333', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none' },
  error: { color: '#f87171', fontSize: 13, margin: 0 },
  button: { background: '#4ade80', color: '#000', border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
}
