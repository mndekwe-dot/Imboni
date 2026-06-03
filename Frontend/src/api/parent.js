import client from './client'

const data = r => r.data

// ── Children ────────────────────────────────────────────────────────────────
export const getMyChildren = () => client.get('/imboni/parents/my-children/').then(data)

// ── Per-child card data ──────────────────────────────────────────────────────
export const getChildDashboard  = (id) => client.get(`/imboni/parents/${id}/dashboard/`).then(data)
export const getChildCard       = (id) => client.get(`/imboni/parents/${id}/card/`).then(data)
export const getChildFees       = (id) => client.get(`/imboni/parents/${id}/fees/`).then(data)
export const getChildDocuments  = (id) => client.get(`/imboni/parents/${id}/documents/`).then(data)
export const getChildSchedule   = (id) => client.get(`/imboni/parents/${id}/schedule/today/`).then(data)

// ── Results ──────────────────────────────────────────────────────────────────
export const getChildAssessments = (id) => client.get(`/imboni/results/students/${id}/assessments/`).then(data)
export const getChildSummative   = (id) => client.get(`/imboni/results/students/${id}/summative/`).then(data)
export const getChildReviews     = (id) => client.get(`/imboni/results/students/${id}/reviews/`).then(data)

// ── Attendance ───────────────────────────────────────────────────────────────
export const getChildAttendanceStats = (id) =>
    client.get(`/imboni/attendance/students/${id}/stats/`).then(data)
export const getChildAttendanceCalendar = (id, month, year) =>
    client.get(`/imboni/attendance/students/${id}/calendar/`, { params: { month, year } }).then(data)

// ── Behaviour ────────────────────────────────────────────────────────────────
export const getChildBehaviourStats   = (id) => client.get(`/imboni/behavior/students/${id}/stats/`).then(data)
export const getChildBehaviourReports = (id, type) =>
    client.get(`/imboni/behavior/students/${id}/reports/`, { params: type ? { type } : {} }).then(data)

// ── Announcements ────────────────────────────────────────────────────────────
export const getPublishedAnnouncements = () => client.get('/imboni/announcements/').then(data)
export const getAnnouncementStats      = () => client.get('/imboni/announcements/stats/').then(data)

// ── Messages (no backend endpoint yet) ───────────────────────────────────────
export const getParentMessages = () => client.get('/imboni/parent/messages/')
export const sendParentMessage = (d) => client.post('/imboni/parent/messages/', d)
