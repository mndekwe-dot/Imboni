import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { TeacherAssignments } from './TeacherAssignments'

const navigate = vi.fn()
vi.mock('react-router', async () => ({
  ...await vi.importActual('react-router'),
  useNavigate: () => navigate,
}))
import {
  getTeacherMyClasses, getTeacherSubjects, getTeacherAssignments,
  createTeacherAssignment, updateTeacherAssignment, deleteTeacherAssignment,
  getAssignmentSubmissions, getAssignmentGradeSheet, saveAssignmentGrades,
  getQuestionBank, saveToQuestionBank, deleteFromQuestionBank,
} from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  getTeacherMyClasses: vi.fn(),
  getTeacherSubjects: vi.fn(),
  getTeacherAssignments: vi.fn(),
  createTeacherAssignment: vi.fn(),
  updateTeacherAssignment: vi.fn(),
  deleteTeacherAssignment: vi.fn(),
  getAssignmentSubmissions: vi.fn(),
  getAssignmentGradeSheet: vi.fn(),
  saveAssignmentGrades: vi.fn(),
  getQuestionBank: vi.fn(),
  saveToQuestionBank: vi.fn(),
  deleteFromQuestionBank: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close    = function () { this.removeAttribute('open') }
})

const ASSIGNMENTS = [
  {
    id: 1, title: 'Chapter 6 Quiz', class_name: 'S1A', class_id: 1,
    subject_name: 'Mathematics', subject_id: 10, due_date: '2026-07-01',
    max_score: 30, status: 'active', mode: 'paper', submitted: 20, total: 25, questions: [],
  },
  {
    id: 2, title: 'Essay Draft', class_name: 'S2B', class_id: 2,
    subject_name: 'English', subject_id: 11, due_date: '2026-07-05',
    max_score: 20, status: 'draft', mode: 'paper', questions: [],
  },
]

describe('TeacherAssignments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTeacherMyClasses.mockResolvedValue([])
    getTeacherSubjects.mockResolvedValue([])
  })

  it('shows a loading state while data is in flight', () => {
    getTeacherAssignments.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<TeacherAssignments />)
    expect(screen.getByText('Loading assignments…')).toBeInTheDocument()
  })

  it('shows the empty state when there are no assignments', async () => {
    getTeacherAssignments.mockResolvedValue([])
    renderWithRouter(<TeacherAssignments />)
    await waitFor(() => expect(screen.getByText('No assignments yet')).toBeInTheDocument())
  })

  it('renders assignment cards with titles and metadata', async () => {
    getTeacherAssignments.mockResolvedValue(ASSIGNMENTS)
    renderWithRouter(<TeacherAssignments />)
    await waitFor(() => expect(screen.getByText('Chapter 6 Quiz')).toBeInTheDocument())
    expect(screen.getByText('Essay Draft')).toBeInTheDocument()
    expect(screen.getByText('Mathematics · S1A')).toBeInTheDocument()
  })

  it('sends New Assignment to its own page rather than a dialog', async () => {
    /* Building a quiz needs the whole viewport, so the form is a route now.
       Both entry points - the toolbar button and the empty state's action -
       have to reach it. */
    getTeacherAssignments.mockResolvedValue([])
    renderWithRouter(<TeacherAssignments />)
    await waitFor(() => expect(screen.getByText('No assignments yet')).toBeInTheDocument())

    for (const button of screen.getAllByRole('button', { name: /New Assignment/ })) {
      navigate.mockClear()
      fireEvent.click(button)
      expect(navigate).toHaveBeenCalledWith('/teacher/assignments/new')
    }
  })

  it('sends Edit to the page for that assignment', async () => {
    getTeacherAssignments.mockResolvedValue(ASSIGNMENTS)
    renderWithRouter(<TeacherAssignments />)
    await waitFor(() => expect(screen.getByText('Chapter 6 Quiz')).toBeInTheDocument())

    // By title, not by name: the grading button's edit_note icon ligature
    // renders as text and also matches /edit/i.
    fireEvent.click(screen.getAllByTitle('Edit')[0])

    expect(navigate).toHaveBeenCalledWith('/teacher/assignments/1/edit')
  })

  it('opens the grading queue for an active paper assignment and saves scores', async () => {
    getTeacherAssignments.mockResolvedValue(ASSIGNMENTS)
    getAssignmentGradeSheet.mockResolvedValue({
      assignment_id: '1', title: 'Chapter 6 Quiz', max_score: 30, class_name: 'S1A',
      students: [
        { student_id: 's1', full_name: 'Alice M', student_code: 'STU001', score: null },
        { student_id: 's2', full_name: 'Bob K', student_code: 'STU002', score: 20 },
      ],
    })
    saveAssignmentGrades.mockResolvedValue({ saved: 2, errors: [] })
    renderWithRouter(<TeacherAssignments />)
    await waitFor(() => expect(screen.getByText('Chapter 6 Quiz')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Grade/ }))
    await waitFor(() => expect(screen.getByText('Alice M')).toBeInTheDocument())

    // Bob's existing score is pre-filled
    expect(screen.getByLabelText('Score for Bob K')).toHaveValue(20)

    fireEvent.change(screen.getByLabelText('Score for Alice M'), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Scores/ }))

    // Each record now carries the teacher's comment alongside the mark; the
    // student and parent portals read it as feedback.
    await waitFor(() => expect(saveAssignmentGrades).toHaveBeenCalledWith(1, [
      { student_id: 's2', score: '20', feedback: '' },
      { student_id: 's1', score: '25', feedback: '' },
    ]))
    await waitFor(() => expect(screen.getByText('Saved 2 scores.')).toBeInTheDocument())
  })

  it('sends the feedback typed beside a mark', async () => {
    /* The student portal used to show them their own submission note under a
       "feedback" heading, because there was no teacher comment field at all. */
    getTeacherAssignments.mockResolvedValue(ASSIGNMENTS)
    getAssignmentGradeSheet.mockResolvedValue({
      assignment_id: '1', title: 'Chapter 6 Quiz', max_score: 30, class_name: 'S1A',
      students: [{ student_id: 's1', full_name: 'Alice M', student_code: 'STU001', score: null }],
    })
    saveAssignmentGrades.mockResolvedValue({ saved: 1, errors: [] })
    renderWithRouter(<TeacherAssignments />)
    await waitFor(() => expect(screen.getByText('Chapter 6 Quiz')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Grade/ }))
    await waitFor(() => expect(screen.getByText('Alice M')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Score for Alice M'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('Feedback for Alice M'),
      { target: { value: 'Good working throughout.' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Scores/ }))

    await waitFor(() => expect(saveAssignmentGrades).toHaveBeenCalledWith(1, [
      { student_id: 's1', score: '25', feedback: 'Good working throughout.' },
    ]))
  })

  it('filters to only draft assignments when the Draft tab is clicked', async () => {
    getTeacherAssignments.mockResolvedValue(ASSIGNMENTS)
    renderWithRouter(<TeacherAssignments />)
    await waitFor(() => expect(screen.getByText('Chapter 6 Quiz')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^Draft/ }))

    await waitFor(() => expect(screen.queryByText('Chapter 6 Quiz')).not.toBeInTheDocument())
    expect(screen.getByText('Essay Draft')).toBeInTheDocument()
  })
})
