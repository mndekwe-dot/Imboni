import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { StudentAssignments } from './StudentAssignments'
import { getStudentProfile, getStudentAssignments, submitAssignment } from '../../api/student'
import { getStudentQuizzes } from '../../api/teacher'

vi.mock('../../api/student', () => ({
  getStudentProfile: vi.fn(),
  getStudentAssignments: vi.fn(),
  submitAssignment: vi.fn(),
}))

vi.mock('../../api/teacher', () => ({
  getStudentQuizzes: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const PROFILE = { grade: 'S4', section: 'A' }

const ASSIGNMENTS = [
  { id: 1, title: 'Essay', subject: 'English', teacher: 'Ms. Umutoni', due_date: '2026-01-01', status: 'pending' },
  { id: 2, title: 'Lab Report', subject: 'Chemistry', teacher: 'Mr. Bizimana', due_date: '2026-01-05', status: 'submitted', grade: 88, max_score: 100 },
]

describe('StudentAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStudentQuizzes.mockResolvedValue([])
  })

  it('shows a loading state before assignments resolve', () => {
    getStudentProfile.mockReturnValue(new Promise(() => {}))
    getStudentAssignments.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<StudentAssignments />)
    expect(screen.getByText('Loading assignments…')).toBeInTheDocument()
  })

  it('renders assignment cards and stat counts once loaded', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentAssignments.mockResolvedValue(ASSIGNMENTS)

    renderWithRouter(<StudentAssignments />)

    await waitFor(() => expect(screen.getByText('Essay')).toBeInTheDocument())
    expect(screen.getByText('Lab Report')).toBeInTheDocument()
    /* A mark over what it was out of. This asserted "88%", which happened to
       read correctly only because the fixture was out of 100 - the badge
       printed the raw score with a % sign, so 18 out of 20 showed as "18%". */
    expect(screen.getByText('88/100')).toBeInTheDocument()
  })

  it('shows the empty state for a filter with no matches', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentAssignments.mockResolvedValue(ASSIGNMENTS)
    renderWithRouter(<StudentAssignments />)
    await waitFor(() => expect(screen.getByText('Essay')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Overdue/ }))

    expect(screen.getByText('No overdue assignments')).toBeInTheDocument()
  })

  it('filters by status tab', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentAssignments.mockResolvedValue(ASSIGNMENTS)
    renderWithRouter(<StudentAssignments />)
    await waitFor(() => expect(screen.getByText('Essay')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Submitted/ }))

    expect(screen.queryByText('Essay')).not.toBeInTheDocument()
    expect(screen.getByText('Lab Report')).toBeInTheDocument()
  })

  it('hands in a pending assignment', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentAssignments.mockResolvedValueOnce(ASSIGNMENTS).mockResolvedValueOnce(
      [{ ...ASSIGNMENTS[0], status: 'submitted' }, ASSIGNMENTS[1]]
    )
    submitAssignment.mockResolvedValue({})

    renderWithRouter(<StudentAssignments />)
    await waitFor(() => expect(screen.getByText('Essay')).toBeInTheDocument())

    /* "Upload" used to send an empty body and open no picker at all. Handing
       in without a file is still allowed - an exercise book is handed in
       physically - so that is the button asserted here. */
    fireEvent.click(screen.getByRole('button', { name: /Mark as done/i }))

    await waitFor(() => expect(submitAssignment).toHaveBeenCalledWith(1, {}))
  })

  it('renders the online quizzes section when quizzes exist', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentAssignments.mockResolvedValue([])
    getStudentQuizzes.mockResolvedValue([
      { id: 5, title: 'Algebra Quiz', subject_name: 'Mathematics', question_count: 10, time_limit_minutes: 20, due_date: '2026-07-01', submitted: false },
    ])

    renderWithRouter(<StudentAssignments />)

    await waitFor(() => expect(screen.getByText('Algebra Quiz')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Take Quiz/ })).toBeInTheDocument()
  })
})
