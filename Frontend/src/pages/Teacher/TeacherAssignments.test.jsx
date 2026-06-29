import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { TeacherAssignments } from './TeacherAssignments'
import {
  getTeacherMyClasses, getTeacherSubjects, getTeacherAssignments,
  createTeacherAssignment, updateTeacherAssignment, deleteTeacherAssignment,
  getAssignmentSubmissions, getQuestionBank, saveToQuestionBank, deleteFromQuestionBank,
} from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  getTeacherMyClasses: vi.fn(),
  getTeacherSubjects: vi.fn(),
  getTeacherAssignments: vi.fn(),
  createTeacherAssignment: vi.fn(),
  updateTeacherAssignment: vi.fn(),
  deleteTeacherAssignment: vi.fn(),
  getAssignmentSubmissions: vi.fn(),
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

  it('opens the New Assignment modal', async () => {
    getTeacherAssignments.mockResolvedValue([])
    renderWithRouter(<TeacherAssignments />)
    await waitFor(() => expect(screen.getByText('No assignments yet')).toBeInTheDocument())

    // Two "New Assignment" buttons: toolbar + EmptyState action; click the first
    fireEvent.click(screen.getAllByRole('button', { name: /New Assignment/ })[0])

    expect(screen.getByRole('heading', { name: /New Assignment/ })).toBeInTheDocument()
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
