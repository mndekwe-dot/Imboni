import client from './client'

// Dashboard
export const getParentDashboard = () => client.get('/imboni/parent/dashboard/')

// Children
export const getParentChildren = () => client.get('/imboni/parent/children/')
export const getParentChild    = (id) => client.get(`/imboni/parent/children/${id}/`)

// Results
export const getParentResults = (params) => client.get('/imboni/parent/results/', { params })

// Attendance
export const getParentAttendance = (params) => client.get('/imboni/parent/attendance/', { params })

// Behaviour / Discipline
export const getParentBehaviour = (params) => client.get('/imboni/parent/behaviour/', { params })

// Announcements
export const getParentAnnouncements = () => client.get('/imboni/parent/announcements/')

// Messages
export const getParentMessages = () => client.get('/imboni/parent/messages/')
export const sendParentMessage = (data) => client.post('/imboni/parent/messages/', data)
