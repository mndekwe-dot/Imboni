import client from './client'

// client.js's response interceptor already unwraps to response.data, so
// these must NOT call .then(r => r.data) again — that was double-unwrapping
// and meant every one of these resolved to undefined in production.
export const getStudentProfile            = ()              => client.get('/imboni/student/profile/')
export const getStudentDashboard          = ()              => client.get('/imboni/student/dashboard/')
export const getStudentResults            = ()              => client.get('/imboni/student/results/')
export const getStudentAssessments        = (studentId)     => client.get(`/imboni/results/students/${studentId}/assessments/`)
export const getStudentAttendanceStats    = ()              => client.get('/imboni/student/attendance/stats/')
export const getStudentAttendanceCalendar = (month, year)   => client.get('/imboni/student/attendance/calendar/', { params: { month, year } })
export const getStudentTimetable          = ()              => client.get('/imboni/student/timetable/')
export const getStudentAssignments        = (status)        => client.get('/imboni/student/assignments/', { params: status ? { status } : {} })
export const submitAssignment             = (id, formData)  => client.post(`/imboni/student/assignments/${id}/submit/`, formData)
export const getStudentActivities         = ()              => client.get('/imboni/student/activities/')
export const getStudentActivityEvents     = ()              => client.get('/imboni/student/activities/events/')
export const joinActivity                 = (id)            => client.post(`/imboni/student/activities/${id}/apply/`)
export const withdrawActivity             = (id)            => client.post(`/imboni/student/activities/${id}/withdraw/`)
export const getStudentDiscipline         = ()              => client.get('/imboni/student/discipline/')
export const getStudentAnnouncements      = ()              => client.get('/imboni/student/announcements/')
export const getAnnouncementStats         = ()              => client.get('/imboni/announcements/stats/')

// Messages — no backend endpoint yet
export const getStudentMessages = () => client.get('/imboni/student/messages/')
export const sendStudentMessage = (d) => client.post('/imboni/student/messages/', d)
