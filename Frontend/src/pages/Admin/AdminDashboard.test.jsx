import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor } from '../../test/test-utils'
import { AdminDashboard } from './AdminDashboard'
import { getAdminDashboardStats, getAdminRecentActivity } from '../../api/admin'

vi.mock('../../api/admin', () => ({
  getAdminDashboardStats: vi.fn(),
  getAdminRecentActivity: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const STATS = {
  total_students: 540, new_students: 12, teaching_staff: 38,
  avg_performance: 82, avg_performance_change: 3, pending_approvals: 5,
  attendance_rate: 91,
}

const ACTIVITIES = [
  { type: 'result_approved', text: 'Term 1 results approved for S4A', time: '2h ago' },
  { type: 'teacher_added', text: 'New teacher onboarded', time: '1d ago' },
]

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading placeholder for stats and activity before data resolves', () => {
    getAdminDashboardStats.mockReturnValue(new Promise(() => {}))
    getAdminRecentActivity.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<AdminDashboard />)

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0)
  })

  it('renders stat cards and recent activity once loaded', async () => {
    getAdminDashboardStats.mockResolvedValue(STATS)
    getAdminRecentActivity.mockResolvedValue(ACTIVITIES)
    renderWithRouter(<AdminDashboard />)

    await waitFor(() => expect(screen.getByText('540')).toBeInTheDocument())
    expect(screen.getByText('Teaching Staff')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('Term 1 results approved for S4A')).toBeInTheDocument()
    expect(screen.getByText('New teacher onboarded')).toBeInTheDocument()
  })

  it('handles a paginated {results:[]} activity response shape', async () => {
    getAdminDashboardStats.mockResolvedValue(STATS)
    getAdminRecentActivity.mockResolvedValue({ results: ACTIVITIES })
    renderWithRouter(<AdminDashboard />)

    await waitFor(() => expect(screen.getByText('Term 1 results approved for S4A')).toBeInTheDocument())
  })

  it('shows the empty-state message when there is no recent activity', async () => {
    getAdminDashboardStats.mockResolvedValue(STATS)
    getAdminRecentActivity.mockResolvedValue([])
    renderWithRouter(<AdminDashboard />)

    await waitFor(() => expect(screen.getByText('No recent activity.')).toBeInTheDocument())
  })

  it('still renders stat cards as dashes if the stats fetch fails (stats request is individually caught)', async () => {
    getAdminDashboardStats.mockRejectedValue(new Error('network down'))
    getAdminRecentActivity.mockResolvedValue([])
    renderWithRouter(<AdminDashboard />)

    await waitFor(() => expect(screen.getByText('No recent activity.')).toBeInTheDocument())
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
