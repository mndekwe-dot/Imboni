import client from './client'

const data = r => r.data

export const getStudentProfile            = ()              => client.get('/imboni/student/profile/').then(data)
export const getStudentDashboard          = ()              => client.get('/imboni/student/dashboard/').then(data)
export const getStudentResults            = ()              => client.get('/imboni/student/results/').then(data)
export const getStudentAssessments        = (studentId)     => client.get(`/imboni/results/students/${studentId}/assessments/`).then(data)
export const getStudentAttendanceStats    = ()              => client.get('/imboni/student/attendance/stats/').then(data)
export const getStudentAttendanceCalendar = (month, year)   => client.get('/imboni/student/attendance/calendar/', { params: { month, year } }).then(data)
export const getStudentTimetable          = ()              => client.get('/imboni/student/timetable/').then(data)
export const getStudentAssignments        = (status)        => client.get('/imboni/student/assignments/', { params: status ? { status } : {} }).then(data)
export const submitAssignment             = (id, formData)  => client.post(`/imboni/student/assignments/${id}/submit/`, formData).then(data)
export const getStudentActivities         = ()              => client.get('/imboni/student/activities/').then(data)
export const getStudentActivityEvents     = ()              => client.get('/imboni/student/activities/events/').then(data)
export const joinActivity                 = (id)            => client.post(`/imboni/student/activities/${id}/apply/`).then(data)
export const withdrawActivity             = (id)            => client.post(`/imboni/student/activities/${id}/withdraw/`).then(data)
export const getStudentDiscipline         = ()              => client.get('/imboni/student/discipline/').then(data)
export const getStudentAnnouncements      = ()              => client.get('/imboni/student/announcements/').then(data)
export const getAnnouncementStats         = ()              => client.get('/imboni/announcements/stats/').then(data)

// Messages — no backend endpoint yet
export const getStudentMessages = () => client.get('/imboni/student/messages/')
export const sendStudentMessage = (d) => client.post('/imboni/student/messages/', d)
