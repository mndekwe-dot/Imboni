import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { ParentAttendance } from './ParentAttendance'
import { getMyChildren, getChildAttendanceStats, getChildAttendanceCalendar } from '../../api/parent'

vi.mock('../../api/parent', () => ({
  getMyChildren: vi.fn(),
  getChildAttendanceStats: vi.fn(),
  getChildAttendanceCalendar: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const CHILDREN = [
  { id: 1, student_name: 'Eric N.', grade: '4', section: 'A' },
  { id: 2, student_name: 'Alice M.', grade: '5', section: 'B' },
]

const STATS = { overall_rate: 95, attendance_label: 'Good', days_present: 90, days_absent: 5, excused_absences: 2, late_arrivals: 3, late_label: 'Improving' }

describe('ParentAttendance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state before children resolve', () => {
    getMyChildren.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<ParentAttendance />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the no-children message when none are linked', async () => {
    getMyChildren.mockResolvedValue([])
    renderWithRouter(<ParentAttendance />)
    await waitFor(() => expect(screen.getByText('No children linked.')).toBeInTheDocument())
  })

  it('renders the attendance stats and calendar for the active child', async () => {
    getMyChildren.mockResolvedValue([CHILDREN[0]])
    getChildAttendanceStats.mockResolvedValue(STATS)
    getChildAttendanceCalendar.mockResolvedValue([])

    renderWithRouter(<ParentAttendance />)

    await waitFor(() => expect(screen.getByText('95%')).toBeInTheDocument())
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText(/Eric N\.:/)).toBeInTheDocument()
  })

  it('switching the child tab re-fetches attendance scoped to that child only', async () => {
    getMyChildren.mockResolvedValue(CHILDREN)
    getChildAttendanceStats.mockImplementation(id => Promise.resolve(id === 1 ? STATS : { ...STATS, overall_rate: 70 }))
    getChildAttendanceCalendar.mockResolvedValue([])

    renderWithRouter(<ParentAttendance />)
    await waitFor(() => expect(screen.getByText('95%')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Alice M.'))

    await waitFor(() => expect(screen.getByText('70%')).toBeInTheDocument())
    expect(getChildAttendanceStats).toHaveBeenCalledWith(1)
    expect(getChildAttendanceStats).toHaveBeenCalledWith(2)
  })

  it('navigates to the previous and next month, re-fetching the calendar', async () => {
    getMyChildren.mockResolvedValue([CHILDREN[0]])
    getChildAttendanceStats.mockResolvedValue(STATS)
    getChildAttendanceCalendar.mockResolvedValue([])

    renderWithRouter(<ParentAttendance />)
    await waitFor(() => expect(screen.getByText('95%')).toBeInTheDocument())
    const initialCalls = getChildAttendanceCalendar.mock.calls.length

    fireEvent.click(screen.getByRole('button', { name: 'chevron_left' }))
    await waitFor(() => expect(getChildAttendanceCalendar.mock.calls.length).toBe(initialCalls + 1))

    fireEvent.click(screen.getByRole('button', { name: 'chevron_right' }))
    await waitFor(() => expect(getChildAttendanceCalendar.mock.calls.length).toBe(initialCalls + 2))
  })
})
