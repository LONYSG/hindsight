import client from './client'

export const login = (email, password) =>
  client.post('/auth/login', { email, password })

export const signup = (email, password) =>
  client.post('/auth/signup', { email, password })

export const kakaoLogin = (code) =>
  client.post('/auth/kakao', { code })

export const getMe = () =>
  client.get('/auth/me')

export const updateNickname = (nickname) =>
  client.patch('/auth/me/nickname', { nickname })
