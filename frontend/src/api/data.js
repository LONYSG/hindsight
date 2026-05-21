import client from './client'

export const getStartPoints = () => client.get('/data/start-points')
export const getCompanies   = () => client.get('/data/companies')
export const getPriceHistory = (companyId, from, to) =>
  client.get('/data/prices', { params: { companyId, from, to } })

export const getNews = (date, minImportance = 3) =>
  client.get('/data/news', { params: { date, minImportance } })

export const getIndicators = (companyId, from, to) =>
  client.get('/data/indicators', { params: { companyId, from, to } })

export const getMacro = (from, to) =>
  client.get('/data/macro', { params: { from, to } })

export const getEtfSummary = (from, to) =>
  client.get('/data/etf-summary', { params: { from, to } })
