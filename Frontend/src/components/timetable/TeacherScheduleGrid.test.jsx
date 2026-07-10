import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TeacherScheduleGrid } from './TeacherScheduleGrid'
import { getTeacherTimetable } from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  getTeacherTimetable: vi.fn(),
}))

// A Monday far in the past so getTodayDayIndex's isThisWeek() check is false,
// keeping the "today" column highlight out of the assertions (test-run-date independent).
const PAST_MONDAY = '2020-01-06'

const SLOTS = [
  { day: 'monday', start_time: '08:00:00', end_time: '09:00:00', subject_name: 'Mathematics', class_name: 'S4A', room_number: 'Room 12' },
  { day: 'tuesday', start_time: '08:00:00', end_time: '09:00:00', subject_name: 'English', class_name: 'S4B', room_number: 'Room 5' },
]

describe('TeacherScheduleGrid', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state before the timetable resolves', () => {
    getTeacherTimetable.mockReturnValue(new Promise(() => {}))
    render(<TeacherScheduleGrid currentMonday={PAST_MONDAY} />)
    expect(screen.getByText('Loading timetable…')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    getTeacherTimetable.mockRejectedValue(new Error('network down'))
    render(<TeacherScheduleGrid currentMonday={PAST_MONDAY} />)
    await waitFor(() => expect(screen.getByText('Failed to load timetable.')).toBeInTheDocument())
  })

  it('shows the empty state when there are no scheduled lessons', async () => {
    getTeacherTimetable.mockResolvedValue([])
    render(<TeacherScheduleGrid currentMonday={PAST_MONDAY} />)
    await waitFor(() => expect(screen.getByText('No lessons scheduled for this term yet.')).toBeInTheDocument())
  })

  it('builds one row per unique start time and renders each day column', async () => {
    getTeacherTimetable.mockResolvedValue(SLOTS)
    render(<TeacherScheduleGrid currentMonday={PAST_MONDAY} />)

    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('8:00 AM')).toBeInTheDocument()
    // Both lessons share the same start time, so there's exactly one time row (P1).
    expect(screen.getByText('P1')).toBeInTheDocument()
    expect(screen.queryByText('P2')).not.toBeInTheDocument()
  })

  it('handles a paginated {results:[]} response shape', async () => {
    getTeacherTimetable.mockResolvedValue({ results: SLOTS })
    render(<TeacherScheduleGrid currentMonday={PAST_MONDAY} />)
    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
  })

  it('switches the selected day tab', async () => {
    getTeacherTimetable.mockResolvedValue(SLOTS)
    render(<TeacherScheduleGrid currentMonday={PAST_MONDAY} />)
    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())

    const table = document.querySelector('.tt-table')
    expect(table).toHaveAttribute('data-day', '0')

    fireEvent.click(document.querySelector('.day-tabs').querySelectorAll('.day-tab')[1])
    expect(table).toHaveAttribute('data-day', '1')
  })
})
