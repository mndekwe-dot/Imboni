import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, act } from '../../test/test-utils'
import { AdminFinance } from './AdminFinance'

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

describe('AdminFinance', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders stat cards and the initial transaction list', () => {
    renderWithRouter(<AdminFinance />)
    expect(screen.getByText('Ingabire Belise')).toBeInTheDocument()
    expect(screen.getByText('RWF 184M')).toBeInTheDocument()
    expect(screen.getByText('Transactions (6)')).toBeInTheDocument()
  })

  it('filters transactions by status chip', () => {
    renderWithRouter(<AdminFinance />)
    fireEvent.click(screen.getByRole('button', { name: 'Overdue' }))

    expect(screen.queryByText('Ingabire Belise')).not.toBeInTheDocument()
    expect(screen.getByText('Bizimana James')).toBeInTheDocument()
    expect(screen.getByText('Transactions (1)')).toBeInTheDocument()
  })

  it('shows a temporary "Exported!" label after clicking Export', () => {
    renderWithRouter(<AdminFinance />)
    fireEvent.click(screen.getByRole('button', { name: /Export/ }))

    expect(screen.getByText('Exported!')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.queryByText('Exported!')).not.toBeInTheDocument()
  })

  it('disables and re-labels the reminder button temporarily when clicked', () => {
    renderWithRouter(<AdminFinance />)
    const reminderBtn = screen.getByText(/Send Fee Reminder/).closest('button')

    fireEvent.click(reminderBtn)

    expect(reminderBtn).toBeDisabled()
    expect(reminderBtn).toHaveTextContent('Reminders Sent!')

    act(() => { vi.advanceTimersByTime(2500) })
    expect(reminderBtn).not.toBeDisabled()
    expect(reminderBtn).toHaveTextContent('Send Fee Reminder — All Overdue')
  })

  it('records a new payment via the modal and prepends it to the transaction list', () => {
    renderWithRouter(<AdminFinance />)
    fireEvent.click(screen.getByRole('button', { name: /Record New Payment/ }))

    fireEvent.change(screen.getByPlaceholderText('e.g. Aisha Kamau'), { target: { value: 'New Parent' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. 58000'), { target: { value: '20000' } })
    fireEvent.click(screen.getByText('Record Payment'))

    expect(screen.getByText('New Parent')).toBeInTheDocument()
    expect(screen.getByText('Transactions (7)')).toBeInTheDocument()
  })
})
