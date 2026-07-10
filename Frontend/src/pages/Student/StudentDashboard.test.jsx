import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, setSessionUser } from '../../test/test-utils'
import { StudentDashboard } from './StudentDashboard'
import { getStudentProfile, getStudentDashboard } from '../../api/student'

vi.mock('../../api/student', () => ({
  getStudentProfile: vi.fn(),
  getStudentDashboard: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const PROFILE = { grade: '4', section: 'A', student_code: 'STU001' }

const DASHBOARD = {
  stats: { attendance_percentage: 92, conduct_grade: 'A', pending_assignments: 3, recent_grade: 'B' },
  today_schedule: [{ start_time: '08:00', end_time: '09:00', subject: 'Mathematics', teacher: 'Mr. Habimana', room: 'Room 12' }],
  upcoming_assignments: [{ title: 'Essay', subject: 'English', due_date: '2026-07-01' }],
  recent_grades: [{ subject: 'Mathematics', grade: 'A', final_score: 88, term: 'Term 2' }],
}

describe('StudentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSessionUser({ first_name: 'Eric', last_name: 'N', role: 'student' })
  })

  it('shows loading placeholders before data resolves', () => {
    getStudentProfile.mockReturnValue(new Promise(() => {}))
    getStudentDashboard.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<StudentDashboard />)
    expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0)
  })

  it('renders stats, schedule, assignments and grades once loaded', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentDashboard.mockResolvedValue(DASHBOARD)
    renderWithRouter(<StudentDashboard />)

    await waitFor(() => expect(screen.getByText('92%')).toBeInTheDocument())
    expect(screen.getAllByText('Mathematics').length).toBeGreaterThan(0)
    expect(screen.getByText('Essay')).toBeInTheDocument()
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText(/Student ID: STU001/)).toBeInTheDocument()
  })

  it('shows empty-state messages when there is no schedule, assignments or grades', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentDashboard.mockResolvedValue({ stats: {}, today_schedule: [], upcoming_assignments: [], recent_grades: [] })
    renderWithRouter(<StudentDashboard />)

    await waitFor(() => expect(screen.getByText('No classes scheduled today.')).toBeInTheDocument())
    expect(screen.getByText('No upcoming assignments.')).toBeInTheDocument()
    expect(screen.getByText('No results yet.')).toBeInTheDocument()
  })

  it('still renders the dashboard shell if profile/dashboard requests fail', async () => {
    getStudentProfile.mockRejectedValue(new Error('network down'))
    getStudentDashboard.mockRejectedValue(new Error('network down'))
    renderWithRouter(<StudentDashboard />)

    await waitFor(() => expect(screen.getByText('No classes scheduled today.')).toBeInTheDocument())
  })
})
