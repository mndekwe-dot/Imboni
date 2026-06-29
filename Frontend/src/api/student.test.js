import { describe, it, expect, vi, beforeEach } from 'vitest'
import client from './client'
import * as student from './student'

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

// client.js's response interceptor already unwraps to response.data, so
// every function here just returns client.get/post(...) directly — there is
// no second .then(r => r.data) to test; these are thin URL-building wrappers.
describe('student api', () => {
  beforeEach(() => vi.resetAllMocks())

  it('profile, dashboard and results endpoints', () => {
    student.getStudentProfile()
    expect(client.get).toHaveBeenCalledWith('/imboni/student/profile/')

    student.getStudentDashboard()
    expect(client.get).toHaveBeenCalledWith('/imboni/student/dashboard/')

    student.getStudentResults()
    expect(client.get).toHaveBeenCalledWith('/imboni/student/results/')
  })

  it('resolves directly to whatever client.get resolves to, with no extra unwrapping', async () => {
    client.get.mockResolvedValue({ id: 1, name: 'X' })
    const result = await student.getStudentProfile()
    expect(result).toEqual({ id: 1, name: 'X' })
  })

  it('getStudentAssessments uses the given studentId', () => {
    student.getStudentAssessments(9)
    expect(client.get).toHaveBeenCalledWith('/imboni/results/students/9/assessments/')
  })

  it('attendance endpoints', () => {
    student.getStudentAttendanceStats()
    expect(client.get).toHaveBeenCalledWith('/imboni/student/attendance/stats/')

    student.getStudentAttendanceCalendar(6, 2026)
    expect(client.get).toHaveBeenCalledWith('/imboni/student/attendance/calendar/', { params: { month: 6, year: 2026 } })
  })

  it('timetable and assignments', () => {
    student.getStudentTimetable()
    expect(client.get).toHaveBeenCalledWith('/imboni/student/timetable/')

    student.getStudentAssignments()
    expect(client.get).toHaveBeenCalledWith('/imboni/student/assignments/', { params: {} })

    student.getStudentAssignments('pending')
    expect(client.get).toHaveBeenCalledWith('/imboni/student/assignments/', { params: { status: 'pending' } })

    const form = new FormData()
    student.submitAssignment(10, form)
    expect(client.post).toHaveBeenCalledWith('/imboni/student/assignments/10/submit/', form)
  })

  it('activities endpoints', () => {
    student.getStudentActivities()
    expect(client.get).toHaveBeenCalledWith('/imboni/student/activities/')

    student.getStudentActivityEvents()
    expect(client.get).toHaveBeenCalledWith('/imboni/student/activities/events/')

    student.joinActivity(11)
    expect(client.post).toHaveBeenCalledWith('/imboni/student/activities/11/apply/')

    student.withdrawActivity(11)
    expect(client.post).toHaveBeenCalledWith('/imboni/student/activities/11/withdraw/')
  })

  it('discipline, announcements, stats', () => {
    student.getStudentDiscipline()
    expect(client.get).toHaveBeenCalledWith('/imboni/student/discipline/')

    student.getStudentAnnouncements()
    expect(client.get).toHaveBeenCalledWith('/imboni/student/announcements/')

    student.getAnnouncementStats()
    expect(client.get).toHaveBeenCalledWith('/imboni/announcements/stats/')
  })

  it('messages endpoints', () => {
    client.get.mockReturnValue('raw-get-result')
    const getResult = student.getStudentMessages()
    expect(client.get).toHaveBeenCalledWith('/imboni/student/messages/')
    expect(getResult).toBe('raw-get-result')

    client.post.mockReturnValue('raw-post-result')
    const data = { text: 'hi' }
    const postResult = student.sendStudentMessage(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/student/messages/', data)
    expect(postResult).toBe('raw-post-result')
  })
})
