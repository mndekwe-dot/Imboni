import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { AdminStaff } from './AdminStaff'
import {
  getAdminStaff, getAdminTeacherStats,
  getInvitations, sendInvitation, resendInvitation, cancelInvitation,
} from '../../api/admin'

vi.mock('../../api/admin', () => ({
  getAdminStaff: vi.fn(),
  getAdminTeacherStats: vi.fn(),
  getInvitations: vi.fn(),
  sendInvitation: vi.fn(),
  resendInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const STAFF = [
  { id: 1, name: 'Jean Habimana', email: 'jean@imboni.test', role: 'teacher', employment_type: 'full_time', is_active: true },
  { id: 2, name: 'Claudine Umutoni', email: 'claudine@imboni.test', role: 'matron', employment_type: 'part_time', is_active: true },
]

const STATS = { total_teachers: 38, full_time_count: 30, full_time_pct: 79, part_time_count: 8, part_time_pct: 21, student_teacher_ratio: '14:1' }

describe('AdminStaff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getInvitations.mockResolvedValue([])
  })

  it('shows a loading state before staff resolve', () => {
    getAdminStaff.mockReturnValue(new Promise(() => {}))
    getAdminTeacherStats.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<AdminStaff />)
    expect(screen.getByText('Loading staff…')).toBeInTheDocument()
  })

  it('renders the staff table and stat cards once loaded', async () => {
    getAdminStaff.mockResolvedValue(STAFF)
    getAdminTeacherStats.mockResolvedValue(STATS)
    renderWithRouter(<AdminStaff />)

    await waitFor(() => expect(screen.getByText('Jean Habimana')).toBeInTheDocument())
    expect(screen.getByText('Claudine Umutoni')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
  })

  it('filters staff by department', async () => {
    getAdminStaff.mockResolvedValue(STAFF)
    getAdminTeacherStats.mockResolvedValue(STATS)
    renderWithRouter(<AdminStaff />)
    await waitFor(() => expect(screen.getByText('Jean Habimana')).toBeInTheDocument())

    fireEvent.change(screen.getByDisplayValue('All Departments'), { target: { value: 'Welfare' } })

    expect(screen.queryByText('Jean Habimana')).not.toBeInTheDocument()
    expect(screen.getByText('Claudine Umutoni')).toBeInTheDocument()
  })

  it('opens the staff profile modal with member details', async () => {
    getAdminStaff.mockResolvedValue(STAFF)
    getAdminTeacherStats.mockResolvedValue(STATS)
    renderWithRouter(<AdminStaff />)
    await waitFor(() => expect(screen.getByText('Jean Habimana')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('View')[0])

    expect(screen.getByText('Staff Profile')).toBeInTheDocument()
    expect(screen.getAllByText('jean@imboni.test').length).toBeGreaterThan(0)
  })

  it('switches to the invitations tab and shows the pending badge count', async () => {
    getAdminStaff.mockResolvedValue(STAFF)
    getAdminTeacherStats.mockResolvedValue(STATS)
    getInvitations.mockResolvedValue([
      { id: 9, first_name: 'New', last_name: 'Hire', email: 'new@imboni.test', role: 'teacher', is_used: false, status: 'pending', created_at: '2026-01-01' },
    ])
    renderWithRouter(<AdminStaff />)
    await waitFor(() => expect(screen.getByText('Jean Habimana')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Invitations/ }))

    expect(await screen.findByText('New Hire')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('resends and cancels an invitation', async () => {
    getAdminStaff.mockResolvedValue(STAFF)
    getAdminTeacherStats.mockResolvedValue(STATS)
    getInvitations.mockResolvedValue([
      { id: 9, first_name: 'New', last_name: 'Hire', email: 'new@imboni.test', role: 'teacher', is_used: false, status: 'pending', created_at: '2026-01-01' },
    ])
    resendInvitation.mockResolvedValue({})
    cancelInvitation.mockResolvedValue({})

    renderWithRouter(<AdminStaff />)
    await waitFor(() => expect(screen.getByText('Jean Habimana')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Invitations/ }))
    await screen.findByText('New Hire')

    fireEvent.click(screen.getByTitle('Resend invitation'))
    await waitFor(() => expect(resendInvitation).toHaveBeenCalledWith(9))

    fireEvent.click(screen.getByTitle('Cancel invitation'))
    await waitFor(() => expect(cancelInvitation).toHaveBeenCalledWith(9))
  })

  it('shows the empty-invitations message when there are none', async () => {
    getAdminStaff.mockResolvedValue(STAFF)
    getAdminTeacherStats.mockResolvedValue(STATS)
    renderWithRouter(<AdminStaff />)
    await waitFor(() => expect(screen.getByText('Jean Habimana')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Invitations/ }))

    expect(await screen.findByText(/No invitations sent yet/)).toBeInTheDocument()
  })

  it('validates required fields before sending an invite, then submits successfully', async () => {
    getAdminStaff.mockResolvedValue(STAFF)
    getAdminTeacherStats.mockResolvedValue(STATS)
    sendInvitation.mockResolvedValue({})

    renderWithRouter(<AdminStaff />)
    await waitFor(() => expect(screen.getByText('Jean Habimana')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Invite Staff/ }))
    fireEvent.click(screen.getByRole('button', { name: /Send Invitation/ }))
    expect(screen.getByText('First name, last name and email are required.')).toBeInTheDocument()
    expect(sendInvitation).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'New' } })
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Hire' } })
    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'new@imboni.test' } })
    fireEvent.click(screen.getByRole('button', { name: /Send Invitation/ }))

    await waitFor(() => expect(sendInvitation).toHaveBeenCalledWith(expect.objectContaining({
      first_name: 'New', last_name: 'Hire', email: 'new@imboni.test', role: 'teacher',
    })))
    expect(await screen.findByText('Invitation sent!')).toBeInTheDocument()
  })
})
