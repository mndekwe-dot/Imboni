import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { FinancePayments } from './FinancePayments'
import {
    getDebtors, getFinanceAvailability, getPayments, getStudentFinance, recordPayment,
    reversePayment,
} from '../../api/finance'

vi.mock('../../api/finance', () => ({
    getFinanceAvailability: vi.fn(),
    getPayments: vi.fn(),
    getDebtors: vi.fn(),
    getStudentFinance: vi.fn(),
    recordPayment: vi.fn(),
    reversePayment: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn(),
}))

const PAYMENT = {
    id: 'pay-1',
    receipt_no: 'RCT-00001',
    student: { id: 's1', name: 'Amina Uwase', class_label: 'S4A' },
    category: 'tuition',
    amount: '20000.00',
    method: 'momo',
    paid_on: '2026-08-20',
    is_reversed: false,
    received_by_name: 'Josiane M',
    reference: 'MOMO-771',
}

describe('FinancePayments', () => {
    beforeAll(() => {
        // jsdom has no <dialog> implementation; the shared Modal calls these.
        HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
        HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    })

    beforeEach(() => {
        vi.clearAllMocks()
        getFinanceAvailability.mockResolvedValue({ enabled: true })
        getPayments.mockResolvedValue([PAYMENT])
        getDebtors.mockResolvedValue([])
    })

    it('shows the receipt book', async () => {
        renderWithRouter(<FinancePayments />)
        await waitFor(() => expect(screen.getByText('RCT-00001')).toBeInTheDocument())
        expect(screen.getByText('Amina Uwase')).toBeInTheDocument()
        // 20000 formatted with a thousands separator, not raw.
        expect(screen.getByText(/20,000/)).toBeInTheDocument()
    })

    it('offers no reversal on a receipt that is already reversed', async () => {
        getPayments.mockResolvedValue([{ ...PAYMENT, is_reversed: true }])
        renderWithRouter(<FinancePayments />)

        await waitFor(() => expect(screen.getByText('RCT-00001')).toBeInTheDocument())
        expect(screen.getByText('Reversed')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Reverse' })).not.toBeInTheDocument()
    })

    it('reverses a receipt and says the balance is back', async () => {
        reversePayment.mockResolvedValue({ ...PAYMENT, is_reversed: true })
        renderWithRouter(<FinancePayments />)
        await waitFor(() => expect(screen.getByText('RCT-00001')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Reverse' }))

        await waitFor(() => expect(reversePayment).toHaveBeenCalledWith('pay-1', ''))
        expect(await screen.findByText(/balance is back/i)).toBeInTheDocument()
    })

    it('will not take a payment until a charge and an amount are chosen', async () => {
        renderWithRouter(<FinancePayments />)
        await waitFor(() => expect(screen.getByText('RCT-00001')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Take a payment/i }))

        // The dialog's own submit, not the toolbar button that opened it —
        // both carry the same label, and the toolbar one is never disabled.
        const dialog = await screen.findByRole('dialog')
        const submit = within(dialog).getByRole('button', { name: /Take a payment/i })
        expect(submit).toBeDisabled()
        expect(recordPayment).not.toHaveBeenCalled()
    })

    it('spreads one sum over the oldest charges first, on one receipt', async () => {
        getDebtors.mockResolvedValue([{ student: { id: 's1', name: 'Amina Uwase', class_label: 'S4A' } }])
        getStudentFinance.mockResolvedValue({
            fees: [
                { id: 'lunch', category: 'lunch', balance: '40000.00', due_date: '2026-10-01' },
                { id: 'arrears', category: 'arrears', balance: '30000.00', due_date: '2026-07-01' },
                { id: 'tuition', category: 'tuition', balance: '100000.00', due_date: '2026-09-01' },
            ],
        })
        recordPayment.mockResolvedValue({
            payment: { ...PAYMENT, id: 'pay-9', receipt_no: 'RCT-00009' },
            payments: [{ ...PAYMENT, id: 'pay-9' }, { ...PAYMENT, id: 'pay-10', category: 'arrears' }],
            total: '50000.00',
        })
        renderWithRouter(<FinancePayments />)
        await waitFor(() => expect(screen.getByText('RCT-00001')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: /Take a payment/i }))
        const dialog = await screen.findByRole('dialog')

        fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Amina' } })
        fireEvent.click(await within(dialog).findByRole('option', {}, { timeout: 2000 }))
        fireEvent.change(await within(dialog).findByLabelText('Amount'), { target: { value: '50000' } })

        // Arrears (oldest) in full, then 20,000 of tuition, lunch untouched.
        const rows = within(dialog).getAllByRole('row').slice(1)
        expect(rows[0]).toHaveTextContent(/30,000 RWF.*30,000 RWF/)
        expect(rows[1]).toHaveTextContent(/100,000 RWF.*20,000 RWF/)
        expect(rows[2]).toHaveTextContent(/-$/)

        fireEvent.click(within(dialog).getByRole('button', { name: /Take a payment/i }))

        await waitFor(() => expect(recordPayment).toHaveBeenCalledWith(expect.objectContaining({
            student: 's1',
            amount: '50000',
            allocations: [{ fee: 'arrears', amount: '30000' }, { fee: 'tuition', amount: '20000' }],
        })))
    })

    it('shows the upgrade notice, and asks for nothing, off the plan', async () => {
        getFinanceAvailability.mockResolvedValue({ enabled: false })
        renderWithRouter(<FinancePayments />)

        expect(await screen.findByText(/part of the Premium plan/i)).toBeInTheDocument()
        expect(screen.queryByText('RCT-00001')).not.toBeInTheDocument()
    })
})
