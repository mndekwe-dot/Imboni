import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { AdminStudents } from './AdminStudents'
import {
  getAdminStudents, getAdminStudentStats,
  getStudentDetail, getStudentAttendanceStats, getStudentTermResults,
} from '../../api/admin'
import { getSchoolConfig } from '../../api/dos'

vi.mock('../../api/admin', () => ({
  getAdminStudents: vi.fn(),
  getAdminStudentStats: vi.fn(),
  getStudentDetail: vi.fn(),
  getStudentAttendanceStats: vi.fn(),
  getStudentTermResults: vi.fn(),
}))

vi.mock('../../api/dos', () => ({
  getSchoolConfig: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const STUDENTS = [
  { id: 1, name: 'Eric Niyonsenga', student_id: 'STU001', grade: 'S4', section: 'A', dormitory: 'Bisoke', status: 'active' },
  { id: 2, name: 'Alice Mutesi', student_id: 'STU002', grade: 'S4', section: 'B', dormitory: 'Karisimbi', status: 'active' },
]

const STATS = { total_students: 540, new_admissions: 12, active_students: 530, enrollment_pct: 98, avg_performance: 80, avg_performance_change: 2 }

describe('AdminStudents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSchoolConfig.mockResolvedValue([])
  })

  it('shows a loading state before students resolve', () => {
    getAdminStudents.mockReturnValue(new Promise(() => {}))
    getAdminStudentStats.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<AdminStudents />)
    expect(screen.getByText('Loading students…')).toBeInTheDocument()
  })

  it('renders the student table and stat cards once loaded', async () => {
    getAdminStudents.mockResolvedValue(STUDENTS)
    getAdminStudentStats.mockResolvedValue(STATS)
    renderWithRouter(<AdminStudents />)

    await waitFor(() => expect(screen.getByText('Eric Niyonsenga')).toBeInTheDocument())
    expect(screen.getByText('Alice Mutesi')).toBeInTheDocument()
    expect(screen.getByText('540')).toBeInTheDocument()
  })

  /* The fixture above is hand-written, and it is not what the API sends. The
     real list (DOSStudentSerializer) has `full_name`, `initials` and
     `student_code`, and `student_id` is the database UUID. This page read
     `name` / `first_name` instead, so every row had no name, a blank avatar and
     the UUID where the student's code belongs. These use the real shape. */
  describe('with the real students API response shape', () => {
    const UUID = '0d2b620a-c344-4f17-9a3a-f99343132583'
    const REAL = [{
      student_id: UUID, student_code: 'STU-001', full_name: 'Amina Uwase', initials: 'AU',
      grade: '1', grade_label: 'S1', section: 'A', status: 'active',
      avg_performance: 74.2, attendance_rate: 96, enrollment_date: '2026-01-12',
    }]

    beforeEach(() => {
      getAdminStudents.mockResolvedValue(REAL)
      getAdminStudentStats.mockResolvedValue(STATS)
    })

    it('shows the name and code, and never the UUID', async () => {
      renderWithRouter(<AdminStudents />)

      expect(await screen.findByText('Amina Uwase')).toBeInTheDocument()
      expect(screen.getByText('STU-001')).toBeInTheDocument()
      expect(screen.queryByText(UUID)).toBeNull()
    })

    it('gives the avatar the initials', async () => {
      renderWithRouter(<AdminStudents />)
      await screen.findByText('Amina Uwase')
      expect(document.querySelector('tbody .adm-av')).toHaveTextContent('AU')
    })

    it('asks the server to search, by name or by code, once typing pauses', async () => {
      // A stand-in for the real endpoint: it does the searching the page used to do.
      getAdminStudents.mockImplementation(async ({ search } = {}) => {
        const q = (search || '').toLowerCase()
        const rows = REAL.filter(r => !q || r.full_name.toLowerCase().includes(q)
          || r.student_code.toLowerCase().includes(q))
        return { count: rows.length, results: rows }
      })
      renderWithRouter(<AdminStudents />)
      await screen.findByText('Amina Uwase')
      const box = screen.getByPlaceholderText('Search students…')

      fireEvent.change(box, { target: { value: 'stu-001' } })
      await waitFor(() => expect(getAdminStudents).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'stu-001', page: 1 })))
      expect(screen.getByText('Amina Uwase')).toBeInTheDocument()

      fireEvent.change(box, { target: { value: 'nobody' } })
      await waitFor(() => expect(screen.queryByText('Amina Uwase')).toBeNull())
    })

    it('does not ask the server on every keystroke', async () => {
      renderWithRouter(<AdminStudents />)
      await screen.findByText('Amina Uwase')
      const calls = () => getAdminStudents.mock.calls.length
      const before = calls()
      const box = screen.getByPlaceholderText('Search students…')

      for (const v of ['a', 'am', 'ami', 'amin']) fireEvent.change(box, { target: { value: v } })

      expect(calls()).toBe(before)               // nothing sent while typing
      await waitFor(() => expect(getAdminStudents).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'amin' })))
      expect(calls()).toBe(before + 1)           // one request for the whole burst
    })

    it('asks for one page at a time, not the whole school', async () => {
      renderWithRouter(<AdminStudents />)
      await screen.findByText('Amina Uwase')
      expect(getAdminStudents).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 8 }))
    })

    it('shows the server\'s total and asks for the next page when you page forward', async () => {
      const many = Array.from({ length: 8 }, (_, i) => ({ ...REAL[0], student_id: `u${i}`, student_code: `STU-${i}`, full_name: `Pupil ${i}` }))
      getAdminStudents.mockResolvedValue({ count: 19, results: many })
      renderWithRouter(<AdminStudents />)
      await screen.findByText('Pupil 0')
      expect(screen.getByText('1-8 of 19')).toBeInTheDocument()

      fireEvent.click(screen.getByLabelText('Next'))
      await waitFor(() => expect(getAdminStudents).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
    })

    it('goes back to page 1 when the search changes', async () => {
      const many = Array.from({ length: 8 }, (_, i) => ({ ...REAL[0], student_id: `u${i}`, student_code: `STU-${i}`, full_name: `Pupil ${i}` }))
      getAdminStudents.mockResolvedValue({ count: 19, results: many })
      renderWithRouter(<AdminStudents />)
      await screen.findByText('Pupil 0')
      fireEvent.click(screen.getByLabelText('Next'))
      await waitFor(() => expect(getAdminStudents).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))

      fireEvent.change(screen.getByPlaceholderText('Search students…'), { target: { value: 'pupil' } })
      await waitFor(() => expect(getAdminStudents).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, search: 'pupil' })))
    })

    it('shows skeleton rows under the real headers while a page loads', async () => {
      getAdminStudents.mockReturnValue(new Promise(() => {}))
      renderWithRouter(<AdminStudents />)
      expect(await screen.findByRole('columnheader', { name: 'Class' })).toBeInTheDocument()
      expect(document.querySelectorAll('tbody tr.skel-tr').length).toBe(8)
      expect(screen.getByText('Loading students…')).toBeInTheDocument()
    })

    it('shows bars in the stat tiles, not the word Loading, while the figures arrive', async () => {
      getAdminStudentStats.mockReturnValue(new Promise(() => {}))
      renderWithRouter(<AdminStudents />)
      await screen.findByText('Amina Uwase')
      const tiles = document.querySelectorAll('.portal-stat-card')
      expect(tiles).toHaveLength(4)
      tiles.forEach(t => {
        expect(t).toHaveClass('is-loading')
        expect(t.querySelector('.skel-stat-value')).toBeInTheDocument()
      })
    })

    it('still shows the four tiles, with dashes, if the figures never come', async () => {
      getAdminStudentStats.mockRejectedValue(new Error('down'))
      renderWithRouter(<AdminStudents />)
      await screen.findByText('Amina Uwase')
      await waitFor(() => expect(document.querySelectorAll('.portal-stat-card')).toHaveLength(4))
      expect(document.querySelectorAll('.portal-stat-card.is-loading')).toHaveLength(0)
    })
  })

  it('shows what the server returns for a search', async () => {
    getAdminStudents.mockImplementation(async ({ search } = {}) => {
      const rows = search ? STUDENTS.filter(s => s.name.includes(search)) : STUDENTS
      return { count: rows.length, results: rows }
    })
    getAdminStudentStats.mockResolvedValue(STATS)
    renderWithRouter(<AdminStudents />)
    await waitFor(() => expect(screen.getByText('Eric Niyonsenga')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Search students…'), { target: { value: 'Alice' } })

    await waitFor(() => expect(screen.queryByText('Eric Niyonsenga')).not.toBeInTheDocument())
    expect(screen.getByText('Alice Mutesi')).toBeInTheDocument()
  })

  it('shows the empty state when the server finds no student', async () => {
    getAdminStudents.mockImplementation(async ({ search } = {}) =>
      search ? { count: 0, results: [] } : { count: STUDENTS.length, results: STUDENTS })
    getAdminStudentStats.mockResolvedValue(STATS)
    renderWithRouter(<AdminStudents />)
    await waitFor(() => expect(screen.getByText('Eric Niyonsenga')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Search students…'), { target: { value: 'nonexistent-xyz' } })

    expect(await screen.findByText('No students found')).toBeInTheDocument()
  })

  it('opens the detail modal and shows profile/attendance/results once loaded', async () => {
    getAdminStudents.mockResolvedValue(STUDENTS)
    getAdminStudentStats.mockResolvedValue(STATS)
    getStudentDetail.mockResolvedValue({ grade: 'S4', section: 'A', student_id: 'STU001', dormitory: 'Bisoke', status: 'active', current_gpa: 3.4 })
    getStudentAttendanceStats.mockResolvedValue({ present_percentage: 92, late_percentage: 3, absent_percentage: 5, attendance_rate: 92 })
    getStudentTermResults.mockResolvedValue([{ subject_name: 'Mathematics', total_score: 85, letter_grade: 'A' }])

    renderWithRouter(<AdminStudents />)
    await waitFor(() => expect(screen.getByText('Eric Niyonsenga')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('View')[0])

    expect(screen.getByText('Loading profile…')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
    expect(screen.getAllByText('92%').length).toBeGreaterThan(0)
  })

  it('shows the no-attendance-data message when attendance stats are unavailable', async () => {
    getAdminStudents.mockResolvedValue(STUDENTS)
    getAdminStudentStats.mockResolvedValue(STATS)
    getStudentDetail.mockResolvedValue(null)
    getStudentAttendanceStats.mockRejectedValue(new Error('no data'))
    getStudentTermResults.mockResolvedValue([])

    renderWithRouter(<AdminStudents />)
    await waitFor(() => expect(screen.getByText('Eric Niyonsenga')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('View')[0])

    await waitFor(() => expect(screen.getByText('No attendance data available.')).toBeInTheDocument())
    expect(screen.getByText('No results submitted yet.')).toBeInTheDocument()
  })
})
