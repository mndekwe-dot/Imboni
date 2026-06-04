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
export const getDisActivities  = ()       => client.get('/imboni/discipline/activities/')
export const createDisActivity = (d)      => client.post('/imboni/discipline/activities/', d)
export const patchDisActivity  = (id, d)  => client.patch(`/imboni/discipline/activities/${id}/`, d)
export const deleteDisActivity = (id)     => client.delete(`/imboni/discipline/activities/${id}/`)

// Boarding
export const getDisBoarding    = ()       => client.get('/imboni/discipline/boarding/')
export const createDisBoarding = (d)      => client.post('/imboni/discipline/boarding/', d)
export const patchDisBoarding  = (id, d)  => client.patch(`/imboni/discipline/boarding/${id}/`, d)
export const deleteDisBoarding = (id)     => client.delete(`/imboni/discipline/boarding/${id}/`)

// Facilities (dormitories, dining halls, rooms)
export const getDisFacilities   = (params) => client.get('/imboni/discipline/facilities/', { params })
export const createDisFacility  = (d)      => client.post('/imboni/discipline/facilities/', d)
export const patchDisFacility   = (id, d)  => client.patch(`/imboni/discipline/facilities/${id}/`, d)
export const deleteDisFacility  = (id)     => client.delete(`/imboni/discipline/facilities/${id}/`)

// Facility Sections (dormitory groupings)
export const getDisFacilitySections   = ()      => client.get('/imboni/discipline/facility-sections/')
export const createDisFacilitySection = (d)     => client.post('/imboni/discipline/facility-sections/', d)
export const patchDisFacilitySection  = (id, d) => client.patch(`/imboni/discipline/facility-sections/${id}/`, d)
export const deleteDisFacilitySection = (id)    => client.delete(`/imboni/discipline/facility-sections/${id}/`)

// Dining
export const getDisDining    = ()      => client.get('/imboni/discipline/dining/')
export const createDisDining = (d)     => client.post('/imboni/discipline/dining/', d)
export const patchDisDining  = (id, d) => client.patch(`/imboni/discipline/dining/${id}/`, d)
export const deleteDisDining = (id)    => client.delete(`/imboni/discipline/dining/${id}/`)

// Discipline Staff (Matrons & Patrons)
export const getDisStaff    = (params) => client.get('/imboni/discipline/staff/', { params })
export const createDisStaff = (d)      => client.post('/imboni/discipline/staff/', d)
export const updateDisStaff = (id, d)  => client.patch(`/imboni/discipline/staff/${id}/`, d)
export const deleteDisStaff = (id)     => client.delete(`/imboni/discipline/staff/${id}/`)

// Student Leaders
export const getDisStudentLeaders    = ()       => client.get('/imboni/discipline/student-leaders/')
export const createDisStudentLeader  = (d)      => client.post('/imboni/discipline/student-leaders/', d)
export const patchDisStudentLeader   = (id, d)  => client.patch(`/imboni/discipline/student-leaders/${id}/`, d)
export const deleteDisStudentLeader  = (id)     => client.delete(`/imboni/discipline/student-leaders/${id}/`)
export const getDisCurrentTerm       = ()       => client.get('/imboni/discipline/current-term/')

// Announcements
export const getDisAnnouncements    = (params) => client.get('/imboni/discipline/announcements/', { params })
export const createDisAnnouncement  = (d)      => client.post('/imboni/discipline/announcements/', d)
export const updateDisAnnouncement  = (id, d)  => client.patch(`/imboni/discipline/announcements/${id}/`, d)
export const deleteDisAnnouncement  = (id)     => client.delete(`/imboni/discipline/announcements/${id}/`)

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
