import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor } from '../../test/test-utils'
import { TeacherAttendance } from './TeacherAttendance'
import {
  getTeacherMyClasses, getTeacherAttendanceStats,
  getTeacherAttendanceStudents, markTeacherAttendance,
} from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  getTeacherMyClasses: vi.fn(),
  getTeacherAttendanceStats: vi.fn(),
  getTeacherAttendanceStudents: vi.fn(),
  markTeacherAttendance: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const CLASSES = [
  { class_id: 1, class_name: 'S1A', grade: '1', section: 'A', subject_name: 'Math', subject_id: 10 },
]

describe('TeacherAttendance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state while classes are fetched', () => {
    getTeacherMyClasses.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<TeacherAttendance />)
    expect(screen.getByText('Loading classes…')).toBeInTheDocument()
  })

  it('renders the Mark All Present button after classes load', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    renderWithRouter(<TeacherAttendance />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark All Present/ })).toBeInTheDocument())
  })

  it('renders the Mark Attendance page heading', async () => {
    getTeacherMyClasses.mockResolvedValue([])
    renderWithRouter(<TeacherAttendance />)
    await waitFor(() => expect(screen.getByRole('heading', { name: /Mark Attendance/ })).toBeInTheDocument())
  })

  it('shows O-Level as a section option once classes with grade 1–3 load', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    renderWithRouter(<TeacherAttendance />)
    // ClassPicker renders a <select> with options, not buttons
    await waitFor(() => expect(screen.getByRole('option', { name: 'O-Level' })).toBeInTheDocument())
  })
})
