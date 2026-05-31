import client from './client'

// Dashboard
export const getTeacherDashboard = () => client.get('/imboni/teacher/dashboard/')

// Classes
export const getTeacherMyClasses = (params) => client.get('/imboni/teacher/my-classes/', { params })

// Students
export const getTeacherStudents = (params) => client.get('/imboni/teacher/students/', { params })

// Attendance
export const getTeacherAttendanceStats    = (params) => client.get('/imboni/teacher/attendance/stats/', { params })
export const getTeacherAttendanceStudents = (params) => client.get('/imboni/teacher/attendance/students/', { params })
export const markTeacherAttendance        = (data)   => client.post('/imboni/teacher/attendance/mark/', data)

// Results
export const getTeacherResults  = (params) => client.get('/imboni/teacher/results/', { params })
export const submitResult       = (data) => client.post('/imboni/teacher/results/', data)
export const updateResult       = (id, data) => client.patch(`/imboni/teacher/results/${id}/`, data)

// Assignments
export const getAssignments   = (params) => client.get('/imboni/teacher/assignments/', { params })
export const createAssignment = (data) => client.post('/imboni/teacher/assignments/', data)
export const updateAssignment = (id, data) => client.patch(`/imboni/teacher/assignments/${id}/`, data)
export const deleteAssignment = (id) => client.delete(`/imboni/teacher/assignments/${id}/`)

// Timetable
export const getTeacherTimetable = () => client.get('/imboni/teacher/timetable/')

// Announcements
export const getTeacherAnnouncements  = () => client.get('/imboni/teacher/announcements/')
export const createTeacherAnnouncement = (data) => client.post('/imboni/teacher/announcements/', data)

// Messages
export const getTeacherMessages = () => client.get('/imboni/teacher/messages/')
export const sendTeacherMessage = (data) => client.post('/imboni/teacher/messages/', data)
