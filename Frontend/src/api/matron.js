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

// Schedule
export const getMatronSchedule = () => client.get('/imboni/matron/schedule/')

// Parent Communication
export const getParentComms = () => client.get('/imboni/matron/parent-comms/')
export const sendParentComm = (data) => client.post('/imboni/matron/parent-comms/', data)

// Messages
export const getMatronMessages = () => client.get('/imboni/matron/messages/')
export const sendMatronMessage = (data) => client.post('/imboni/matron/messages/', data)
