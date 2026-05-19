import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { updateNickname } from '../api/auth'

export default function NicknameSetupPage() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!nickname.trim()) { setError('닉네임을 입력해주세요.'); return }
    setLoading(true)
    setError('')
    try {
      await updateNickname(nickname.trim())
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || '오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div style={s.container} className="page-enter">
      <div style={s.card}>
        <div style={s.logo}>Hindsight</div>
        <p style={s.subtitle}>투자 시뮬레이터에서 사용할 닉네임을 설정해주세요</p>
        <p style={s.notice}>결과 공유 시 이 닉네임이 표시됩니다 · 나중에 변경 가능</p>

        <input
          style={s.input}
          type="text"
          placeholder="닉네임 입력 (최대 20자)"
          value={nickname}
          maxLength={20}
          onChange={e => setNickname(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />
        {error && <p style={s.error}>{error}</p>}

        <button style={s.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? '저장 중...' : '시작하기 →'}
        </button>
      </div>
    </div>
  )
}

const s = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6f8', padding: '20px 16px' },
  card:      { background: '#fff', border: '1px solid #e8eaed', borderRadius: 16, padding: '44px 28px 36px', width: '100%', maxWidth: 360, textAlign: 'center' },
  logo:      { color: '#111827', fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 12 },
  subtitle:  { color: '#374151', fontSize: 14, marginBottom: 8, lineHeight: 1.6 },
  notice:    { color: '#9ca3af', fontSize: 12, marginBottom: 24 },
  input:     { width: '100%', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px', color: '#111827', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 8 },
  error:     { color: '#ef4444', fontSize: 13, marginBottom: 8 },
  btn:       { width: '100%', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
}
