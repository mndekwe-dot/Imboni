import client from './client'

// Dashboard
export const getDisDashboard = () => client.get('/imboni/discipline/dashboard/')

// Students
export const getDisStudents = (params) => client.get('/imboni/discipline/students/', { params })
export const getDisStudent  = (id)      => client.get(`/imboni/discipline/students/${id}/`)

// Behavior Reports
export const getDisReports    = (params) => client.get('/imboni/discipline/reports/', { params })
export const getDisReport     = (id)      => client.get(`/imboni/discipline/reports/${id}/`)
export const createDisReport  = (d)       => client.post('/imboni/discipline/reports/', d)
export const updateDisReport  = (id, d)   => client.patch(`/imboni/discipline/reports/${id}/`, d)
export const reviewDisReport  = (id, d)   => client.post(`/imboni/discipline/reports/${id}/review/`, d)

// Activities
export const getDisActivities  = ()  => client.get('/imboni/discipline/activities/')
export const createDisActivity = (d) => client.post('/imboni/discipline/activities/', d)

// Boarding
export const getDisBoarding = () => client.get('/imboni/discipline/boarding/')

// Dining
export const getDisDining = () => client.get('/imboni/discipline/dining/')

// Discipline Staff (Matrons & Patrons)
export const getDisStaff    = (params) => client.get('/imboni/discipline/staff/', { params })
export const createDisStaff = (d)      => client.post('/imboni/discipline/staff/', d)
export const updateDisStaff = (id, d)  => client.patch(`/imboni/discipline/staff/${id}/`, d)
export const deleteDisStaff = (id)     => client.delete(`/imboni/discipline/staff/${id}/`)

// Student Leaders
export const getDisStudentLeaders = () => client.get('/imboni/discipline/student-leaders/')

// Announcements
export const getDisAnnouncements   = ()  => client.get('/imboni/discipline/announcements/')
export const createDisAnnouncement = (d) => client.post('/imboni/discipline/announcements/', d)

// Student Behavior (used inside StudentConductModal)
export const getStudentBehaviorStats   = (id) => client.get(`/imboni/behavior/students/${id}/stats/`)
export const getStudentBehaviorReports = (id, params) => client.get(`/imboni/behavior/students/${id}/reports/`, { params })

// Messages
export const getDisMessages = () => client.get('/imboni/discipline/messages/')
export const sendDisMessage = (d) => client.post('/imboni/discipline/messages/', d)

// Extracurricular schedule CRUD
export const getDisExtracurricular    = (week = 'default') => client.get('/imboni/discipline/extracurricular/', { params: { week } })
export const createDisExtracurricular = (d)      => client.post('/imboni/discipline/extracurricular/', d)
export const patchDisExtracurricular  = (id, d)  => client.patch(`/imboni/discipline/extracurricular/${id}/`, d)
export const deleteDisExtracurricular = (id)     => client.delete(`/imboni/discipline/extracurricular/${id}/`)
