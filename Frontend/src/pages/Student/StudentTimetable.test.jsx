import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor } from '../../test/test-utils'
import { StudentTimetable } from './StudentTimetable'
import { getStudentProfile } from '../../api/student'

vi.mock('../../api/student', () => ({
  getStudentProfile: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

describe('StudentTimetable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state before the profile resolves', () => {
    getStudentProfile.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<StudentTimetable />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders the timetable for the student\'s own class once loaded', async () => {
    getStudentProfile.mockResolvedValue({ grade: '4', section: 'A' })
    renderWithRouter(<StudentTimetable />)

    await waitFor(() => expect(screen.getAllByText('Class 4A — Weekly Schedule').length).toBeGreaterThan(0))
  })

  it('shows an error message when the profile has no class information', async () => {
    getStudentProfile.mockResolvedValue(null)
    renderWithRouter(<StudentTimetable />)
    await waitFor(() => expect(screen.getByText('Could not load class information.')).toBeInTheDocument())
  })

  it('still shows the missing-class message if the profile request fails', async () => {
    getStudentProfile.mockRejectedValue(new Error('network down'))
    renderWithRouter(<StudentTimetable />)
    await waitFor(() => expect(screen.getByText('Could not load class information.')).toBeInTheDocument())
  })
})
