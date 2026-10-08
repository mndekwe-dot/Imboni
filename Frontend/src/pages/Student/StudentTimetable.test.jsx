import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor } from '../../test/test-utils'
import { StudentTimetable } from './StudentTimetable'
import { getStudentTimetable } from '../../api/student'

vi.mock('../../api/student', () => ({
  getStudentTimetable: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const WEEK = {
  class: 'S4A',
  slots: [
    { day: 'monday', start_time: '08:00:00', end_time: '08:40:00', subject_name: 'Mathematics', teacher_name: 'Pacifique Rurangwa', room_number: '12', class_name: 'S4A' },
  ],
}

describe('StudentTimetable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state before the timetable resolves', () => {
    getStudentTimetable.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<StudentTimetable />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders the lessons the school scheduled for the class', async () => {
    getStudentTimetable.mockResolvedValue(WEEK)
    renderWithRouter(<StudentTimetable />)

    await waitFor(() => expect(screen.getAllByText('Mathematics').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Class S4A Weekly Schedule').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pacifique Rurangwa').length).toBeGreaterThan(0)
  })

  it('says so when the class has no lessons yet', async () => {
    getStudentTimetable.mockResolvedValue({ timetable: {}, slots: [] })
    renderWithRouter(<StudentTimetable />)
    await waitFor(() => expect(screen.getByText('No lessons scheduled for this term yet.')).toBeInTheDocument())
  })

  it('shows an error message if the request fails', async () => {
    getStudentTimetable.mockRejectedValue(new Error('network down'))
    renderWithRouter(<StudentTimetable />)
    await waitFor(() => expect(screen.getByText('Could not load class information.')).toBeInTheDocument())
  })
})
