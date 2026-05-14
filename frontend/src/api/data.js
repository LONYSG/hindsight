import client from './client'

export const getStartPoints = () => client.get('/data/start-points')
export const getCompanies   = () => client.get('/data/companies')
export const getPriceHistory = (companyId, from, to) =>
  client.get('/data/prices', { params: { companyId, from, to } })

export const getNews = (date) =>
  client.get('/data/news', { params: { date } })
