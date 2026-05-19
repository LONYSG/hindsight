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
        navigate('/home')
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

        <button type="button" style={styles.kakaoBtn} onClick={() => {
          const REST_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY
          const REDIRECT = encodeURIComponent('http://localhost:5173/auth/kakao/callback')
          window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_KEY}&redirect_uri=${REDIRECT}&response_type=code`
        }}>
          <img src="https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_small.png" alt="" style={{ width: 18, marginRight: 8 }} />
          카카오로 시작하기
        </button>

        <div style={styles.divider}><span>또는</span></div>

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
    background: '#f5f6f8',
    padding: '20px 16px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e8eaed',
    borderRadius: 14,
    padding: '36px 28px',
    width: '100%',
    maxWidth: 360,
  },
  title: { color: '#111827', fontSize: 26, fontWeight: 700, margin: 0, textAlign: 'center', letterSpacing: '-0.5px' },
  subtitle: { color: '#6b7280', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 24 },
  tabRow: { display: 'flex', marginBottom: 20, borderBottom: '1px solid #e8eaed' },
  tab: { flex: 1, background: 'none', border: 'none', color: '#9ca3af', padding: '8px 0', cursor: 'pointer', fontSize: 14 },
  tabActive: { flex: 1, background: 'none', border: 'none', color: '#16a34a', padding: '8px 0', cursor: 'pointer', fontSize: 14, fontWeight: 600, borderBottom: '2px solid #16a34a' },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  input: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '11px 14px', color: '#111827', fontSize: 14, outline: 'none' },
  error: { color: '#ef4444', fontSize: 13, margin: 0 },
  button:    { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  kakaoBtn:  { width: '100%', background: '#FEE500', color: '#000000CC', border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  divider:   { display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0', color: '#9ca3af', fontSize: 12 },
}
