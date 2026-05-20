import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { kakaoLogin } from '../api/auth'

export default function KakaoCallbackPage() {
  const navigate = useNavigate()
  const [errorMsg, setErrorMsg] = useState('')
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      setErrorMsg('카카오 인증 코드가 없습니다.')
      return
    }

    kakaoLogin(code)
      .then(res => {
        localStorage.setItem('token', res.data.accessToken)
        navigate(res.data.hasNickname ? '/home' : '/nickname-setup', { replace: true })
      })
      .catch(err => {
        const msg = err.response?.data?.message || err.message || '알 수 없는 오류'
        setErrorMsg(`로그인 실패: ${msg}`)
        console.error('kakao login error', err.response?.data || err)
      })
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f5f6f8', gap: 16 }}>
      {errorMsg ? (
        <>
          <p style={{ color: '#ef4444', fontSize: 14 }}>{errorMsg}</p>
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>로그인으로 돌아가기</button>
        </>
      ) : (
        <>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#FEE500', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#6b7280', fontSize: 14 }}>카카오 로그인 처리 중...</p>
        </>
      )}
    </div>
  )
}
