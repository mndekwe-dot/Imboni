import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, act, waitFor } from '../../test/test-utils'
import { AdminFinance } from './AdminFinance'
import { sendFeeReminders, getFeesOverview, getOutstandingFees } from '../../api/admin'
import { getSchoolSettings, getCurrentTerm } from '../../api/dos'

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

vi.mock('../../api/admin', () => ({
  sendFeeReminders: vi.fn(),
  getFeesOverview: vi.fn(),
  getOutstandingFees: vi.fn(),
}))

vi.mock('../../api/dos', () => ({
  getSchoolSettings: vi.fn(),
  getCurrentTerm: vi.fn(),
}))

const OVERVIEW = {
  term: 'Term 2',
  total_billed: 184000000,
  total_collected: 173000000,
  total_outstanding: 11000000,
  collection_rate: 94,
  overdue_count: 143,
}

const OUTSTANDING = [
  { student_name: 'Ingabire Belise', student_code: 'ADM-2026-001', category: 'tuition',
    amount: 580000, status: 'due',     due_date: '2026-03-08' },
  { student_name: 'Bizimana James',  student_code: 'ADM-2026-004', category: 'tuition',
    amount: 580000, status: 'overdue', due_date: '2026-03-01' },
]

describe('AdminFinance', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    getFeesOverview.mockResolvedValue(OVERVIEW)
    getOutstandingFees.mockResolvedValue(OUTSTANDING)
    getSchoolSettings.mockResolvedValue({ currency: 'RWF', timezone: 'Africa/Kigali' })
    getCurrentTerm.mockResolvedValue({ name: 'Term 2', year: 2026 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('renders totals from the fees overview endpoint', async () => {
    renderWithRouter(<AdminFinance />)
    // Figures come from the API, not from constants in the page.
    await waitFor(() => expect(screen.getByText('RWF 184,000,000')).toBeInTheDocument())
    expect(screen.getByText('RWF 173,000,000')).toBeInTheDocument()
    expect(screen.getByText('94% of target')).toBeInTheDocument()
    expect(screen.getByText('143 overdue')).toBeInTheDocument()
  })

  it('lists outstanding fees for the current term', async () => {
    renderWithRouter(<AdminFinance />)
    await waitFor(() => expect(screen.getByText('Ingabire Belise')).toBeInTheDocument())
    expect(screen.getByText('Outstanding Fees (2)')).toBeInTheDocument()
  })

  it('filters the list by status chip', async () => {
    renderWithRouter(<AdminFinance />)
    await waitFor(() => expect(screen.getByText('Ingabire Belise')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Overdue' }))

    expect(screen.queryByText('Ingabire Belise')).not.toBeInTheDocument()
    expect(screen.getByText('Bizimana James')).toBeInTheDocument()
    expect(screen.getByText('Outstanding Fees (1)')).toBeInTheDocument()
  })

  it('explains itself when no term is marked current', async () => {
    // Both endpoints 404 in that state; the page must say so rather than
    // showing zeros as if they were real figures.
    getFeesOverview.mockRejectedValue(new Error('404'))
    getOutstandingFees.mockRejectedValue(new Error('404'))

    renderWithRouter(<AdminFinance />)

    await waitFor(() =>
      expect(screen.getByText(/Fee data is unavailable/)).toBeInTheDocument())
  })

  it('shows a temporary "Exported!" label after clicking Export', async () => {
    renderWithRouter(<AdminFinance />)
    await waitFor(() => expect(screen.getByText('Ingabire Belise')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Export/ }))

    expect(screen.getByText('Exported!')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.queryByText('Exported!')).not.toBeInTheDocument()
  })

  it('sends fee reminders and shows how many parents were notified', async () => {
    sendFeeReminders.mockResolvedValue({ students: 3, parents_notified: 4 })
    renderWithRouter(<AdminFinance />)
    const reminderBtn = screen.getByText(/Send Fee Reminder/).closest('button')

    fireEvent.click(reminderBtn)

    await waitFor(() => expect(reminderBtn).toHaveTextContent('Reminded 4 parents (3 students)'))
    expect(sendFeeReminders).toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(4000) })
    expect(reminderBtn).toHaveTextContent('Send Fee Reminder to All Overdue')
  })

  it('shows an error label when sending reminders fails', async () => {
    sendFeeReminders.mockRejectedValue(new Error('boom'))
    renderWithRouter(<AdminFinance />)
    const reminderBtn = screen.getByText(/Send Fee Reminder/).closest('button')

    fireEvent.click(reminderBtn)

    await waitFor(() => expect(reminderBtn).toHaveTextContent('Failed to send reminders.'))
  })

  it('re-reads outstanding fees after recording a payment', async () => {
    renderWithRouter(<AdminFinance />)
    await waitFor(() => expect(screen.getByText('Ingabire Belise')).toBeInTheDocument())
    getOutstandingFees.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /Record New Payment/ }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Aisha Kamau'), { target: { value: 'New Parent' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. 58000'), { target: { value: '20000' } })
    fireEvent.click(screen.getByText('Record Payment'))

    // The server owns the fee's new status, so the page refetches rather than
    // splicing a row in locally.
    await waitFor(() => expect(getOutstandingFees).toHaveBeenCalled())
  })
})
