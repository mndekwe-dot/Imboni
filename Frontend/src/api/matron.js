import client from './client'

// Dashboard
export const getMatronDashboard = () => client.get('/imboni/matron/dashboard/')

// Students
export const getMatronStudents = (params) => client.get('/imboni/matron/students/', { params })
export const getMatronStudent  = (id) => client.get(`/imboni/matron/students/${id}/`)

// Health
export const getMatronHealth    = (params) => client.get('/imboni/matron/health/', { params })
export const createHealthRecord = (data) => client.post('/imboni/matron/health/', data)
export const updateHealthRecord = (id, data) => client.patch(`/imboni/matron/health/${id}/`, data)

// Incidents
export const getMatronIncidents   = (params) => client.get('/imboni/matron/incidents/', { params })
export const createMatronIncident = (data) => client.post('/imboni/matron/incidents/', data)

// Schedule (today's class timetable for the matron's assigned grade)
export const getMatronSchedule = () => client.get('/imboni/matron/schedule/')

// Boarding Schedule (standing weekly routine, read-only — issued by Discipline Master)
export const getMatronBoardingSchedule = () => client.get('/imboni/matron/boarding-schedule/')

// Night Attendance Check
export const getMatronNightCheck   = (params) => client.get('/imboni/matron/night-check/', { params })
export const submitMatronNightCheck = (data) => client.post('/imboni/matron/night-check/', data)

// Parent Communication
export const getParentComms = (params) => client.get('/imboni/matron/parent-comms/', { params })
export const sendParentComm = (data) => client.post('/imboni/matron/parent-comms/', data)

// Messages
export const getMatronMessages = () => client.get('/imboni/matron/messages/')
export const sendMatronMessage = (data) => client.post('/imboni/matron/messages/', data)
