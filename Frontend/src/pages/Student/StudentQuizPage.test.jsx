import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Routes, Route } from 'react-router'
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AnnouncementsProvider } from '../../context/AnnouncementsContext'
import { StudentQuizPage } from './StudentQuizPage'
import { getQuizForStudent, submitQuizAnswers } from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
    getQuizForStudent: vi.fn(),
    submitQuizAnswers: vi.fn(),
}))

function renderQuizPage(assignmentId = '42') {
    return render(
        <MemoryRouter initialEntries={[`/student/quiz/${assignmentId}`]}>
            <AnnouncementsProvider>
                <Routes>
                    <Route path="/student/quiz/:assignmentId" element={<StudentQuizPage />} />
                </Routes>
            </AnnouncementsProvider>
        </MemoryRouter>
    )
}

const QUIZ = {
    id: 42,
    title: 'Algebra Quiz',
    subject_name: 'Mathematics',
    class_name: 'S4A',
    instructions: 'Answer all questions.',
    question_count: 2,
    time_limit_minutes: 1,
    questions: [
        { id: 1, type: 'mcq', text: 'What is 2+2?', points: 1, options: ['3', '4', '5'] },
        { id: 2, type: 'short_answer', text: 'Capital of Rwanda?', points: 1 },
    ],
}

beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
})

describe('StudentQuizPage', () => {
    it('shows a loading state while the quiz is being fetched', () => {
        getQuizForStudent.mockReturnValue(new Promise(() => {}))
        renderQuizPage()

        expect(screen.getByText('Loading quiz…')).toBeInTheDocument()
    })

    it('shows a not-found error when the quiz 404s', async () => {
        getQuizForStudent.mockRejectedValue({ response: { status: 404 } })
        renderQuizPage()

        await waitFor(() => expect(screen.getByText('Quiz not found or not yet published.')).toBeInTheDocument())
    })

    it('shows a generic error message on other load failures', async () => {
        getQuizForStudent.mockRejectedValue({ message: 'Network down' })
        renderQuizPage()

        await waitFor(() => expect(screen.getByText('Network down')).toBeInTheDocument())
    })

    it('renders quiz questions once loaded', async () => {
        getQuizForStudent.mockResolvedValue(QUIZ)
        renderQuizPage()

        await waitFor(() => expect(screen.getByText('Algebra Quiz')).toBeInTheDocument())
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument()
        expect(screen.getByText('Capital of Rwanda?')).toBeInTheDocument()
        expect(screen.getByText('0/2 answered')).toBeInTheDocument()
    })

    it('tracks answered count as the student answers questions', async () => {
        getQuizForStudent.mockResolvedValue(QUIZ)
        renderQuizPage()

        await waitFor(() => expect(screen.getByText('Algebra Quiz')).toBeInTheDocument())

        fireEvent.click(screen.getByLabelText('4'))
        expect(screen.getByText('1/2 answered')).toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText('Type your answer…'), { target: { value: 'Kigali' } })
        expect(screen.getByText('2/2 answered')).toBeInTheDocument()
    })

    it('submits answers with the correct payload when Submit Quiz is clicked', async () => {
        getQuizForStudent.mockResolvedValue(QUIZ)
        submitQuizAnswers.mockResolvedValue({
            score: 2, max_score: 2, percentage: 100, is_late: false,
            answers: [
                { question_id: '1', answer: 1, is_correct: true, correct_answer: 1 },
                { question_id: '2', answer: 'Kigali', is_correct: true, correct_answer: 'Kigali' },
            ],
        })
        renderQuizPage()

        await waitFor(() => expect(screen.getByText('Algebra Quiz')).toBeInTheDocument())

        fireEvent.click(screen.getByLabelText('4'))
        fireEvent.change(screen.getByPlaceholderText('Type your answer…'), { target: { value: 'Kigali' } })
        fireEvent.click(screen.getByRole('button', { name: /Submit Quiz/i }))

        await waitFor(() => expect(submitQuizAnswers).toHaveBeenCalled())
        const [calledId, payload] = submitQuizAnswers.mock.calls[0]
        expect(calledId).toBe('42')
        expect(payload.answers).toEqual(
            expect.arrayContaining([
                { question_id: '1', answer: 1 },
                { question_id: '2', answer: 'Kigali' },
            ])
        )
        expect(typeof payload.time_spent_seconds).toBe('number')

        await waitFor(() => expect(screen.getByText('100%')).toBeInTheDocument())
        expect(screen.getByText('2 / 2')).toBeInTheDocument()
    })

    it('shows a submit error message when submission fails', async () => {
        getQuizForStudent.mockResolvedValue(QUIZ)
        submitQuizAnswers.mockRejectedValue({ message: 'Failed to submit. Please try again.' })
        renderQuizPage()

        await waitFor(() => expect(screen.getByText('Algebra Quiz')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: /Submit Quiz/i }))

        await waitFor(() => expect(screen.getByText('Failed to submit. Please try again.')).toBeInTheDocument())
    })

    it('auto-submits when the timer expires', async () => {
        vi.useFakeTimers()
        getQuizForStudent.mockResolvedValue({ ...QUIZ, time_limit_minutes: 0.0167 }) // 1 second
        submitQuizAnswers.mockResolvedValue({
            score: 0, max_score: 2, percentage: 0, is_late: true, answers: [],
        })

        renderQuizPage()

        await vi.waitFor(() => expect(screen.getByText('Algebra Quiz')).toBeInTheDocument())

        // time_limit_minutes * 60 isn't a clean integer (0.0167 * 60 = 1.002s),
        // so the countdown needs two 1s ticks (1.002 -> 0.002 -> -0.998) before
        // it reads <= 0 and fires onExpire. Advance enough to cover both ticks.
        for (let i = 0; i < 5; i++) {
            await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
        }

        await vi.waitFor(() => expect(submitQuizAnswers).toHaveBeenCalled())
        const payload = submitQuizAnswers.mock.calls[0][1]
        expect(payload.answers).toEqual([])

        vi.useRealTimers()
    })
})
