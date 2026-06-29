import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { StudentResults } from './StudentResults'
import { getStudentProfile, getStudentResults, getStudentAssessments } from '../../api/student'

vi.mock('../../api/student', () => ({
  getStudentProfile: vi.fn(),
  getStudentResults: vi.fn(),
  getStudentAssessments: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const PROFILE = { grade: '4', section: 'A', student_id: 9 }

const TERMS = [
  { term_id: 1, term: 'Term 1', year: 2026, average_score: 80, subjects: [{ subject: 'Mathematics', grade: 'A', final_score: 85 }] },
  { term_id: 2, term: 'Term 2', year: 2026, average_score: 75, subjects: [{ subject: 'English', grade: 'B', final_score: 75 }] },
]

describe('StudentResults', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state before results resolve', () => {
    getStudentProfile.mockReturnValue(new Promise(() => {}))
    getStudentResults.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<StudentResults />)
    expect(screen.getByText('Loading results…')).toBeInTheDocument()
  })

  it('shows the empty state when there are no results yet', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentResults.mockResolvedValue([])
    getStudentAssessments.mockResolvedValue([])
    renderWithRouter(<StudentResults />)
    await waitFor(() => expect(screen.getByText('No results available yet.')).toBeInTheDocument())
  })

  it('renders the first term by default with its subjects and assessments', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentResults.mockResolvedValue(TERMS)
    getStudentAssessments.mockResolvedValue([{ subject_name: 'Mathematics', title: 'Mid-term', max_score: 100, score_obtained: 85, percentage: 85, grade: 'A', date: '2026-03-01' }])

    renderWithRouter(<StudentResults />)

    await waitFor(() => expect(getStudentAssessments).toHaveBeenCalledWith(9))
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getAllByText('Mathematics').length).toBeGreaterThan(0)
    expect(screen.getByText('Mid-term')).toBeInTheDocument()
  })

  it('switches term tabs and shows that term\'s subjects', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentResults.mockResolvedValue(TERMS)
    getStudentAssessments.mockResolvedValue([])

    renderWithRouter(<StudentResults />)
    await waitFor(() => expect(screen.getByText('80%')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Term 2'))

    expect(screen.getAllByText('75%').length).toBeGreaterThan(0)
    expect(screen.getByText('English')).toBeInTheDocument()
  })

  it('shows the no-assessments message when a term has none', async () => {
    getStudentProfile.mockResolvedValue(PROFILE)
    getStudentResults.mockResolvedValue(TERMS)
    getStudentAssessments.mockResolvedValue([])

    renderWithRouter(<StudentResults />)
    await waitFor(() => expect(screen.getByText('No individual assessments recorded.')).toBeInTheDocument())
  })
})
