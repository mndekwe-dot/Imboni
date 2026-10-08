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

  it('opens the register for the class it was sent from', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    getTeacherAttendanceStudents.mockResolvedValue([])
    getTeacherAttendanceStats.mockResolvedValue({})
    renderWithRouter(<TeacherAttendance />, { route: { pathname: '/teacher/attendance', state: { grade: 'S1', section: 'A' } } })

    await waitFor(() => expect(getTeacherAttendanceStudents).toHaveBeenCalledWith(expect.objectContaining({ class_id: 1 })))
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

  it('starts a student who is signed out on an exéat as excused, not absent or present', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    getTeacherAttendanceStats.mockResolvedValue({})
    getTeacherAttendanceStudents.mockResolvedValue([
      { student_id: 'a', student_code: 'ADM1', full_name: 'Amina Uwase', initials: 'AU', status: null, notes: '', on_exeat: true },
      { student_id: 'b', student_code: 'ADM2', full_name: 'Eric Habimana', initials: 'EH', status: null, notes: '', on_exeat: false },
    ])
    renderWithRouter(<TeacherAttendance />, { route: { pathname: '/teacher/attendance', state: { grade: 'S1', section: 'A' } } })

    expect(await screen.findByText('On exéat')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Signed out on an exéat pass')).toBeInTheDocument()
  })

  it('starts a student admitted to the sick bay as excused, with the reason in the note', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    getTeacherAttendanceStats.mockResolvedValue({})
    getTeacherAttendanceStudents.mockResolvedValue([
      { student_id: 'a', student_code: 'ADM1', full_name: 'Amina Uwase', initials: 'AU', status: null, notes: '', in_sick_bay: true },
    ])
    renderWithRouter(<TeacherAttendance />, { route: { pathname: '/teacher/attendance', state: { grade: 'S1', section: 'A' } } })

    expect(await screen.findByText('In sick bay')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Admitted to the sick bay')).toBeInTheDocument()
  })
})
