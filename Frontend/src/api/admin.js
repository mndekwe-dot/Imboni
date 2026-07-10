import client from './client'

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getAdminDashboardStats   = ()       => client.get('/imboni/dos/dashboard/stats/')
export const getAdminRecentActivity   = (params) => client.get('/imboni/dos/dashboard/recent-activity/', { params })

// ── Staff — uses UserViewSet with role filter ─────────────────────────────────
const STAFF_ROLES = 'teacher,dos,matron,discipline,admin'
export const getAdminStaff      = (params) => client.get('/imboni/users/', { params: { role: STAFF_ROLES, ...params } })
export const getAdminTeachers   = (params) => client.get('/imboni/dos/teachers/', { params })
export const getAdminTeacherStats = ()     => client.get('/imboni/dos/teachers/stats/')

// ── Students ─────────────────────────────────────────────────────────────────
export const getAdminStudents     = (params) => client.get('/imboni/dos/students/', { params })
export const getAdminStudentStats = ()       => client.get('/imboni/dos/students/stats/')

// ── Announcements — shared with teacher announcement system ───────────────────
export const getAdminAnnouncements    = (params) => client.get('/imboni/announcements/teacher/', { params })
export const createAdminAnnouncement  = (data)   => client.post('/imboni/announcements/teacher/', data)
export const updateAdminAnnouncement  = (id, data) => client.patch(`/imboni/announcements/teacher/${id}/`, data)
export const deleteAdminAnnouncement  = (id)     => client.delete(`/imboni/announcements/teacher/${id}/`)
export const getAdminAudienceOptions  = ()       => client.get('/imboni/announcements/teacher/audience-options/')
export const getAnnouncementTemplates = ()       => client.get('/imboni/announcements/teacher/templates/')

// ── Settings ─────────────────────────────────────────────────────────────────
export const getAdminSchoolSettings    = () => client.get('/imboni/dos/school-settings/')
export const updateAdminSchoolSettings = (data) => client.patch('/imboni/dos/school-settings/', data)

// ── Staff Invitations ─────────────────────────────────────────────────────────
export const getInvitations   = (params) => client.get('/imboni/auth/invite/list/', { params })
export const sendInvitation   = (data)   => client.post('/imboni/auth/invite/', data)
export const resendInvitation = (id)     => client.post(`/imboni/auth/invite/resend/${id}/`)
export const cancelInvitation = (id)     => client.delete(`/imboni/auth/invite/${id}/cancel/`)

// ── Results Approvals ─────────────────────────────────────────────────────────
export const getPendingResults  = (params)    => client.get('/imboni/dos/results/', { params })
export const approveResult      = (id, data)  => client.patch(`/imboni/dos/results/${id}/approve/`, data)
export const rejectResult       = (id, data)  => client.patch(`/imboni/dos/results/${id}/reject/`, data)
export const bulkApproveResults = (ids)       => client.post('/imboni/dos/results/bulk-approve/', { ids })

// ── Analytics / Reports ───────────────────────────────────────────────────────
export const getAdminAnalytics          = (params) => client.get('/imboni/dos/analytics/', { params })
export const getPerformanceByGrade      = ()       => client.get('/imboni/dos/dashboard/performance-by-grade/')
export const getWeeklyTrend             = ()       => client.get('/imboni/dos/dashboard/weekly-trend/')
export const getEnrollmentByGrade       = ()       => client.get('/imboni/dos/students/enrollment-by-grade/')
export const getPerformanceDistribution = ()       => client.get('/imboni/dos/students/performance-distribution/')
export const getTeachersBySubject       = ()       => client.get('/imboni/dos/teachers/by-subject/')

// ── Student Detail ────────────────────────────────────────────────────────────
export const getStudentDetail          = (id)         => client.get(`/imboni/dos/students/${id}/`)
export const getStudentAttendanceStats = (id)         => client.get(`/imboni/attendance/students/${id}/stats/`)
export const getStudentTermResults     = (id, params) => client.get(`/imboni/results/students/${id}/summative/`, { params })

// ── Finance ───────────────────────────────────────────────────────────────────
export const sendFeeReminders = (data = {}) => client.post('/imboni/analytics/fees/remind/', data)

// ── Audit Log ─────────────────────────────────────────────────────────────────
export const getAuditLog = (params) => client.get('/imboni/admin/audit/', { params })

// ── Term Rollover ─────────────────────────────────────────────────────────────
export const runTermRollover = (data) => client.post('/imboni/dos/term-rollover/', data)
