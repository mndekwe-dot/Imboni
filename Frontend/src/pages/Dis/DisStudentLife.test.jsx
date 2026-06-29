import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { DisStudentLife } from './DisStudentLife'
import {
  getDisActivities, createDisActivity, patchDisActivity, deleteDisActivity,
  getDisStudentLeaders, createDisStudentLeader, patchDisStudentLeader, deleteDisStudentLeader,
  getDisReports, getDisCurrentTerm,
} from '../../api/discipline'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

vi.mock('../../api/discipline', () => ({
  getDisActivities: vi.fn(),
  createDisActivity: vi.fn(),
  patchDisActivity: vi.fn(),
  deleteDisActivity: vi.fn(),
  getDisStudentLeaders: vi.fn(),
  createDisStudentLeader: vi.fn(),
  patchDisStudentLeader: vi.fn(),
  deleteDisStudentLeader: vi.fn(),
  getDisReports: vi.fn(),
  getDisCurrentTerm: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const ACTIVITIES = [
  { id: 1, name: 'Chess Club', category: 'other', is_active: true, max_members: 20, enrolled_count: 10, teacher_name: 'Mr. X' },
]

const LEADERS = [
  { id: 1, student_name: 'Eric N.', role: 'prefect', grade: '5', section: 'A', student_id: 'STU001', appointed_date: '2026-01-10' },
  { id: 2, student_name: 'Alice M.', role: 'house_captain', grade: '4', section: 'B', student_id: 'STU002', appointed_date: '2026-01-15', notes: 'Bisoke' },
]

describe('DisStudentLife', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDisReports.mockResolvedValue([])
    getDisCurrentTerm.mockResolvedValue({ id: 1 })
  })

  it('shows a loading state then activity cards once loaded', async () => {
    getDisActivities.mockResolvedValue(ACTIVITIES)
    renderWithRouter(<DisStudentLife />)
    await waitFor(() => expect(screen.getByText('Chess Club')).toBeInTheDocument())
  })

  it('shows the empty state when there are no activities', async () => {
    getDisActivities.mockResolvedValue([])
    renderWithRouter(<DisStudentLife />)
    await waitFor(() => expect(screen.getByText('No activities found.')).toBeInTheDocument())
  })

  it('filters activities by category', async () => {
    getDisActivities.mockResolvedValue(ACTIVITIES)
    renderWithRouter(<DisStudentLife />)
    await waitFor(() => expect(screen.getByText('Chess Club')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Sports' }))

    expect(screen.queryByText('Chess Club')).not.toBeInTheDocument()
  })

  it('creates a new club via the modal', async () => {
    getDisActivities.mockResolvedValue([])
    createDisActivity.mockResolvedValue({ id: 2, name: 'Debate Club', category: 'debate', is_active: true, max_members: 15, enrolled_count: 0 })
    renderWithRouter(<DisStudentLife />)
    await waitFor(() => expect(screen.getByText('No activities found.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /New Club/ }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Science Club'), { target: { value: 'Debate Club' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Club/ }))

    await waitFor(() => expect(createDisActivity).toHaveBeenCalled())
  })

  it('switches to the leaders tab and shows prefects and dormitory captains', async () => {
    getDisActivities.mockResolvedValue([])
    getDisStudentLeaders.mockResolvedValue(LEADERS)
    renderWithRouter(<DisStudentLife />)
    await waitFor(() => expect(screen.getByText('No activities found.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Student Leaders/ }))

    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    expect(screen.getByText('Alice M.')).toBeInTheDocument()
  })

  it('removes a dormitory captain after confirming', async () => {
    getDisActivities.mockResolvedValue([])
    getDisStudentLeaders.mockResolvedValue(LEADERS)
    deleteDisStudentLeader.mockResolvedValue({})
    renderWithRouter(<DisStudentLife />)
    await waitFor(() => expect(screen.getByText('No activities found.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Student Leaders/ }))
    await waitFor(() => expect(screen.getByText('Alice M.')).toBeInTheDocument())

    const row = screen.getByText('Alice M.').closest('tr')
    fireEvent.click(within(row).getByRole('button', { name: /Remove/ }))
    fireEvent.click(within(row).getByText('Yes'))

    await waitFor(() => expect(deleteDisStudentLeader).toHaveBeenCalledWith(2))
  })
})
