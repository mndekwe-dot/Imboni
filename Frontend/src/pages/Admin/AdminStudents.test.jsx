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
  { id: 1, name: 'Eric Niyonsenga', student_id: 'STU001', grade: '4', section: 'A', dormitory: 'Bisoke', status: 'active' },
  { id: 2, name: 'Alice Mutesi', student_id: 'STU002', grade: '4', section: 'B', dormitory: 'Karisimbi', status: 'active' },
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

  it('filters the table by search text', async () => {
    getAdminStudents.mockResolvedValue(STUDENTS)
    getAdminStudentStats.mockResolvedValue(STATS)
    renderWithRouter(<AdminStudents />)
    await waitFor(() => expect(screen.getByText('Eric Niyonsenga')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Search students…'), { target: { value: 'Alice' } })

    expect(screen.queryByText('Eric Niyonsenga')).not.toBeInTheDocument()
    expect(screen.getByText('Alice Mutesi')).toBeInTheDocument()
  })

  it('shows the empty state when no student matches the filters', async () => {
    getAdminStudents.mockResolvedValue(STUDENTS)
    getAdminStudentStats.mockResolvedValue(STATS)
    renderWithRouter(<AdminStudents />)
    await waitFor(() => expect(screen.getByText('Eric Niyonsenga')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Search students…'), { target: { value: 'nonexistent-xyz' } })

    expect(screen.getByText('No students found')).toBeInTheDocument()
  })

  it('opens the detail modal and shows profile/attendance/results once loaded', async () => {
    getAdminStudents.mockResolvedValue(STUDENTS)
    getAdminStudentStats.mockResolvedValue(STATS)
    getStudentDetail.mockResolvedValue({ grade: '4', section: 'A', student_id: 'STU001', dormitory: 'Bisoke', status: 'active', current_gpa: 3.4 })
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
