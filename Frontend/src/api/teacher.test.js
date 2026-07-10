import { describe, it, expect, vi, beforeEach } from 'vitest'
import client from './client'
import * as teacher from './teacher'

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

describe('teacher api', () => {
  beforeEach(() => vi.resetAllMocks())

  it('dashboard endpoints', () => {
    teacher.getTeacherDashboardStats()
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/dashboard/stats/')

    teacher.getTeacherTodaySchedule()
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/my-timetable/today/')

    teacher.getTeacherTimetable()
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/my-timetable/')

    teacher.getClassTimetable(5)
    expect(client.get).toHaveBeenCalledWith('/imboni/dos/timetable/', { params: { class_id: 5 } })

    teacher.getTeacherClassPerformance()
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/class-performance/')

    teacher.getTeacherRecentActivities({ limit: 5 })
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/recent-activities/', { params: { limit: 5 } })
  })

  it('tasks CRUD', () => {
    teacher.getTeacherTasks()
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/tasks/')

    const data = { title: 'task' }
    teacher.createTeacherTask(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/teacher/tasks/', data)

    teacher.updateTeacherTask(1, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/teacher/tasks/1/', data)

    teacher.deleteTeacherTask(1)
    expect(client.delete).toHaveBeenCalledWith('/imboni/teacher/tasks/1/')
  })

  it('classes + students', () => {
    teacher.getTeacherMyClasses({ term: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/my-classes/', { params: { term: 1 } })

    teacher.getTeacherStudents({ class_id: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/students/', { params: { class_id: 1 } })
  })

  it('attendance endpoints', () => {
    teacher.getTeacherAttendanceStats({ class_id: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/attendance/stats/', { params: { class_id: 1 } })

    teacher.getTeacherAttendanceStudents({ class_id: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/attendance/students/', { params: { class_id: 1 } })

    const data = { date: '2026-06-29' }
    teacher.markTeacherAttendance(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/teacher/attendance/mark/', data)
  })

  it('results endpoints', () => {
    teacher.getTeacherResultList({ class_id: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/results/list/', { params: { class_id: 1 } })

    const data = { results: [] }
    teacher.bulkSaveResults(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/teacher/results/bulk-save/', data)
  })

  it('announcements CRUD', () => {
    teacher.getTeacherAnnouncements({ grade: 'S1' })
    expect(client.get).toHaveBeenCalledWith('/imboni/announcements/teacher/', { params: { grade: 'S1' } })

    const data = { title: 'x' }
    teacher.createTeacherAnnouncement(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/announcements/teacher/', data)

    teacher.updateTeacherAnnouncement(2, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/announcements/teacher/2/', data)

    teacher.deleteTeacherAnnouncement(2)
    expect(client.delete).toHaveBeenCalledWith('/imboni/announcements/teacher/2/')

    teacher.getTeacherAudienceOptions()
    expect(client.get).toHaveBeenCalledWith('/imboni/announcements/teacher/audience-options/')
  })

  it('messages and subjects', () => {
    teacher.getTeacherMessages()
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/messages/')

    const data = { text: 'hi' }
    teacher.sendTeacherMessage(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/teacher/messages/', data)

    teacher.getTeacherSubjects()
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/subjects/')
  })

  it('assignments CRUD + submissions', () => {
    teacher.getTeacherAssignments({ class_id: 1 })
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/assignments/', { params: { class_id: 1 } })

    const data = { title: 'HW' }
    teacher.createTeacherAssignment(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/teacher/assignments/', data)

    teacher.updateTeacherAssignment(3, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/teacher/assignments/3/', data)

    teacher.deleteTeacherAssignment(3)
    expect(client.delete).toHaveBeenCalledWith('/imboni/teacher/assignments/3/')

    teacher.getAssignmentSubmissions(3)
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/assignments/3/submissions/')
  })

  it('question bank CRUD', () => {
    teacher.getQuestionBank({ subject: 'Math' })
    expect(client.get).toHaveBeenCalledWith('/imboni/teacher/question-bank/', { params: { subject: 'Math' } })

    const data = { question: 'What is 1+1?' }
    teacher.saveToQuestionBank(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/teacher/question-bank/', data)

    teacher.deleteFromQuestionBank(4)
    expect(client.delete).toHaveBeenCalledWith('/imboni/teacher/question-bank/4/')
  })

  it('quiz endpoints', () => {
    teacher.getStudentQuizzes()
    expect(client.get).toHaveBeenCalledWith('/imboni/quiz/')

    teacher.getQuizForStudent(5)
    expect(client.get).toHaveBeenCalledWith('/imboni/quiz/5/')

    const data = { answers: [] }
    teacher.submitQuizAnswers(5, data)
    expect(client.post).toHaveBeenCalledWith('/imboni/quiz/5/submit/', data)
  })
})
