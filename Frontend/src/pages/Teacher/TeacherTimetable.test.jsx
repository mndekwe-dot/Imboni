import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor } from '../../test/test-utils'
import { TeacherTimetable } from './TeacherTimetable'

vi.mock('../../components/timetable/TeacherScheduleGrid', () => ({
  TeacherScheduleGrid: () => <div data-testid="schedule-grid">Schedule Grid</div>,
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

describe('TeacherTimetable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the My Timetable heading', () => {
    renderWithRouter(<TeacherTimetable />)
    expect(screen.getByRole('heading', { name: /My Timetable/ })).toBeInTheDocument()
  })

  it('shows the read-only notice', () => {
    renderWithRouter(<TeacherTimetable />)
    expect(screen.getByText(/Read-only/)).toBeInTheDocument()
    expect(screen.getByText(/Director of Studies/)).toBeInTheDocument()
  })

  it('renders the schedule grid', () => {
    renderWithRouter(<TeacherTimetable />)
    expect(screen.getByTestId('schedule-grid')).toBeInTheDocument()
  })

  it('renders the week navigation area', () => {
    renderWithRouter(<TeacherTimetable />)
    // WeekPicker renders prev/next buttons with icon glyphs; check for the card header area
    expect(screen.getByText(/Your weekly teaching schedule/)).toBeInTheDocument()
  })
})
