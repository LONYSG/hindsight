import client from './client'

export const getSessions = () =>
  client.get('/play/sessions')

export const startSession = (startPointId, seedMoney) =>
  client.post('/play/sessions', { startPointId, seedMoney })

export const getState = (sessionId) =>
  client.get(`/play/sessions/${sessionId}/state`)

export const nextDay = (sessionId, jumpType) =>
  client.post(`/play/sessions/${sessionId}/next`, { jumpType })

export const trade = (sessionId, action, quantity) =>
  client.post(`/play/sessions/${sessionId}/trade`, { action, quantity })

export const endSession = (sessionId) =>
  client.post(`/play/sessions/${sessionId}/end`)

export const getResult = (sessionId) =>
  client.get(`/play/sessions/${sessionId}/result`)

export const recordNewsView = (sessionId, newsEsId) =>
  client.post(`/play/sessions/${sessionId}/news-view`, { newsEsId }).catch(() => {})

export const getNewsViewThemes = (sessionId) =>
  client.get(`/play/sessions/${sessionId}/news-view/themes`)
