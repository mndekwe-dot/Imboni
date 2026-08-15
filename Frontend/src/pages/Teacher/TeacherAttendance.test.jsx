import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
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

// The school's own structure, which the year/stream pickers are built from.
vi.mock('../../api/dos', () => ({
  getSchoolConfig: vi.fn().mockResolvedValue([
  { name: 'O-Level', years: [{ name: 'S1', streams: ['A', 'B'] }, { name: 'S2', streams: ['A'] }, { name: 'S3', streams: ['A'] }] },
  { name: 'A-Level', years: [{ name: 'S4', streams: ['A', 'B'] }, { name: 'S5', streams: ['A'] }, { name: 'S6', streams: ['A'] }] },
]),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const CLASSES = [
  { class_id: 1, class_name: 'S1A', grade: 'S1', section: 'A', subject_name: 'Math', subject_id: 10 },
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

  it('shows O-Level as a section option once classes with grade 1-3 load', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    renderWithRouter(<TeacherAttendance />)
    // ClassPicker renders a <select> with options, not buttons
    await waitFor(() => expect(screen.getByRole('option', { name: 'O-Level' })).toBeInTheDocument())
  })

  it('shows the offline confirmation when the register is queued instead of sent', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    getTeacherAttendanceStudents.mockResolvedValue([
      { student_id: 's1', full_name: 'Alice M', student_code: 'STU001', initials: 'AM', status: null, notes: '' },
    ])
    getTeacherAttendanceStats.mockResolvedValue({ weekly_rate: 92 })
    // client.js resolves {queued: true} when the POST was stored in the outbox
    markTeacherAttendance.mockResolvedValue({ queued: true, offline: true })

    renderWithRouter(<TeacherAttendance />)
    await waitFor(() => expect(screen.getByRole('option', { name: 'O-Level' })).toBeInTheDocument())

    // Drill down Section → Year → Class in the picker to load the roster
    const [sectionSel, yearSel, classSel] = screen.getAllByRole('combobox')
    fireEvent.change(sectionSel, { target: { value: 'O-Level' } })
    fireEvent.change(yearSel,    { target: { value: 'S1' } })
    fireEvent.change(classSel,   { target: { value: 'A' } })

    await waitFor(() => expect(screen.getByText('Alice M')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Save Attendance/ }))

    await waitFor(() =>
      expect(screen.getByText(/saved offline\. It will sync automatically/i)).toBeInTheDocument())
    expect(markTeacherAttendance).toHaveBeenCalledWith(expect.objectContaining({
      records: [expect.objectContaining({ student_id: 's1' })],
    }))
  })
})
