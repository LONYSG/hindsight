import axios from 'axios'

const client = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api' })

// 모든 요청에 JWT 토큰 자동 첨부
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 401 응답 시 로그인 페이지로 이동
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default client
