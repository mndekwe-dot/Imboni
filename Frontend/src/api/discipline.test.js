import { describe, it, expect, vi, beforeEach } from 'vitest'
import client from './client'
import * as dis from './discipline'

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

describe('discipline api', () => {
  beforeEach(() => vi.resetAllMocks())

  it('dashboard and students', () => {
    dis.getDisDashboard()
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/dashboard/')

    dis.getDisStudents({ q: 'a' })
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/students/', { params: { q: 'a' } })

    dis.getDisStudent(1)
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/students/1/')
  })

  it('behavior reports CRUD + review', () => {
    dis.getDisReports({ type: 'x' })
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/reports/', { params: { type: 'x' } })

    dis.getDisReport(2)
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/reports/2/')

    const data = { note: 'x' }
    dis.createDisReport(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/discipline/reports/', data)

    dis.updateDisReport(2, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/discipline/reports/2/', data)

    dis.reviewDisReport(2, data)
    expect(client.post).toHaveBeenCalledWith('/imboni/discipline/reports/2/review/', data)
  })

  it('activities CRUD', () => {
    dis.getDisActivities()
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/activities/')

    const data = { name: 'Chess' }
    dis.createDisActivity(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/discipline/activities/', data)

    dis.patchDisActivity(3, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/discipline/activities/3/', data)

    dis.deleteDisActivity(3)
    expect(client.delete).toHaveBeenCalledWith('/imboni/discipline/activities/3/')
  })

  it('boarding CRUD', () => {
    dis.getDisBoarding()
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/boarding/')

    const data = { room: '1' }
    dis.createDisBoarding(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/discipline/boarding/', data)

    dis.patchDisBoarding(4, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/discipline/boarding/4/', data)

    dis.deleteDisBoarding(4)
    expect(client.delete).toHaveBeenCalledWith('/imboni/discipline/boarding/4/')
  })

  it('facilities CRUD', () => {
    dis.getDisFacilities({ type: 'dorm' })
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/facilities/', { params: { type: 'dorm' } })

    const data = { name: 'Block A' }
    dis.createDisFacility(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/discipline/facilities/', data)

    dis.patchDisFacility(5, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/discipline/facilities/5/', data)

    dis.deleteDisFacility(5)
    expect(client.delete).toHaveBeenCalledWith('/imboni/discipline/facilities/5/')
  })

  it('facility sections CRUD', () => {
    dis.getDisFacilitySections()
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/facility-sections/')

    const data = { name: 'Section A' }
    dis.createDisFacilitySection(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/discipline/facility-sections/', data)

    dis.patchDisFacilitySection(6, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/discipline/facility-sections/6/', data)

    dis.deleteDisFacilitySection(6)
    expect(client.delete).toHaveBeenCalledWith('/imboni/discipline/facility-sections/6/')
  })

  it('dining CRUD', () => {
    dis.getDisDining()
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/dining/')

    const data = { name: 'Hall A' }
    dis.createDisDining(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/discipline/dining/', data)

    dis.patchDisDining(7, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/discipline/dining/7/', data)

    dis.deleteDisDining(7)
    expect(client.delete).toHaveBeenCalledWith('/imboni/discipline/dining/7/')
  })

  it('staff CRUD', () => {
    dis.getDisStaff({ role: 'matron' })
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/staff/', { params: { role: 'matron' } })

    const data = { name: 'Mary' }
    dis.createDisStaff(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/discipline/staff/', data)

    dis.updateDisStaff(8, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/discipline/staff/8/', data)

    dis.deleteDisStaff(8)
    expect(client.delete).toHaveBeenCalledWith('/imboni/discipline/staff/8/')
  })

  it('student leaders CRUD + current term', () => {
    dis.getDisStudentLeaders()
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/student-leaders/')

    const data = { role: 'prefect' }
    dis.createDisStudentLeader(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/discipline/student-leaders/', data)

    dis.patchDisStudentLeader(9, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/discipline/student-leaders/9/', data)

    dis.deleteDisStudentLeader(9)
    expect(client.delete).toHaveBeenCalledWith('/imboni/discipline/student-leaders/9/')

    dis.getDisCurrentTerm()
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/current-term/')
  })

  it('announcements CRUD', () => {
    dis.getDisAnnouncements({ grade: 'S1' })
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/announcements/', { params: { grade: 'S1' } })

    const data = { title: 'x' }
    dis.createDisAnnouncement(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/discipline/announcements/', data)

    dis.updateDisAnnouncement(10, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/discipline/announcements/10/', data)

    dis.deleteDisAnnouncement(10)
    expect(client.delete).toHaveBeenCalledWith('/imboni/discipline/announcements/10/')
  })

  it('student behavior stats/reports', () => {
    dis.getStudentBehaviorStats(11)
    expect(client.get).toHaveBeenCalledWith('/imboni/behavior/students/11/stats/')

    dis.getStudentBehaviorReports(11, { type: 'positive' })
    expect(client.get).toHaveBeenCalledWith('/imboni/behavior/students/11/reports/', { params: { type: 'positive' } })
  })

  it('messages', () => {
    dis.getDisMessages()
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/messages/')

    const data = { text: 'hi' }
    dis.sendDisMessage(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/discipline/messages/', data)
  })

  it('tasks CRUD', () => {
    dis.getDisTasks()
    expect(client.get).toHaveBeenCalledWith('/imboni/tasks/')

    const data = { title: 'task' }
    dis.createDisTask(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/tasks/', data)

    dis.updateDisTask(12, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/tasks/12/', data)

    dis.deleteDisTask(12)
    expect(client.delete).toHaveBeenCalledWith('/imboni/tasks/12/')
  })

  it('extracurricular CRUD with default week param', () => {
    dis.getDisExtracurricular()
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/extracurricular/', { params: { week: 'default' } })

    dis.getDisExtracurricular('2026-W10')
    expect(client.get).toHaveBeenCalledWith('/imboni/discipline/extracurricular/', { params: { week: '2026-W10' } })

    const data = { day: 'Mon' }
    dis.createDisExtracurricular(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/discipline/extracurricular/', data)

    dis.patchDisExtracurricular(13, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/discipline/extracurricular/13/', data)

    dis.deleteDisExtracurricular(13)
    expect(client.delete).toHaveBeenCalledWith('/imboni/discipline/extracurricular/13/')
  })
})
