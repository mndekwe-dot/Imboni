import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { FinanceAdmissions } from './FinanceAdmissions'
import { getAdmissions, confirmAdmission } from '../../api/finance'
import { confirmDialog } from '../../utils/confirm'

vi.mock('../../api/finance', async importActual => ({
  ...(await importActual()),
  getAdmissions: vi.fn(),
  confirmAdmission: vi.fn(),
  getFinanceAvailability: vi.fn().mockResolvedValue({ enabled: true }),
}))
vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))
vi.mock('../../utils/confirm', () => ({ confirmDialog: vi.fn() }))
vi.mock('../../hooks/useFinanceFeature', () => ({
  useFinanceFeature: () => ({ enabled: true, loading: false }),
}))

const AMINA = {
  student_id: 'u1', student_code: 'STU-001', full_name: 'Amina Uwase', grade: 'S1', section: 'A',
  enrollment_date: '2026-01-10', charged: 300000, paid: 100000, owed: 200000,
}
const BOSCO = { ...AMINA, student_id: 'u2', student_code: 'STU-002', full_name: 'Bosco Habimana', owed: 0, paid: 300000 }

const rowOf = name => screen.getByText(name).closest('tr')

describe('FinanceAdmissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAdmissions.mockResolvedValue({ count: 2, results: [AMINA, BOSCO] })
    confirmDialog.mockResolvedValue(true)
  })

  it('shows skeleton rows under the real headers while it loads', () => {
    getAdmissions.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<FinanceAdmissions />)
    expect(screen.getByRole('columnheader', { name: 'Owed' })).toBeInTheDocument()
    expect(screen.getByText('Loading the admissions queue…')).toBeInTheDocument()
  })

  it('lists each held student with what they were charged, paid and owe', async () => {
    renderWithRouter(<FinanceAdmissions />)
    await screen.findByText('Amina Uwase')
    const row = rowOf('Amina Uwase')
    expect(within(row).getByText('STU-001')).toBeInTheDocument()
    expect(within(row).getByText('S1A')).toBeInTheDocument()
    expect(row.textContent).toMatch(/300,000/)
    expect(row.textContent).toMatch(/100,000/)
    expect(row.textContent).toMatch(/200,000/)
  })

  it('asks before confirming, and does nothing if the answer is no', async () => {
    confirmDialog.mockResolvedValue(false)
    renderWithRouter(<FinanceAdmissions />)
    await screen.findByText('Amina Uwase')
    fireEvent.click(within(rowOf('Amina Uwase')).getByRole('button', { name: /Confirm enrolment/ }))
    await waitFor(() => expect(confirmDialog).toHaveBeenCalled())
    expect(confirmAdmission).not.toHaveBeenCalled()
    expect(screen.getByText('Amina Uwase')).toBeInTheDocument()
  })

  it('confirms, says which class they were placed in, and takes them off the list', async () => {
    confirmAdmission.mockResolvedValue({ student_id: 'u1', status: 'active', placed: true, class_name: 'S1A' })
    renderWithRouter(<FinanceAdmissions />)
    await screen.findByText('Amina Uwase')
    fireEvent.click(within(rowOf('Amina Uwase')).getByRole('button', { name: /Confirm enrolment/ }))

    await waitFor(() => expect(confirmAdmission).toHaveBeenCalledWith('u1'))
    expect(await screen.findByText('Amina Uwase is enrolled and placed in S1A.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('STU-001')).toBeNull())
    expect(screen.getByText('Bosco Habimana')).toBeInTheDocument()
  })

  it('says plainly when no class matched, so the DOS knows to place them', async () => {
    confirmAdmission.mockResolvedValue({ student_id: 'u1', status: 'active', placed: false, class_name: null })
    renderWithRouter(<FinanceAdmissions />)
    await screen.findByText('Amina Uwase')
    fireEvent.click(within(rowOf('Amina Uwase')).getByRole('button', { name: /Confirm enrolment/ }))
    expect(await screen.findByText(/No single class matches their year and stream/)).toBeInTheDocument()
  })

  it('keeps the student on the list and shows why when confirming fails', async () => {
    confirmAdmission.mockRejectedValue(new Error('This student is not awaiting a deposit.'))
    renderWithRouter(<FinanceAdmissions />)
    await screen.findByText('Amina Uwase')
    fireEvent.click(within(rowOf('Amina Uwase')).getByRole('button', { name: /Confirm enrolment/ }))
    expect(await screen.findByText(/not awaiting a deposit|Could not confirm/)).toBeInTheDocument()
    expect(screen.getByText('Amina Uwase')).toBeInTheDocument()
  })

  it('explains the empty queue and where to switch the gate on', async () => {
    getAdmissions.mockResolvedValue({ count: 0, results: [] })
    renderWithRouter(<FinanceAdmissions />)
    expect(await screen.findByText('Nobody is waiting')).toBeInTheDocument()
    expect(screen.getByText(/Switch that on in the DOS settings/)).toBeInTheDocument()
  })

  it('reports a failed load', async () => {
    getAdmissions.mockRejectedValue(new Error('down'))
    renderWithRouter(<FinanceAdmissions />)
    expect(await screen.findByText(/down|Could not load the admissions queue/)).toBeInTheDocument()
  })
})
