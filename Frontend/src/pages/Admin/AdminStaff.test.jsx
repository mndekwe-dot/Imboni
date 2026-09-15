import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { AdminStaff } from './AdminStaff'
import {
  getAdminTeacherStats, getInvitations, sendInvitation, resendInvitation, cancelInvitation,
} from '../../api/admin'
import {
  createStaffMember, getDepartments, getStaffMembers, deleteDepartment,
} from '../../api/staff'

vi.mock('../../api/admin', () => ({
  getAdminTeacherStats: vi.fn(),
  getInvitations: vi.fn(),
  sendInvitation: vi.fn(),
  resendInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
}))

vi.mock('../../api/staff', () => ({
  getDepartments: vi.fn(),
  createDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  deleteDepartment: vi.fn(),
  getStaffMembers: vi.fn(),
  createStaffMember: vi.fn(),
  updateStaffMember: vi.fn(),
  deleteStaffMember: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const KITCHEN = { id: 'd-kitchen', code: 'kitchen', name: 'Kitchen & catering', is_active: true, member_count: 1, head: null, head_name: '' }
const ACADEMIC = { id: 'd-academic', code: 'academic', name: 'Academic', is_active: true, member_count: 1, head: null, head_name: '' }

const MEMBERS = [
  { id: 'm1', full_name: 'Jean Habimana', first_name: 'Jean', last_name: 'Habimana', job_title: 'Teacher',
    department: 'd-academic', department_name: 'Academic', department_code: 'academic',
    employment_type: 'full_time', has_account: true, account_role: 'teacher', is_active: true, salary: null },
  { id: 'm2', full_name: 'Jeanne Mukamana', first_name: 'Jeanne', last_name: 'Mukamana', job_title: 'Cook',
    department: 'd-kitchen', department_name: 'Kitchen & catering', department_code: 'kitchen',
    employment_type: 'casual', has_account: false, account_role: '', is_active: true, salary: null, staff_no: 'K-01' },
]

const STATS = { total_teachers: 38, full_time_count: 30, full_time_pct: 79, part_time_count: 8, part_time_pct: 21, student_teacher_ratio: '14:1' }

describe('AdminStaff', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    getInvitations.mockResolvedValue([])
    getAdminTeacherStats.mockResolvedValue(STATS)
    getStaffMembers.mockResolvedValue(MEMBERS)
    getDepartments.mockResolvedValue([ACADEMIC, KITCHEN])
  })

  it('lists every worker, with and without a login, in their departments', async () => {
    renderWithRouter(<AdminStaff />)

    expect(await screen.findByText('Jean Habimana')).toBeInTheDocument()
    expect(screen.getByText('Jeanne Mukamana')).toBeInTheDocument()
    expect(screen.getAllByText('Kitchen & catering').length).toBeGreaterThan(0)
    expect(screen.getByText('Imboni login')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
  })

  it('asks the server for one department', async () => {
    renderWithRouter(<AdminStaff />)
    await screen.findByText('Jean Habimana')

    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'd-kitchen' } })

    await waitFor(() => expect(getStaffMembers).toHaveBeenLastCalledWith(
      expect.objectContaining({ department: 'd-kitchen', status: 'active' })))
  })

  it('adds a worker who has no Imboni account', async () => {
    createStaffMember.mockResolvedValue({ id: 'm3' })
    renderWithRouter(<AdminStaff />)
    await screen.findByText('Jean Habimana')

    fireEvent.click(screen.getByRole('button', { name: /Add worker/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('First name'), { target: { value: 'Eric' } })
    fireEvent.change(within(dialog).getByLabelText('Job title'), { target: { value: 'Night guard' } })
    fireEvent.change(within(dialog).getByLabelText('Department'), { target: { value: 'd-kitchen' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(createStaffMember).toHaveBeenCalledWith(expect.objectContaining({
      first_name: 'Eric', job_title: 'Night guard', department: 'd-kitchen',
    })))
  })

  it('keeps an account holder’s name on the account', async () => {
    renderWithRouter(<AdminStaff />)
    await screen.findByText('Jean Habimana')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByLabelText('First name')).toBeDisabled()
    expect(within(dialog).getByLabelText('Department')).not.toBeDisabled()
  })

  it('retires a department people still work in', async () => {
    deleteDepartment.mockResolvedValue({ ...KITCHEN, is_active: false })
    renderWithRouter(<AdminStaff />, { route: '/admin/staff?tab=departments' })

    expect(await screen.findByText('Kitchen & catering')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Retire' })[0])

    await waitFor(() => expect(deleteDepartment).toHaveBeenCalledWith('d-academic'))
  })

  it('switches to the invitations tab and shows the pending badge count', async () => {
    getInvitations.mockResolvedValue([
      { id: 9, first_name: 'New', last_name: 'Hire', email: 'new@imboni.test', role: 'teacher', is_used: false, status: 'pending', created_at: '2026-01-01' },
    ])
    renderWithRouter(<AdminStaff />)
    await screen.findByText('Jean Habimana')

    fireEvent.click(screen.getByRole('tab', { name: /Invitations/ }))

    expect(await screen.findByText('New Hire')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('resends and cancels an invitation', async () => {
    getInvitations.mockResolvedValue([
      { id: 9, first_name: 'New', last_name: 'Hire', email: 'new@imboni.test', role: 'teacher', is_used: false, status: 'pending', created_at: '2026-01-01' },
    ])
    resendInvitation.mockResolvedValue({})
    cancelInvitation.mockResolvedValue({})

    renderWithRouter(<AdminStaff />, { route: '/admin/staff?tab=invitations' })
    await screen.findByText('New Hire')

    fireEvent.click(screen.getByTitle('Resend invitation'))
    await waitFor(() => expect(resendInvitation).toHaveBeenCalledWith(9))

    fireEvent.click(screen.getByTitle('Cancel invitation'))
    await waitFor(() => expect(cancelInvitation).toHaveBeenCalledWith(9))
  })

  it('shows the empty-invitations message when there are none', async () => {
    renderWithRouter(<AdminStaff />, { route: '/admin/staff?tab=invitations' })

    expect(await screen.findByText(/No invitations sent yet/)).toBeInTheDocument()
  })

  it('offers the librarian and the bursar as roles to invite', async () => {
    renderWithRouter(<AdminStaff />)
    await screen.findByText('Jean Habimana')

    fireEvent.click(screen.getByRole('button', { name: /Invite Staff/ }))
    const roles = [...screen.getByLabelText('Role *').querySelectorAll('option')].map(o => o.value)

    expect(roles).toEqual(expect.arrayContaining(['librarian', 'bursar']))
  })

  it('validates required fields before sending an invite, then submits successfully', async () => {
    sendInvitation.mockResolvedValue({})

    renderWithRouter(<AdminStaff />)
    await screen.findByText('Jean Habimana')

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
