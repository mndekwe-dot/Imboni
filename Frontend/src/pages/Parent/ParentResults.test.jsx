import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { ParentResults } from './ParentResults'
import { getMyChildren, getChildAssessments, getChildSummative, getChildReviews } from '../../api/parent'

vi.mock('../../api/parent', () => ({
  getMyChildren: vi.fn(),
  getChildAssessments: vi.fn(),
  getChildSummative: vi.fn(),
  getChildReviews: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const CHILDREN = [
  { id: 1, student_name: 'Eric N.', grade: '4', section: 'A' },
  { id: 2, student_name: 'Alice M.', grade: '5', section: 'B' },
]

describe('ParentResults', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state before children resolve', () => {
    getMyChildren.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<ParentResults />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the no-children message when the parent has none linked', async () => {
    getMyChildren.mockResolvedValue([])
    renderWithRouter(<ParentResults />)
    await waitFor(() => expect(screen.getByText('No children linked.')).toBeInTheDocument())
  })

  it('renders assessments, summative results and reviews for the active child', async () => {
    getMyChildren.mockResolvedValue([CHILDREN[0]])
    getChildAssessments.mockResolvedValue([{ id: 1, title: 'Algebra Quiz', assessment_type: 'quiz', score_display: '18/20', grade: 'A', subject_name: 'Mathematics' }])
    getChildSummative.mockResolvedValue([{ id: 1, subject_name: 'Mathematics', class_test_marks: 18, exam_score: 70, final_score: 85, grade: 'A' }])
    getChildReviews.mockResolvedValue([{ id: 1, teacher_name: 'Mr. Habimana', teacher_role: 'Mathematics Teacher', teacher_comment: 'Great improvement.' }])

    renderWithRouter(<ParentResults />)

    await waitFor(() => expect(screen.getAllByText('Mathematics').length).toBeGreaterThan(0))
    expect(screen.getByText('Recent Results for Eric N.')).toBeInTheDocument()
    expect(screen.getByText('Summative Performance')).toBeInTheDocument()
    expect(screen.getByText('Mr. Habimana')).toBeInTheDocument()
    expect(screen.getByText('"Great improvement."')).toBeInTheDocument()
  })

  it('shows empty-state messages when a child has no assessments or reviews', async () => {
    getMyChildren.mockResolvedValue([CHILDREN[0]])
    getChildAssessments.mockResolvedValue([])
    getChildSummative.mockResolvedValue([])
    getChildReviews.mockResolvedValue([])

    renderWithRouter(<ParentResults />)

    await waitFor(() => expect(screen.getByText('No assessments recorded yet.')).toBeInTheDocument())
    expect(screen.getByText('No assessments yet.')).toBeInTheDocument()
    expect(screen.getByText('No reviews yet.')).toBeInTheDocument()
    expect(screen.queryByText('Summative Performance')).not.toBeInTheDocument()
  })

  it('switching the child tab re-fetches data scoped to that child only', async () => {
    getMyChildren.mockResolvedValue(CHILDREN)
    getChildAssessments.mockImplementation(id =>
      Promise.resolve(id === 1 ? [{ id: 1, title: 'Eric Quiz', score_display: '10/10', grade: 'A', subject_name: 'Math' }]
        : [{ id: 2, title: 'Alice Quiz', score_display: '9/10', grade: 'A', subject_name: 'English' }])
    )
    getChildSummative.mockResolvedValue([])
    getChildReviews.mockResolvedValue([])

    renderWithRouter(<ParentResults />)
    await waitFor(() => expect(screen.getByText('Eric Quiz')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Alice M.'))

    await waitFor(() => expect(screen.getByText('Alice Quiz')).toBeInTheDocument())
    expect(screen.queryByText('Eric Quiz')).not.toBeInTheDocument()
    expect(getChildAssessments).toHaveBeenCalledWith(1)
    expect(getChildAssessments).toHaveBeenCalledWith(2)
  })
})
