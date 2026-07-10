import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { TeacherClasses } from './TeacherClasses'
import {
  getTeacherMyClasses, getTeacherStudents, getTeacherResultList, bulkSaveResults,
} from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  getTeacherMyClasses: vi.fn(),
  getTeacherStudents: vi.fn(),
  getTeacherResultList: vi.fn(),
  bulkSaveResults: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close    = function () { this.removeAttribute('open') }
})

const CLASSES = [
  { class_id: 1, class_name: 'S1A', grade: '1', section: 'A', subject_name: 'Mathematics', subject_id: 10, student_count: 25, avg_score: 72 },
  { class_id: 2, class_name: 'S1A', grade: '1', section: 'A', subject_name: 'English', subject_id: 11, student_count: 25, avg_score: null },
]

describe('TeacherClasses', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the page heading', async () => {
    getTeacherMyClasses.mockResolvedValue([])
    renderWithRouter(<TeacherClasses />)
    await waitFor(() => expect(screen.getByRole('heading', { name: /My Classes/ })).toBeInTheDocument())
  })

  it('renders class cards with subject names after loading', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    renderWithRouter(<TeacherClasses />)
    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
    expect(screen.getByText('English')).toBeInTheDocument()
  })

  it('shows student counts on each class card', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    renderWithRouter(<TeacherClasses />)
    await waitFor(() => expect(screen.getAllByText('25').length).toBeGreaterThan(0))
  })

  it('opens the students panel when View Students is clicked', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    getTeacherStudents.mockResolvedValue([])
    renderWithRouter(<TeacherClasses />)
    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())

    fireEvent.click(screen.getAllByRole('button', { name: /View Students/ })[0])

    await waitFor(() => expect(screen.getByPlaceholderText(/Search by name or student code/)).toBeInTheDocument())
  })
})
