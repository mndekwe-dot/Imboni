import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { TeacherStudent } from './TeacherStudents'
import { getTeacherMyClasses, getTeacherStudents } from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  getTeacherMyClasses: vi.fn(),
  getTeacherStudents: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close    = function () { this.removeAttribute('open') }
})

const STUDENTS = [
  { student_id: 1, full_name: 'Alice Mukamana', student_code: 'STU001', class_name: 'S1A', initials: 'AM', attendance_rate: 92, performance_rate: 78 },
  { student_id: 2, full_name: 'Bob Nshimiyimana', student_code: 'STU002', class_name: 'S2B', initials: 'BN', attendance_rate: 85, performance_rate: 65 },
]

describe('TeacherStudent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the Students page heading', async () => {
    getTeacherMyClasses.mockResolvedValue([])
    getTeacherStudents.mockResolvedValue([])
    renderWithRouter(<TeacherStudent />)
    await waitFor(() => expect(screen.getByRole('heading', { name: /Students/ })).toBeInTheDocument())
  })

  it('renders student rows after loading', async () => {
    getTeacherMyClasses.mockResolvedValue([])
    getTeacherStudents.mockResolvedValue(STUDENTS)
    renderWithRouter(<TeacherStudent />)
    await waitFor(() => expect(screen.getByText('Alice Mukamana')).toBeInTheDocument())
    expect(screen.getByText('Bob Nshimiyimana')).toBeInTheDocument()
    expect(screen.getByText('STU001')).toBeInTheDocument()
  })

  it('filters students by name search', async () => {
    getTeacherMyClasses.mockResolvedValue([])
    getTeacherStudents.mockResolvedValue(STUDENTS)
    renderWithRouter(<TeacherStudent />)
    await waitFor(() => expect(screen.getByText('Alice Mukamana')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText(/Search by name or student code/), { target: { value: 'Bob' } })

    expect(screen.queryByText('Alice Mukamana')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Nshimiyimana')).toBeInTheDocument()
  })

  it('opens the student profile modal when View is clicked', async () => {
    getTeacherMyClasses.mockResolvedValue([])
    getTeacherStudents.mockResolvedValue(STUDENTS)
    renderWithRouter(<TeacherStudent />)
    await waitFor(() => expect(screen.getByText('Alice Mukamana')).toBeInTheDocument())

    fireEvent.click(screen.getAllByRole('button', { name: /View/ })[0])

    expect(screen.getByRole('heading', { name: /Student Profile/ })).toBeInTheDocument()
    expect(screen.getByText('Alice Mukamana', { selector: '.student-profile-name' })).toBeInTheDocument()
  })
})
