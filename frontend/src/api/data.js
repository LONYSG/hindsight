import client from './client'

export const getStartPoints = () => client.get('/data/start-points')
export const getCompanies = () => client.get('/data/companies')
