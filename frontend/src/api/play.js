import client from './client'

export const startSession = (startPointId, companyId, seedMoney) =>
  client.post('/play/sessions', { startPointId, companyId, seedMoney })

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
