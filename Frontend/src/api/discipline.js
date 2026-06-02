import client from './client'

// Dashboard
export const getDisDashboard = () => client.get('/imboni/discipline/dashboard/')

// Students
export const getDisStudents = (params) => client.get('/imboni/discipline/students/', { params })
export const getDisStudent  = (id) => client.get(`/imboni/discipline/students/${id}/`)

// Incidents / Reports
export const getDisIncidents   = (params) => client.get('/imboni/discipline/incidents/', { params })
export const createDisIncident = (data) => client.post('/imboni/discipline/incidents/', data)
export const updateDisIncident = (id, data) => client.patch(`/imboni/discipline/incidents/${id}/`, data)

// Activities
export const getDisActivities  = () => client.get('/imboni/discipline/activities/')
export const createDisActivity = (data) => client.post('/imboni/discipline/activities/', data)

// Boarding
export const getDisBoarding = () => client.get('/imboni/discipline/boarding/')

// Dining
export const getDisDining = () => client.get('/imboni/discipline/dining/')

// Student Leaders
export const getDisStudentLeaders = () => client.get('/imboni/discipline/student-leaders/')

// Announcements
export const getDisAnnouncements   = () => client.get('/imboni/discipline/announcements/')
export const createDisAnnouncement = (data) => client.post('/imboni/discipline/announcements/', data)

// Messages
export const getDisMessages = () => client.get('/imboni/discipline/messages/')
export const sendDisMessage = (data) => client.post('/imboni/discipline/messages/', data)

// Extracurricular timetable
export const getDisExtracurricular    = (week = 'default') => client.get('/imboni/discipline/extracurricular/', { params: { week } })
export const createDisExtracurricular = (data) => client.post('/imboni/discipline/extracurricular/', data)
export const patchDisExtracurricular  = (id, data) => client.patch(`/imboni/discipline/extracurricular/${id}/`, data)
export const deleteDisExtracurricular = (id) => client.delete(`/imboni/discipline/extracurricular/${id}/`)
