import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, setSessionUser } from '../../test/test-utils'
import { DosAnalytics } from './DosAnalytics'
import { getDosAnalytics } from '../../api/dos'

vi.mock('../../api/dos', () => ({
  getDosAnalytics: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const ANALYTICS = {
  stats: { overall_avg: 78, attendance_rate: 92, ratio: '1:18', top_performers: 24 },
  grade_performance: [
    { grade: 'S1', score: 70 },
    { grade: 'S2', score: 82 },
  ],
  subject_averages: [
    { subject: 'Mathematics', avg_score: 65 },
    { subject: 'English', avg_score: 80 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ first_name: 'Dr', last_name: 'Ndagijimana', role: 'dos' })
})

describe('DosAnalytics', () => {
  it('shows a loading state before analytics resolve', () => {
    getDosAnalytics.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DosAnalytics />)
    expect(screen.getByText('Loading analytics…')).toBeInTheDocument()
  })

  it('shows an error state when the fetch fails', async () => {
    getDosAnalytics.mockRejectedValue(new Error('Network down'))
    renderWithRouter(<DosAnalytics />)
    await waitFor(() => expect(screen.getByText('Error: Network down')).toBeInTheDocument())
  })

  it('renders the four stat cards once data resolves', async () => {
    getDosAnalytics.mockResolvedValue(ANALYTICS)
    renderWithRouter(<DosAnalytics />)

    await waitFor(() => expect(screen.getByText('Overall Performance')).toBeInTheDocument())
    expect(screen.getByText('78%')).toBeInTheDocument()
    expect(screen.getByText('Attendance Rate')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('Teacher-Student Ratio')).toBeInTheDocument()
    expect(screen.getByText('1:18')).toBeInTheDocument()
    expect(screen.getByText('Top Performers')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('renders grade performance and subject performance rows', async () => {
    getDosAnalytics.mockResolvedValue(ANALYTICS)
    renderWithRouter(<DosAnalytics />)

    await waitFor(() => expect(screen.getByText('Performance by Grade')).toBeInTheDocument())
    expect(screen.getByText('S1')).toBeInTheDocument()
    expect(screen.getByText('S2')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()

    expect(screen.getByText('Subject Performance')).toBeInTheDocument()
    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('shows "No approved results yet." for both cards when their arrays are empty', async () => {
    getDosAnalytics.mockResolvedValue({
      stats: { overall_avg: 0, attendance_rate: 0, ratio: '0:0', top_performers: 0 },
      grade_performance: [],
      subject_averages: [],
    })
    renderWithRouter(<DosAnalytics />)

    await waitFor(() => expect(screen.getAllByText('No approved results yet.').length).toBe(2))
  })
})
