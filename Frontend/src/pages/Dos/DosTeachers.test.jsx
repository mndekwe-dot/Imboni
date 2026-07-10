import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { DosTeachers } from './DosTeachers'
import {
  getSchoolConfig, getDosTeachers, getDosTeacherStats, updateDosTeacher,
  getDosTeacherClasses, assignDosTeacherClasses, getSubjects,
} from '../../api/dos'
import { sendInvitation, getInvitations, resendInvitation, cancelInvitation } from '../../api/auth'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

vi.mock('../../api/dos', () => ({
  getSchoolConfig: vi.fn(),
  getDosTeachers: vi.fn(),
  getDosTeacherStats: vi.fn(),
  updateDosTeacher: vi.fn(),
  getDosTeacherClasses: vi.fn(),
  assignDosTeacherClasses: vi.fn(),
  getSubjects: vi.fn(),
}))

vi.mock('../../api/auth', () => ({
  sendInvitation: vi.fn(),
  getInvitations: vi.fn(),
  resendInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const TEACHERS = [
  { teacher_id: 't1', full_name: 'Mr. Habimana', subjects: ['Mathematics'], employment_type: 'full_time' },
  { teacher_id: 't2', full_name: 'Ms. Claudine', subjects: ['English'], employment_type: 'part_time' },
]

const STATS = { total_teachers: 38, new_this_term: 2, full_time_count: 30, full_time_pct: 79, part_time_count: 8, part_time_pct: 21, student_teacher_ratio: '14:1', ratio_label: 'Healthy' }

function setupBaseMocks() {
  getSchoolConfig.mockResolvedValue([])
  getDosTeachers.mockResolvedValue(TEACHERS)
  getDosTeacherStats.mockResolvedValue(STATS)
  getInvitations.mockResolvedValue([])
  getSubjects.mockResolvedValue([{ name: 'Mathematics' }, { name: 'English' }])
  getDosTeacherClasses.mockResolvedValue({ classes: [] })
}

describe('DosTeachers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupBaseMocks()
  })

  it('shows a loading state before teachers resolve', () => {
    getDosTeachers.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DosTeachers />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders the teacher table and stat cards once loaded', async () => {
    renderWithRouter(<DosTeachers />)
    await waitFor(() => expect(screen.getByText('Mr. Habimana')).toBeInTheDocument())
    expect(screen.getByText('Ms. Claudine')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
  })

  it('shows an error message when the teacher list fails to load', async () => {
    getDosTeachers.mockRejectedValue(new Error('Network down'))
    renderWithRouter(<DosTeachers />)
    await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
  })

  it('filters the table by search text', async () => {
    renderWithRouter(<DosTeachers />)
    await waitFor(() => expect(screen.getByText('Mr. Habimana')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Search by name or subject...'), { target: { value: 'Claudine' } })

    expect(screen.queryByText('Mr. Habimana')).not.toBeInTheDocument()
    expect(screen.getByText('Ms. Claudine')).toBeInTheDocument()
  })

  it('invites a new teacher, validating required fields first', async () => {
    sendInvitation.mockResolvedValue({})
    renderWithRouter(<DosTeachers />)
    await waitFor(() => expect(screen.getByText('Mr. Habimana')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Invite Teacher/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /Send Invitation/ })).toBeDisabled()

    fireEvent.change(within(dialog).getByPlaceholderText('e.g. Jean-Pierre'), { target: { value: 'New' } })
    fireEvent.change(within(dialog).getByPlaceholderText('e.g. Habimana'), { target: { value: 'Teacher' } })
    fireEvent.change(within(dialog).getByPlaceholderText('teacher@school.rw'), { target: { value: 'new@imboni.test' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Send Invitation/ }))

    await waitFor(() => expect(sendInvitation).toHaveBeenCalledWith({
      first_name: 'New', last_name: 'Teacher', email: 'new@imboni.test', role: 'teacher',
    }))
    expect(await within(dialog).findByText(/Invitation sent to new@imboni.test/)).toBeInTheDocument()
  })

  it('edits an existing teacher and saves the change', async () => {
    updateDosTeacher.mockResolvedValue({})
    assignDosTeacherClasses.mockResolvedValue({})
    renderWithRouter(<DosTeachers />)
    await waitFor(() => expect(screen.getByText('Mr. Habimana')).toBeInTheDocument())

    fireEvent.click(screen.getAllByRole('button', { name: /Edit/ })[0])
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByDisplayValue('Mr. Habimana')).toBeInTheDocument()

    fireEvent.change(within(dialog).getByDisplayValue('Mr. Habimana'), { target: { value: 'Mr. Habimana Jr' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Save Changes/ }))

    await waitFor(() => expect(updateDosTeacher).toHaveBeenCalledWith('t1', expect.objectContaining({ first_name: 'Mr. Habimana', last_name: 'Jr' })))
  })

  it('lists pending invitations and cancels one', async () => {
    getInvitations.mockResolvedValue([
      { id: 5, role: 'teacher', is_used: false, first_name: 'Pending', last_name: 'Invite', email: 'pending@imboni.test', delivery_status: 'sent', created_at: '2026-06-01', expires_at: '2026-07-01' },
    ])
    cancelInvitation.mockResolvedValue({})
    renderWithRouter(<DosTeachers />)
    await waitFor(() => expect(screen.getByText('Pending Invitations')).toBeInTheDocument())
    expect(screen.getByText('Pending Invite')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }))

    await waitFor(() => expect(cancelInvitation).toHaveBeenCalledWith(5))
  })
})
