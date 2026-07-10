import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { StudentAttendance } from './StudentAttendance'
import { getStudentProfile, getStudentAttendanceStats, getStudentAttendanceCalendar } from '../../api/student'

vi.mock('../../api/student', () => ({
  getStudentProfile: vi.fn(),
  getStudentAttendanceStats: vi.fn(),
  getStudentAttendanceCalendar: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const PROFILE = { grade: '4', section: 'A' }
const STATS = { overall_rate: 95, days_present: 90, days_absent: 3, late_arrivals: 2, excused_absences: 1, attendance_label: 'Excellent' }
const RECORDS = { records: [{ date: '2026-06-01', status: 'present', time_in: '07:55:00' }] }

describe('StudentAttendance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows dashes for stats before data resolves', () => {
    getStudentProfile.mockReturnValue(new Promise(() => {}))
    getStudentAttendanceStats.mockReturnValue(new Promise(() => {}))
    getStudentAttendanceCalendar.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<StudentAttendance />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders the overall rate, breakdown stats and calendar once loaded', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentAttendanceStats.mockResolvedValue(STATS)
    getStudentAttendanceCalendar.mockResolvedValue(RECORDS)

    renderWithRouter(<StudentAttendance />)

    await waitFor(() => expect(screen.getByText('95%')).toBeInTheDocument())
    expect(screen.getByText('Excellent')).toBeInTheDocument()
    expect(screen.getAllByText('90').length).toBeGreaterThan(0)
  })

  it('lists attendance records in the table, most recent first', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentAttendanceStats.mockResolvedValue(STATS)
    getStudentAttendanceCalendar.mockResolvedValue({
      records: [
        { date: '2026-06-01', status: 'present', time_in: '07:55:00' },
        { date: '2026-06-03', status: 'absent', time_in: null },
      ],
    })

    renderWithRouter(<StudentAttendance />)
    await waitFor(() => expect(screen.getByText('07:55')).toBeInTheDocument())

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('Jun 3, 2026')
    expect(rows[1]).toHaveTextContent('Jun 1, 2026')
  })

  it('shows the no-records message when the month has none', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentAttendanceStats.mockResolvedValue(STATS)
    getStudentAttendanceCalendar.mockResolvedValue({ records: [] })

    renderWithRouter(<StudentAttendance />)
    await waitFor(() => expect(screen.getByText('No records for this month.')).toBeInTheDocument())
  })

  it('navigating to the previous month re-fetches the calendar for that month', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentAttendanceStats.mockResolvedValue(STATS)
    getStudentAttendanceCalendar.mockResolvedValue(RECORDS)

    renderWithRouter(<StudentAttendance />)
    await waitFor(() => expect(screen.getByText('95%')).toBeInTheDocument())
    const callsBefore = getStudentAttendanceCalendar.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'chevron_left' }))

    await waitFor(() => expect(getStudentAttendanceCalendar.mock.calls.length).toBe(callsBefore + 1))
  })
})
