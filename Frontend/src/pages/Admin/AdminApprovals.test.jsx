import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { AdminApprovals } from './AdminApprovals'
import { getPendingResults, approveResult, rejectResult, bulkApproveResults } from '../../api/admin'

vi.mock('../../api/admin', () => ({
  getPendingResults: vi.fn(),
  approveResult: vi.fn(),
  rejectResult: vi.fn(),
  bulkApproveResults: vi.fn(),
}))

vi.mock('../../api/dos', () => ({
  getSchoolConfig: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const PENDING = [
  { id: 1, student_name: 'Eric N.', subject_name: 'Mathematics', total_score: 78, letter_grade: 'B', teacher_name: 'Mr. Habimana', grade: '4', section: 'A' },
  { id: 2, student_name: 'Alice M.', subject_name: 'Mathematics', total_score: 88, letter_grade: 'A', teacher_name: 'Mr. Habimana', grade: '4', section: 'B' },
]

function mockByStatus({ pending = [], approved = [], rejected = [] } = {}) {
  getPendingResults.mockImplementation(({ status }) => {
    if (status === 'approved') return Promise.resolve(approved)
    if (status === 'rejected') return Promise.resolve(rejected)
    return Promise.resolve(pending)
  })
}

describe('AdminApprovals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state before results resolve', () => {
    getPendingResults.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<AdminApprovals />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders pending results and stat counts once loaded', async () => {
    mockByStatus({ pending: PENDING, approved: [{ id: 9 }], rejected: [] })
    renderWithRouter(<AdminApprovals />)

    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    expect(screen.getByText('Alice M.')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
  })

  it('shows the empty state when there are no pending results', async () => {
    mockByStatus()
    renderWithRouter(<AdminApprovals />)
    await waitFor(() => expect(screen.getByText('No pending results.')).toBeInTheDocument())
  })

  it('approves a single result', async () => {
    mockByStatus({ pending: PENDING })
    approveResult.mockResolvedValue({})
    renderWithRouter(<AdminApprovals />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())

    fireEvent.click(screen.getAllByTitle('Approve')[0])

    await waitFor(() => expect(approveResult).toHaveBeenCalledWith(1, {}))
  })

  it('selects rows and bulk-approves them', async () => {
    mockByStatus({ pending: PENDING })
    bulkApproveResults.mockResolvedValue({})
    renderWithRouter(<AdminApprovals />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    fireEvent.click(checkboxes[2])

    fireEvent.click(screen.getByRole('button', { name: /Approve Selected \(2\)/ }))

    await waitFor(() => expect(bulkApproveResults).toHaveBeenCalledWith([1, 2]))
  })

  it('requires a reason before rejecting a result', async () => {
    mockByStatus({ pending: PENDING })
    renderWithRouter(<AdminApprovals />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())

    fireEvent.click(screen.getAllByTitle('Reject')[0])
    expect(screen.getAllByText('Reject Result').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Reject Result/ }))
    expect(screen.getByText('Rejection reason is required.')).toBeInTheDocument()
    expect(rejectResult).not.toHaveBeenCalled()
  })

  it('rejects a result with a reason', async () => {
    mockByStatus({ pending: PENDING })
    rejectResult.mockResolvedValue({})
    renderWithRouter(<AdminApprovals />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())

    fireEvent.click(screen.getAllByTitle('Reject')[0])
    fireEvent.change(screen.getByPlaceholderText(/Scores do not match/), { target: { value: 'Marks look incorrect.' } })
    fireEvent.click(screen.getByRole('button', { name: /Reject Result/ }))

    await waitFor(() => expect(rejectResult).toHaveBeenCalledWith(1, { rejection_reason: 'Marks look incorrect.' }))
  })

  it('switches to the Approved tab and shows status badges instead of actions', async () => {
    mockByStatus({ pending: PENDING, approved: [{ id: 5, student_name: 'John K.', subject_name: 'English', total_score: 65, letter_grade: 'C', teacher_name: 'Ms. Claudine' }] })
    renderWithRouter(<AdminApprovals />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Approved' }))

    await waitFor(() => expect(screen.getByText('John K.')).toBeInTheDocument())
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0)
    expect(screen.queryByTitle('Approve')).not.toBeInTheDocument()
  })
})
