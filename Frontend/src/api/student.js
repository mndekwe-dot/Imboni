import client from './client'

// Dashboard
export const getStudentDashboard = () => client.get('/imboni/student/dashboard/')

// Results
export const getStudentResults = (params) => client.get('/imboni/student/results/', { params })

// Attendance
export const getStudentAttendance = (params) => client.get('/imboni/student/attendance/', { params })

// Timetable
export const getStudentTimetable = () => client.get('/imboni/student/timetable/')

// Assignments
export const getStudentAssignments = (params) => client.get('/imboni/student/assignments/', { params })
export const submitAssignment      = (id, data) => client.patch(`/imboni/student/assignments/${id}/submit/`, data)

// Activities
export const getStudentActivities = () => client.get('/imboni/student/activities/')

// Discipline
export const getStudentDiscipline = () => client.get('/imboni/student/discipline/')

// Announcements
export const getStudentAnnouncements = () => client.get('/imboni/student/announcements/')

// Messages
export const getStudentMessages = () => client.get('/imboni/student/messages/')
export const sendStudentMessage = (data) => client.post('/imboni/student/messages/', data)
