import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor } from '../../test/test-utils'
import { Routes, Route } from 'react-router'
import { StudentQuizReview } from './StudentQuizReview'
import { getQuizReview } from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  getQuizReview: vi.fn(),
}))

const REVIEW = {
  id: 'quiz1',
  title: 'Chapter 6 Quiz',
  subject_name: 'Mathematics',
  class_name: 'S1A',
  due_date: '2026-06-01',
  score: 2,
  max_score: 3,
  percentage: 66.7,
  is_late: false,
  submitted_at: '2026-06-01T10:00:00Z',
  questions: [
    {
      id: 'q1', type: 'mcq', text: '2+2?', options: ['3', '4'], correct: 1,
      explanation: 'Basic addition.', your_answer: 1, is_correct: true,
      points: 2, points_earned: 2,
    },
    {
      id: 'q2', type: 'true_false', text: 'Sky is green.', correct: 1,
      explanation: '', your_answer: 0, is_correct: false,
      points: 1, points_earned: 0,
    },
  ],
}

function renderReview() {
  return renderWithRouter(
    <Routes>
      <Route path="/student/quiz/:assignmentId/review" element={<StudentQuizReview />} />
    </Routes>,
    { route: '/student/quiz/quiz1/review' },
  )
}

describe('StudentQuizReview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state while the submission loads', () => {
    getQuizReview.mockReturnValue(new Promise(() => {}))
    renderReview()
    expect(screen.getByText('Loading your submission…')).toBeInTheDocument()
  })

  it('shows the score header and per-question breakdown', async () => {
    getQuizReview.mockResolvedValue(REVIEW)
    renderReview()

    await waitFor(() => expect(screen.getByText('Chapter 6 Quiz')).toBeInTheDocument())
    expect(screen.getByText('2/3')).toBeInTheDocument()
    expect(screen.getByText('66.7%')).toBeInTheDocument()
    expect(screen.getByText(/2\+2\?/)).toBeInTheDocument()
  })

  it('reveals the correct answer only for wrong questions, with explanations', async () => {
    getQuizReview.mockResolvedValue(REVIEW)
    renderReview()
    await waitFor(() => expect(screen.getByText('Chapter 6 Quiz')).toBeInTheDocument())

    // q2 was wrong → correct answer revealed ("False" since correct=1)
    expect(screen.getByText('False')).toBeInTheDocument()
    // q1 explanation shown
    expect(screen.getByText(/Basic addition\./)).toBeInTheDocument()
    // Only one "Correct answer:" row (for the single wrong question)
    expect(screen.getAllByText(/Correct answer:/).length).toBe(1)
  })

  it('shows an error with a way back when the quiz was not submitted', async () => {
    getQuizReview.mockRejectedValue({ response: { data: { detail: 'You have not submitted this quiz yet.' } } })
    renderReview()

    await waitFor(() => expect(screen.getByText('You have not submitted this quiz yet.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Back to Assignments/ })).toBeInTheDocument()
  })
})
