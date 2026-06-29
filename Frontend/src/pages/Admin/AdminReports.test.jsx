import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor } from '../../test/test-utils'
import { AdminReports } from './AdminReports'
import {
  getAdminDashboardStats, getPerformanceByGrade, getWeeklyTrend,
  getEnrollmentByGrade, getPerformanceDistribution, getTeachersBySubject,
} from '../../api/admin'

vi.mock('../../api/admin', () => ({
  getAdminDashboardStats: vi.fn(),
  getPerformanceByGrade: vi.fn(),
  getWeeklyTrend: vi.fn(),
  getEnrollmentByGrade: vi.fn(),
  getPerformanceDistribution: vi.fn(),
  getTeachersBySubject: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const STATS = { total_students: 540, new_students: 12, avg_performance: 82, avg_performance_change: 3, teaching_staff: 38, pending_approvals: 5 }

describe('AdminReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading placeholders in every chart card before data resolves', () => {
    getAdminDashboardStats.mockReturnValue(new Promise(() => {}))
    getPerformanceByGrade.mockReturnValue(new Promise(() => {}))
    getWeeklyTrend.mockReturnValue(new Promise(() => {}))
    getEnrollmentByGrade.mockReturnValue(new Promise(() => {}))
    getPerformanceDistribution.mockReturnValue(new Promise(() => {}))
    getTeachersBySubject.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<AdminReports />)

    // 4 stat-card trends + 5 chart cards all show "Loading…" while pending.
    expect(screen.getAllByText('Loading…').length).toBe(9)
  })

  it('renders stat cards once data resolves', async () => {
    getAdminDashboardStats.mockResolvedValue(STATS)
    getPerformanceByGrade.mockResolvedValue([{ grade: 4, avg_score: 80 }])
    getWeeklyTrend.mockResolvedValue([{ week: 'W1', attendance: 90, performance: 78 }])
    getEnrollmentByGrade.mockResolvedValue([{ grade: 4, student_count: 120 }])
    getPerformanceDistribution.mockResolvedValue([{ category: 'Good', percentage: 60, count: 300 }])
    getTeachersBySubject.mockResolvedValue([{ subject_name: 'Mathematics', teacher_count: 5 }])

    renderWithRouter(<AdminReports />)

    await waitFor(() => expect(screen.getByText('540')).toBeInTheDocument())
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
  })

  it('shows "No data available." for any chart whose endpoint returns an empty list', async () => {
    getAdminDashboardStats.mockResolvedValue(STATS)
    getPerformanceByGrade.mockResolvedValue([])
    getWeeklyTrend.mockResolvedValue([])
    getEnrollmentByGrade.mockResolvedValue([])
    getPerformanceDistribution.mockResolvedValue([])
    getTeachersBySubject.mockResolvedValue([])

    renderWithRouter(<AdminReports />)

    await waitFor(() => expect(screen.getAllByText('No data available.').length).toBe(5))
  })

  it('handles a paginated {results:[]} shape for chart data', async () => {
    getAdminDashboardStats.mockResolvedValue(STATS)
    getPerformanceByGrade.mockResolvedValue({ results: [{ grade: 5, avg_score: 75 }] })
    getWeeklyTrend.mockResolvedValue([])
    getEnrollmentByGrade.mockResolvedValue([])
    getPerformanceDistribution.mockResolvedValue([])
    getTeachersBySubject.mockResolvedValue([])

    renderWithRouter(<AdminReports />)

    await waitFor(() => expect(screen.getAllByText('No data available.').length).toBe(4))
  })
})
