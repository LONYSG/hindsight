import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem('token')) navigate('/home', { replace: true })
  }, [])

  const handleKakao = () => {
    const REST_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY
    const REDIRECT = encodeURIComponent('http://localhost:5173/auth/kakao/callback')
    window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_KEY}&redirect_uri=${REDIRECT}&response_type=code`
  }

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.logo}>Hindsight</div>
        <p style={s.tagline}>과거로 돌아가 시장을 이겨라</p>

        <button style={s.kakaoBtn} onClick={handleKakao}>
          <img
            src="https://developers.kakao.com/assets/img/about/logos/kakaolink/kakaolink_btn_small.png"
            alt=""
            style={{ width: 20, marginRight: 10 }}
          />
          카카오로 시작하기
        </button>

        <p style={s.notice}>가입하지 않았다면 자동으로 회원가입됩니다</p>
      </div>
    </div>
  )
}

const s = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6f8', padding: '20px 16px' },
  card:      { background: '#fff', border: '1px solid #e8eaed', borderRadius: 16, padding: '44px 28px 36px', width: '100%', maxWidth: 360, textAlign: 'center' },
  logo:      { color: '#111827', fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8 },
  tagline:   { color: '#9ca3af', fontSize: 13, marginBottom: 36 },
  kakaoBtn:  { width: '100%', background: '#FEE500', color: '#000000CC', border: 'none', borderRadius: 10, padding: '14px 0', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  notice:    { color: '#9ca3af', fontSize: 12, marginTop: 16 },
}
