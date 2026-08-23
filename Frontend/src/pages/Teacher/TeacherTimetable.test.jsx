import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, within } from '../../test/test-utils'
import { TeacherTimetable } from './TeacherTimetable'
import { getTeacherTimetable } from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  getTeacherTimetable: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const SLOTS = [
  { day: 'monday',  start_time: '08:00:00', end_time: '09:00:00', subject_name: 'Mathematics', class_name: 'S4A', room_number: 'Room 12' },
  { day: 'tuesday', start_time: '08:00:00', end_time: '09:00:00', subject_name: 'English',     class_name: 'S4B', room_number: 'Room 5'  },
]

describe('TeacherTimetable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the My Timetable heading', () => {
    getTeacherTimetable.mockResolvedValue([])
    renderWithRouter(<TeacherTimetable />)
    expect(screen.getByRole('heading', { name: /My Timetable/ })).toBeInTheDocument()
  })

  it('shows the read-only notice naming who to ask for a change', () => {
    getTeacherTimetable.mockResolvedValue([])
    renderWithRouter(<TeacherTimetable />)
    expect(screen.getByText(/Read-only/)).toBeInTheDocument()
    expect(screen.getByText(/Director of Studies/)).toBeInTheDocument()
  })

  it('shows a loading state before the timetable resolves', () => {
    getTeacherTimetable.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<TeacherTimetable />)
    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    getTeacherTimetable.mockRejectedValue(new Error('network down'))
    renderWithRouter(<TeacherTimetable />)
    await waitFor(() =>
      expect(screen.getByText(/Could not load your timetable/)).toBeInTheDocument())
  })

  it('says so plainly when no lessons are scheduled', async () => {
    getTeacherTimetable.mockResolvedValue([])
    renderWithRouter(<TeacherTimetable />)
    await waitFor(() =>
      expect(screen.getByText(/No lessons scheduled/)).toBeInTheDocument())
  })

  it('renders the lessons the API returned', async () => {
    getTeacherTimetable.mockResolvedValue(SLOTS)
    renderWithRouter(<TeacherTimetable />)

    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
    // Scoped to the grid: "English" is also a language switcher option.
    const grid = within(document.querySelector('.tt-table'))
    expect(grid.getByText('English')).toBeInTheDocument()
  })

  it('handles a paginated {results:[]} response shape', async () => {
    getTeacherTimetable.mockResolvedValue({ results: SLOTS })
    renderWithRouter(<TeacherTimetable />)
    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
  })

  it('names the class in each cell, since the teacher is always the same person', async () => {
    getTeacherTimetable.mockResolvedValue(SLOTS)
    renderWithRouter(<TeacherTimetable />)

    await waitFor(() => expect(screen.getByText('S4A')).toBeInTheDocument())
    expect(screen.getByText('S4B')).toBeInTheDocument()
  })

  it('uses the same shared grid as every other portal', async () => {
    /* The point of the rewrite: the teacher's timetable is no longer a private
       component of its own. If this page ever grows a second grid again, the
       markers the shared one renders - period column, day tabs, week picker -
       are what will stop matching. */
    getTeacherTimetable.mockResolvedValue(SLOTS)
    renderWithRouter(<TeacherTimetable />)

    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
    expect(document.querySelector('.tt-table')).toBeInTheDocument()
    expect(document.querySelector('.day-tabs')).toBeInTheDocument()
    expect(screen.getByText('Period 1')).toBeInTheDocument()
  })
})
