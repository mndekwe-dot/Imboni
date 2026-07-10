import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
import { DosAttendance } from './DosAttendance'
import {
  getDosClasses,
  getDosWeeklyAttendance,
  getDosTeacherWeeklyAttendance,
  markDosTeacherAttendance,
  getDosAttendanceStats,
  getSchoolSettings,
} from '../../api/dos'

vi.mock('../../api/dos', () => ({
  getDosClasses: vi.fn(),
  getDosWeeklyAttendance: vi.fn(),
  getDosTeacherWeeklyAttendance: vi.fn(),
  markDosTeacherAttendance: vi.fn(),
  getDosAttendanceStats: vi.fn(),
  getSchoolSettings: vi.fn(),
}))

const classesData = [
  { grade: 4, section: 'A' },
  { grade: 4, section: 'B' },
  { grade: 5, section: 'A' },
]

const statsData = {
  attendance_rate: 92,
  absent_today: 3,
  late_this_week: 5,
  teacher_rate: 95,
}

const weeklyAttendanceData = {
  class_name: 'All Classes',
  class_teacher: null,
  week_start: '2026-06-22',
  week_end: '2026-06-26',
  total_pages: 1,
  count: 2,
  students: [
    {
      student_id: 1,
      initials: 'AU',
      full_name: 'Amina Uwase',
      class_name: 'S4A',
      days: { mon: 'present', tue: 'present', wed: 'absent', thu: 'present', fri: 'late' },
      present_count: 3,
      rate: 60,
    },
    {
      student_id: 2,
      initials: 'JM',
      full_name: 'Jean Mugisha',
      class_name: 'S4B',
      days: { mon: 'present', tue: 'present', wed: 'present', thu: 'present', fri: 'present' },
      present_count: 5,
      rate: 100,
    },
  ],
}

const teacherWeeklyData = {
  week_start: '2026-06-22',
  week_end: '2026-06-26',
  total_pages: 1,
  count: 1,
  teachers: [
    {
      teacher_id: 7,
      initials: 'MR',
      full_name: 'Mr. Rurangwa',
      days: { mon: 'present', tue: 'present', wed: 'present', thu: 'present', fri: 'present' },
    },
  ],
}

describe('DosAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali', school_name: 'Test School' })
    getDosClasses.mockResolvedValue(classesData)
    getDosAttendanceStats.mockResolvedValue(statsData)
    getDosWeeklyAttendance.mockResolvedValue(weeklyAttendanceData)
    getDosTeacherWeeklyAttendance.mockResolvedValue(teacherWeeklyData)
  })

  it('shows loading state for the student attendance tab before data resolves', async () => {
    getDosWeeklyAttendance.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DosAttendance />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders stat cards and the student weekly attendance table once loaded', async () => {
    renderWithRouter(<DosAttendance />)

    await waitFor(() => expect(screen.getByText('Amina Uwase')).toBeInTheDocument())

    // Stat cards
    expect(screen.getAllByText('Student Attendance').length).toBeGreaterThan(0)
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('Absent Today')).toBeInTheDocument()
    expect(screen.getByText('Late Arrivals')).toBeInTheDocument()
    expect(screen.getAllByText('Teacher Attendance').length).toBeGreaterThan(0)
    expect(screen.getByText('95%')).toBeInTheDocument()

    // Student rows
    expect(screen.getByText('Jean Mugisha')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()

    expect(getDosWeeklyAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ grade: '', section: '', page: 1, page_size: 25 })
    )
  })

  it('shows an error message when the student attendance fetch fails', async () => {
    getDosWeeklyAttendance.mockRejectedValue(new Error('boom'))
    renderWithRouter(<DosAttendance />)
    await waitFor(() => expect(screen.getByText('Failed to load attendance data.')).toBeInTheDocument())
  })

  it('shows the empty state when there are no students for the selected class/week', async () => {
    getDosWeeklyAttendance.mockResolvedValue({ ...weeklyAttendanceData, students: [], count: 0 })
    renderWithRouter(<DosAttendance />)
    await waitFor(() =>
      expect(screen.getByText('No students enrolled for the selected class and term.')).toBeInTheDocument()
    )
  })

  it('switches to the teacher attendance tab and loads teacher data', async () => {
    renderWithRouter(<DosAttendance />)
    await waitFor(() => expect(screen.getByText('Amina Uwase')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Teacher Attendance/ }))

    await waitFor(() => expect(screen.getByText('Mr. Rurangwa')).toBeInTheDocument())
    expect(getDosTeacherWeeklyAttendance).toHaveBeenCalled()
  })

  it('saves edited teacher attendance with the correct payload', async () => {
    markDosTeacherAttendance.mockResolvedValue({})
    renderWithRouter(<DosAttendance />)
    await waitFor(() => expect(screen.getByText('Amina Uwase')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Teacher Attendance/ }))
    await waitFor(() => expect(screen.getByText('Mr. Rurangwa')).toBeInTheDocument())

    const selects = screen.getAllByRole('combobox')
    // change Monday's status for the teacher to 'absent'
    fireEvent.change(selects[0], { target: { value: 'absent' } })

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() =>
      expect(markDosTeacherAttendance).toHaveBeenCalledWith({
        date: '2026-06-22',
        records: [{ teacher_id: '7', status: 'absent' }],
      })
    )
    await waitFor(() => expect(screen.getByText('Attendance saved.')).toBeInTheDocument())
  })

  it('shows an error when saving teacher attendance fails', async () => {
    markDosTeacherAttendance.mockRejectedValue(new Error('save failed'))
    renderWithRouter(<DosAttendance />)
    await waitFor(() => expect(screen.getByText('Amina Uwase')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Teacher Attendance/ }))
    await waitFor(() => expect(screen.getByText('Mr. Rurangwa')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(screen.getByText('Failed to save attendance.')).toBeInTheDocument())
  })
})
