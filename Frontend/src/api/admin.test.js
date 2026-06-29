import { describe, it, expect, vi, beforeEach } from 'vitest'
import client from './client'
import * as admin from './admin'

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

describe('admin api', () => {
  beforeEach(() => vi.resetAllMocks())

  it('dashboard endpoints', () => {
    admin.getAdminDashboardStats()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/dashboard/stats/')

    admin.getAdminRecentActivity({ limit: 5 })
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/dashboard/recent-activity/', { params: { limit: 5 } })
  })

  it('getAdminStaff merges the STAFF_ROLES filter with extra params', () => {
    admin.getAdminStaff({ search: 'jean' })
    expect(client.get).toHaveBeenCalledWith('/imboni/users/', {
      params: { role: 'teacher,dos,matron,discipline,admin', search: 'jean' },
    })
  })

  it('teacher and student listing endpoints', () => {
    admin.getAdminTeachers({ page: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/teachers/', { params: { page: 1 } })

    admin.getAdminTeacherStats()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/teachers/stats/')

    admin.getAdminStudents({ page: 2 })
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/students/', { params: { page: 2 } })

    admin.getAdminStudentStats()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/students/stats/')
  })

  it('announcement CRUD endpoints', () => {
    admin.getAdminAnnouncements({ grade: 'S1' })
    expect(client.get).toHaveBeenCalledWith('/imboni/announcements/teacher/', { params: { grade: 'S1' } })

    const data = { title: 'hi' }
    admin.createAdminAnnouncement(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/announcements/teacher/', data)

    admin.updateAdminAnnouncement(3, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/announcements/teacher/3/', data)

    admin.deleteAdminAnnouncement(3)
    expect(client.delete).toHaveBeenCalledWith('/imboni/announcements/teacher/3/')

    admin.getAdminAudienceOptions()
    expect(client.get).toHaveBeenCalledWith('/imboni/announcements/teacher/audience-options/')

    admin.getAnnouncementTemplates()
    expect(client.get).toHaveBeenCalledWith('/imboni/announcements/teacher/templates/')
  })

  it('school settings endpoints', () => {
    admin.getAdminSchoolSettings()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/school-settings/')

    const data = { school_name: 'X' }
    admin.updateAdminSchoolSettings(data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/school-settings/', data)
  })

  it('invitation endpoints', () => {
    admin.getInvitations({ status: 'pending' })
    expect(client.get).toHaveBeenCalledWith('/imboni/auth/invite/list/', { params: { status: 'pending' } })

    const data = { email: 'a@b.com' }
    admin.sendInvitation(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/auth/invite/', data)

    admin.resendInvitation(7)
    expect(client.post).toHaveBeenCalledWith('/imboni/auth/invite/resend/7/')

    admin.cancelInvitation(7)
    expect(client.delete).toHaveBeenCalledWith('/imboni/auth/invite/7/cancel/')
  })

  it('results approval endpoints', () => {
    admin.getPendingResults({ status: 'pending' })
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/results/', { params: { status: 'pending' } })

    admin.approveResult(9, { note: 'ok' })
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/results/9/approve/', { note: 'ok' })

    admin.rejectResult(9, { reason: 'bad' })
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/results/9/reject/', { reason: 'bad' })

    admin.bulkApproveResults([1, 2, 3])
    expect(client.post).toHaveBeenCalledWith('/imboni/dos/results/bulk-approve/', { ids: [1, 2, 3] })
  })

  it('analytics endpoints', () => {
    admin.getAdminAnalytics({ term: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/analytics/', { params: { term: 1 } })

    admin.getPerformanceByGrade()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/dashboard/performance-by-grade/')

    admin.getWeeklyTrend()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/dashboard/weekly-trend/')

    admin.getEnrollmentByGrade()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/students/enrollment-by-grade/')

    admin.getPerformanceDistribution()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/students/performance-distribution/')

    admin.getTeachersBySubject()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/teachers/by-subject/')
  })

  it('student detail endpoints', () => {
    admin.getStudentDetail(4)
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/students/4/')

    admin.getStudentAttendanceStats(4)
    expect(client.get).toHaveBeenCalledWith('/imboni/attendance/students/4/stats/')

    admin.getStudentTermResults(4, { term: 2 })
    expect(client.get).toHaveBeenCalledWith('/imboni/results/students/4/summative/', { params: { term: 2 } })
  })
})
