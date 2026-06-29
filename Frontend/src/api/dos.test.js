import { describe, it, expect, vi, beforeEach } from 'vitest'
import client from './client'
import * as dos from './dos'

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

describe('dos api', () => {
  beforeEach(() => vi.resetAllMocks())

  it('dashboard endpoints', () => {
    dos.getDosDashboardStats()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/dashboard/stats/')

    dos.getDosRecentActivity({ limit: 5 })
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/dashboard/recent-activity/', { params: { limit: 5 } })

    dos.getDosWeeklyTrend()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/dashboard/weekly-trend/')

    dos.getDosPerformanceByGrade()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/dashboard/performance-by-grade/')
  })

  it('student endpoints', () => {
    dos.getDosStudents({ page: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/students/', { params: { page: 1 } })

    dos.getDosStudentStats()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/students/stats/')

    const data = { name: 'X' }
    dos.createDosStudent(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/dos/students/', data)
  })

  it('teacher endpoints', () => {
    dos.getDosTeachers({ page: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/teachers/', { params: { page: 1 } })

    dos.getDosTeacherStats()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/teachers/stats/')

    const data = { name: 'Y' }
    dos.updateDosTeacher(1, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/teachers/1/', data)

    dos.getDosTeacherClasses(1)
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/teachers/1/classes/')

    dos.assignDosTeacherClasses(1, ['S1A'])
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/teachers/1/classes/', { classes: ['S1A'] })
  })

  it('results endpoints', () => {
    dos.getDosResults({ status: 'pending' })
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/results/', { params: { status: 'pending' } })

    dos.approveResult(2)
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/results/2/approve/')

    dos.rejectResult(2, 'bad')
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/results/2/reject/', { reason: 'bad' })
  })

  it('exam schedule CRUD', () => {
    dos.getDosExamSchedule()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/exam-schedule/')

    const data = { date: '2026-01-01' }
    dos.createDosExamSchedule(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/dos/exam-schedule/', data)

    dos.updateDosExamSchedule(3, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/exam-schedule/3/', data)

    dos.deleteDosExamSchedule(3)
    expect(client.delete).toHaveBeenCalledWith('/imboni/dos/exam-schedule/3/')
  })

  it('student leaders, terms, config, settings', () => {
    dos.getDosStudentLeaders()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/student-leaders/')

    dos.getTerms()
    expect(client.get).toHaveBeenCalledWith('/imboni/results/terms/')

    dos.getCurrentTerm()
    expect(client.get).toHaveBeenCalledWith('/imboni/results/terms/current/')

    dos.getSchoolConfig()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/school-config/')

    const config = [{ name: 'O-Level' }]
    dos.updateSchoolConfig(config)
    expect(client.put).toHaveBeenCalledWith('/imboni/dos/school-config/', config)

    dos.getSchoolSettings()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/school-settings/')

    const settings = { school_name: 'X' }
    dos.updateSchoolSettings(settings)
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/school-settings/', settings)
  })

  it('subject management CRUD', () => {
    dos.getSubjects()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/subjects/')

    const data = { name: 'Math' }
    dos.createSubject(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/dos/subjects/', data)

    dos.updateSubject(4, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/subjects/4/', data)

    dos.deleteSubject(4)
    expect(client.delete).toHaveBeenCalledWith('/imboni/dos/subjects/4/')

    dos.renameSubjectCategory('Old', 'New')
    expect(client.post).toHaveBeenCalledWith('/imboni/dos/subject-categories/rename/', { old_name: 'Old', new_name: 'New' })

    dos.deleteSubjectCategory('Sciences')
    expect(client.delete).toHaveBeenCalledWith('/imboni/dos/subject-categories/delete/', { data: { name: 'Sciences' } })
  })

  it('student invite endpoints', () => {
    const data = { email: 'a@b.com' }
    dos.inviteDosStudent(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/dos/students/invite/', data)

    const file = new File(['x'], 'students.csv')
    dos.bulkInviteDosStudents(file)
    expect(client.post).toHaveBeenCalledTimes(2)
    const [url, form] = client.post.mock.calls[1]
    expect(url).toBe('/imboni/dos/students/invite/bulk/')
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('file')).toBe(file)
  })

  it('classes and attendance endpoints', () => {
    dos.getDosClasses()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/classes/')

    dos.getDosWeeklyAttendance({ class_id: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/attendance/class/weekly/', { params: { class_id: 1 } })

    dos.getDosTeacherWeeklyAttendance({ teacher_id: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/attendance/teacher/weekly/', { params: { teacher_id: 1 } })

    const data = { date: '2026-01-01' }
    dos.markDosTeacherAttendance(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/attendance/teacher/mark/', data)
  })

  it('student detail & actions', () => {
    dos.getDosStudentDetail(5)
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/students/5/')

    const data = { reason: 'fight' }
    dos.suspendDosStudent(5, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/students/5/suspend/', data)

    dos.changeDosStudentClass(5, { class: 'S2A' })
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/students/5/change-class/', { class: 'S2A' })

    dos.appointStudentLeader(5, { role: 'prefect' })
    expect(client.post).toHaveBeenCalledWith('/imboni/dos/students/5/appoint-leader/', { role: 'prefect' })

    dos.removeStudentLeader(5, 'prefect')
    expect(client.delete).toHaveBeenCalledWith('/imboni/dos/students/5/remove-leader/prefect/')
  })

  it('timetable endpoints, including delete with trailing slash', () => {
    dos.getDosRooms()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/rooms/')

    dos.createDosRoom('Room 1')
    expect(client.post).toHaveBeenCalledWith('/imboni/dos/rooms/', { name: 'Room 1' })

    dos.deleteDosRoom(6)
    expect(client.delete).toHaveBeenCalledWith('/imboni/dos/rooms/6/')

    dos.getDosTimetable('S1A')
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/timetable/', { params: { class_id: 'S1A' } })

    const slot = { day: 'Mon' }
    dos.saveDosSlot(slot)
    expect(client.post).toHaveBeenCalledWith('/imboni/dos/timetable/', slot)

    dos.updateDosSlot(7, slot)
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/timetable/7/', slot)

    // Regression: deleteDosSlot was missing the trailing slash that Django's
    // URL routing requires (apps/dos/urls.py: 'dos/timetable/<uuid:pk>/'),
    // which meant the DELETE request would 404 / get redirected.
    dos.deleteDosSlot(7)
    expect(client.delete).toHaveBeenCalledWith('/imboni/dos/timetable/7/')

    dos.getDosTeachersBySubjectAndClass(1, 2)
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/teachers/', { params: { subject_id: 1, class_id: 2 } })
  })

  it('analytics endpoints', () => {
    dos.getDosAnalytics({ term: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/analytics/', { params: { term: 1 } })

    dos.getDosAttendanceStats()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/attendance/overview/')
  })

  it('announcements CRUD', () => {
    dos.getDosAnnouncements({ grade: 'S1' })
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/announcements/', { params: { grade: 'S1' } })

    const data = { title: 'x' }
    dos.createDosAnnouncement(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/dos/announcements/', data)

    dos.updateDosAnnouncement(8, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/announcements/8/', data)

    dos.deleteDosAnnouncement(8)
    expect(client.delete).toHaveBeenCalledWith('/imboni/dos/announcements/8/')
  })

  it('tasks CRUD', () => {
    dos.getDosTasks()
    expect(client.get).toHaveBeenCalledWith('/imboni/tasks/')

    const data = { title: 'task' }
    dos.createDosTask(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/tasks/', data)

    dos.updateDosTask(9, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/tasks/9/', data)

    dos.deleteDosTask(9)
    expect(client.delete).toHaveBeenCalledWith('/imboni/tasks/9/')
  })

  it('activity management endpoints', () => {
    dos.getDosActivities()
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/activities/')

    const data = { name: 'Chess' }
    dos.patchDosActivity(10, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/dos/activities/10/', data)

    dos.deleteDosActivity(10)
    expect(client.delete).toHaveBeenCalledWith('/imboni/dos/activities/10/')
  })
})
