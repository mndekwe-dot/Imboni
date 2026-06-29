import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { DosStudents } from './DosStudents'
import {
  getSchoolConfig, getDosStudents, getDosStudentStats, inviteDosStudent,
  bulkInviteDosStudents, getDosStudentDetail, suspendDosStudent,
  changeDosStudentClass, appointStudentLeader, removeStudentLeader,
} from '../../api/dos'
import { getInvitations, resendInvitation, cancelInvitation } from '../../api/auth'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

vi.mock('../../api/dos', () => ({
  getSchoolConfig: vi.fn(),
  getDosStudents: vi.fn(),
  getDosStudentStats: vi.fn(),
  inviteDosStudent: vi.fn(),
  bulkInviteDosStudents: vi.fn(),
  getDosStudentDetail: vi.fn(),
  suspendDosStudent: vi.fn(),
  changeDosStudentClass: vi.fn(),
  appointStudentLeader: vi.fn(),
  removeStudentLeader: vi.fn(),
}))

vi.mock('../../api/auth', () => ({
  getInvitations: vi.fn(),
  resendInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const STUDENTS = [
  { student_id: 'u1', initials: 'EN', full_name: 'Eric N.', student_code: 'STU001', grade: '4', section: 'A', status: 'active', avg_performance: 85 },
  { student_id: 'u2', initials: 'AM', full_name: 'Alice M.', student_code: 'STU002', grade: '4', section: 'B', status: 'suspended', avg_performance: 40 },
]

const STATS = { total_students: 540, new_this_term: 12, active_students: 530, enrollment_pct: 98, new_admissions: 12, avg_performance: 80, avg_performance_change: 2 }

function setupBaseMocks() {
  getSchoolConfig.mockResolvedValue([{ name: 'O-Level', years: [{ name: 'S4', streams: ['A', 'B'] }] }])
  getDosStudents.mockResolvedValue(STUDENTS)
  getDosStudentStats.mockResolvedValue(STATS)
  getInvitations.mockResolvedValue([])
}

describe('DosStudents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupBaseMocks()
  })

  it('shows a loading state before students resolve', () => {
    getDosStudents.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DosStudents />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders student rows and stat cards once loaded', async () => {
    renderWithRouter(<DosStudents />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    expect(screen.getByText('Alice M.')).toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()
    expect(screen.getByText('540')).toBeInTheDocument()
  })

  it('shows an error message when the student list fails to load', async () => {
    getDosStudents.mockRejectedValue(new Error('Network down'))
    renderWithRouter(<DosStudents />)
    await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
  })

  it('debounces search and re-fetches students with the search param', async () => {
    renderWithRouter(<DosStudents />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    getDosStudents.mockClear()

    fireEvent.change(screen.getByPlaceholderText('Search by name or admission number...'), { target: { value: 'Eric' } })

    await waitFor(() => expect(getDosStudents).toHaveBeenCalledWith({ search: 'Eric' }), { timeout: 2000 })
  })

  it('opens the invite modal, validates required fields, then sends an invitation', async () => {
    inviteDosStudent.mockResolvedValue({})
    renderWithRouter(<DosStudents />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Invite Student/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /Send Invitations/ })).toBeDisabled()

    const lastNameInputs = within(dialog).getAllByPlaceholderText('e.g. Uwase')
    fireEvent.change(within(dialog).getByPlaceholderText('e.g. Amina'), { target: { value: 'Amina' } })
    fireEvent.change(lastNameInputs[0], { target: { value: 'Uwase' } })
    fireEvent.change(within(dialog).getByPlaceholderText('student@example.com'), { target: { value: 'amina@imboni.test' } })
    fireEvent.change(within(dialog).getByPlaceholderText('e.g. Chantal'), { target: { value: 'Chantal' } })
    fireEvent.change(lastNameInputs[1], { target: { value: 'Uwase' } })
    fireEvent.change(within(dialog).getByPlaceholderText('parent@example.com'), { target: { value: 'chantal@imboni.test' } })

    fireEvent.click(within(dialog).getByRole('button', { name: /Send Invitations/ }))

    await waitFor(() => expect(inviteDosStudent).toHaveBeenCalled())
    expect(await within(dialog).findByText('Invitations sent successfully')).toBeInTheDocument()
  })

  it('opens the student detail drawer and suspends an active student', async () => {
    getDosStudentDetail.mockResolvedValue({
      grade: '4', section: 'A', full_name: 'Eric N.', student_code: 'STU001',
      email: 'eric@imboni.test', enrollment_date: '2023-01-10', status: 'active',
      avg_performance: 85, attendance_rate: 92, leadership: [],
    })
    suspendDosStudent.mockResolvedValue({ status: 'suspended' })
    renderWithRouter(<DosStudents />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('View')[0])
    await waitFor(() => expect(screen.getByText('eric@imboni.test')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Suspend/ }))

    await waitFor(() => expect(suspendDosStudent).toHaveBeenCalledWith('u1', { suspended: true }))
  })

  it('lists invitation history and resends a pending invitation', async () => {
    getInvitations.mockResolvedValue([
      { id: 9, role: 'student', first_name: 'New', last_name: 'Student', email: 'new@imboni.test', is_used: false, is_expired: false, delivery_status: 'sent', created_at: '2026-06-01', expires_at: '2026-07-01' },
    ])
    resendInvitation.mockResolvedValue({})
    renderWithRouter(<DosStudents />)
    await waitFor(() => expect(screen.getByText('Student Invitation History')).toBeInTheDocument())
    expect(screen.getByText('New Student')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Resend/ }))

    await waitFor(() => expect(resendInvitation).toHaveBeenCalledWith(9))
  })
})
