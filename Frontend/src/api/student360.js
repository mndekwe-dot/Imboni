import client from './client'

// One student across the academic and discipline offices (DOS, discipline, admin).
export const getStudent360 = id => client.get(`/imboni/analytics/student/${id}/360/`)
