import { describe, it, expect, vi, beforeEach } from 'vitest'
import client from './client'
import * as parent from './parent'

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

describe('parent api', () => {
  beforeEach(() => vi.resetAllMocks())

  it('children + per-child card data', () => {
    parent.getMyChildren()
    expect(client.get).toHaveBeenCalledWith('/imboni/parents/my-children/')

    parent.getChildDashboard(1)
    expect(client.get).toHaveBeenCalledWith('/imboni/parents/1/dashboard/')

    parent.getChildCard(1)
    expect(client.get).toHaveBeenCalledWith('/imboni/parents/1/card/')

    parent.getChildFees(1)
    expect(client.get).toHaveBeenCalledWith('/imboni/parents/1/fees/')

    parent.getChildDocuments(1)
    expect(client.get).toHaveBeenCalledWith('/imboni/parents/1/documents/')

    parent.getChildSchedule(1)
    expect(client.get).toHaveBeenCalledWith('/imboni/parents/1/schedule/today/')
  })

  it('results endpoints', () => {
    parent.getChildAssessments(2)
    expect(client.get).toHaveBeenCalledWith('/imboni/results/students/2/assessments/')

    parent.getChildSummative(2)
    expect(client.get).toHaveBeenCalledWith('/imboni/results/students/2/summative/')

    parent.getChildReviews(2)
    expect(client.get).toHaveBeenCalledWith('/imboni/results/students/2/reviews/')
  })

  it('attendance endpoints', () => {
    parent.getChildAttendanceStats(3)
    expect(client.get).toHaveBeenCalledWith('/imboni/attendance/students/3/stats/')

    parent.getChildAttendanceCalendar(3, 6, 2026)
    expect(client.get).toHaveBeenCalledWith('/imboni/attendance/students/3/calendar/', { params: { month: 6, year: 2026 } })
  })

  it('behaviour endpoints, with and without type filter', () => {
    parent.getChildBehaviourStats(4)
    expect(client.get).toHaveBeenCalledWith('/imboni/behavior/students/4/stats/')

    parent.getChildBehaviourReports(4)
    expect(client.get).toHaveBeenCalledWith('/imboni/behavior/students/4/reports/', { params: {} })

    parent.getChildBehaviourReports(4, 'positive')
    expect(client.get).toHaveBeenCalledWith('/imboni/behavior/students/4/reports/', { params: { type: 'positive' } })
  })

  it('announcements endpoints', () => {
    parent.getPublishedAnnouncements()
    expect(client.get).toHaveBeenCalledWith('/imboni/announcements/')

    parent.getAnnouncementStats()
    expect(client.get).toHaveBeenCalledWith('/imboni/announcements/stats/')

    parent.markAnnouncementRead(5)
    expect(client.post).toHaveBeenCalledWith('/imboni/announcements/mark-read/5/')

    parent.markAllAnnouncementsRead()
    expect(client.post).toHaveBeenCalledWith('/imboni/announcements/mark-all-read/')
  })

  it('messages endpoints', () => {
    parent.getParentMessages()
    expect(client.get).toHaveBeenCalledWith('/imboni/parent/messages/')

    const data = { text: 'hi' }
    parent.sendParentMessage(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/parent/messages/', data)
  })
})
