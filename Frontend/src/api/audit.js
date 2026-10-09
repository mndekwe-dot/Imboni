import client from './client'

export const getAuditLog = (params) => client.get('/imboni/audit/', { params })
