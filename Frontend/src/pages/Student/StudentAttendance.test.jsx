import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addDays, format } from 'date-fns'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { StudentAttendance } from './StudentAttendance'
import { getStudentProfile, getStudentAttendanceStats, getStudentAttendanceCalendar } from '../../api/student'
import { getNow } from '../../components/timetable/dateUtils'
import { mondayOf } from '../../components/timetable/timetableNav'

vi.mock('../../api/student', () => ({
  getStudentProfile: vi.fn(),
  getStudentAttendanceStats: vi.fn(),
  getStudentAttendanceCalendar: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const PROFILE = { grade: 'S4', section: 'A' }
const STATS = { overall_rate: 95, days_present: 90, days_absent: 3, late_arrivals: 2, excused_absences: 1, attendance_label: 'Excellent' }

// Records in the week on screen when the page opens.
const monday = mondayOf(getNow())
const iso = n => format(addDays(monday, n), 'yyyy-MM-dd')

describe('StudentAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentAttendanceStats.mockResolvedValue(STATS)
  })

  it('shows dashes for stats before data resolves', () => {
    getStudentProfile.mockReturnValue(new Promise(() => {}))
    getStudentAttendanceStats.mockReturnValue(new Promise(() => {}))
    getStudentAttendanceCalendar.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<StudentAttendance />)
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
  })

  it('renders the term figures once loaded', async () => {
    getStudentAttendanceCalendar.mockResolvedValue({ records: [] })
    renderWithRouter(<StudentAttendance />)

    await waitFor(() => expect(screen.getByText('95%')).toBeInTheDocument())
    expect(screen.getByText('Excellent')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
  })

  it('lists the records for the week on screen, most recent first', async () => {
    getStudentAttendanceCalendar.mockResolvedValue({
      records: [
        { date: iso(0), status: 'present', time_in: '07:55:00' },
        { date: iso(1), status: 'absent', time_in: null },
      ],
    })
    renderWithRouter(<StudentAttendance />)

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Absent')
    expect(rows[1]).toHaveTextContent('07:55')
  })

  it('says so when the week has no records', async () => {
    getStudentAttendanceCalendar.mockResolvedValue({ records: [] })
    renderWithRouter(<StudentAttendance />)
    expect(await screen.findByText('No attendance recorded this week.')).toBeInTheDocument()
  })

  it('switches to the month and fetches another month when stepping back', async () => {
    getStudentAttendanceCalendar.mockResolvedValue({ records: [] })
    renderWithRouter(<StudentAttendance />)
    await screen.findByText('No attendance recorded this week.')

    fireEvent.click(screen.getByRole('button', { name: /change view/i }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /month/i }))
    expect(await screen.findByText('No attendance recorded this month.')).toBeInTheDocument()

    const before = getStudentAttendanceCalendar.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    await waitFor(() => expect(getStudentAttendanceCalendar.mock.calls.length).toBe(before + 1))
  })
})
