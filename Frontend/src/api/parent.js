import client from './client'

// ── Children ────────────────────────────────────────────────────────────────
export const getMyChildren = () => client.get('/imboni/parents/my-children/')

// ── Per-child card data ──────────────────────────────────────────────────────
export const getChildDashboard  = (id) => client.get(`/imboni/parents/${id}/dashboard/`)
export const getChildCard       = (id) => client.get(`/imboni/parents/${id}/card/`)
export const getChildFees       = (id) => client.get(`/imboni/parents/${id}/fees/`)
export const getChildDocuments  = (id) => client.get(`/imboni/parents/${id}/documents/`)
export const getChildSchedule   = (id) => client.get(`/imboni/parents/${id}/schedule/today/`)

// ── Results ──────────────────────────────────────────────────────────────────
export const getChildAssessments = (id) => client.get(`/imboni/results/students/${id}/assessments/`)
export const getChildSummative   = (id) => client.get(`/imboni/results/students/${id}/summative/`)
export const getChildReviews     = (id) => client.get(`/imboni/results/students/${id}/reviews/`)

// ── Attendance ───────────────────────────────────────────────────────────────
export const getChildAttendanceStats    = (id)            => client.get(`/imboni/attendance/students/${id}/stats/`)
export const getChildAttendanceCalendar = (id, month, year) =>
    client.get(`/imboni/attendance/students/${id}/calendar/`, { params: { month, year } })

// ── Behaviour ────────────────────────────────────────────────────────────────
export const getChildBehaviourStats   = (id)      => client.get(`/imboni/behavior/students/${id}/stats/`)
export const getChildBehaviourReports = (id, type) =>
    client.get(`/imboni/behavior/students/${id}/reports/`, { params: type ? { type } : {} })

// ── Announcements ────────────────────────────────────────────────────────────
export const getPublishedAnnouncements = () => client.get('/imboni/announcements/')
export const getAnnouncementStats      = () => client.get('/imboni/announcements/stats/')
export const markAnnouncementRead      = id => client.post(`/imboni/announcements/mark-read/${id}/`)
export const markAllAnnouncementsRead  = ()  => client.post('/imboni/announcements/mark-all-read/')

// ── Messages (no backend endpoint yet) ───────────────────────────────────────
export const getParentMessages = () => client.get('/imboni/parent/messages/')
export const sendParentMessage = (d) => client.post('/imboni/parent/messages/', d)

// ── Consent Requests ──────────────────────────────────────────────────────────
export const getConsentRequests    = ()        => client.get('/imboni/parents/consent-requests/')
export const respondToConsent      = (id, d)   => client.post(`/imboni/parents/consent-requests/${id}/respond/`, d)
