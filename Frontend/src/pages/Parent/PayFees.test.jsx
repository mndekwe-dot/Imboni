import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, act } from '../../test/test-utils'
import { PayFeesPanel } from './PayFees'
import { getChildPay, startChildPay, getChildPayAttempt } from '../../api/parent'

vi.mock('../../api/parent', () => ({ getChildPay: vi.fn(), startChildPay: vi.fn(), getChildPayAttempt: vi.fn() }))

describe('PayFeesPanel', () => {
    beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers({ shouldAdvanceTime: true }) })
    afterEach(() => vi.useRealTimers())

    it('is absent when online payment is off, or when nothing is owed', async () => {
        getChildPay.mockResolvedValue({ enabled: false, outstanding: '50000', attempts: [] })
        const { unmount } = renderWithRouter(<PayFeesPanel childId="c1" />)
        await waitFor(() => expect(getChildPay).toHaveBeenCalled())
        expect(screen.queryByRole('button', { name: 'Pay with mobile money' })).not.toBeInTheDocument()
        unmount()

        getChildPay.mockResolvedValue({ enabled: true, outstanding: '0.00', attempts: [] })
        renderWithRouter(<PayFeesPanel childId="c1" />)
        await waitFor(() => expect(getChildPay).toHaveBeenCalledTimes(2))
        expect(screen.queryByRole('button', { name: 'Pay with mobile money' })).not.toBeInTheDocument()
    })

    it('sends the prompt, waits for the phone, and reports the receipt', async () => {
        getChildPay.mockResolvedValue({ enabled: true, outstanding: '50000.00', attempts: [] })
        startChildPay.mockResolvedValue({ id: 'op1', status: 'pending' })
        getChildPayAttempt
            .mockResolvedValueOnce({ id: 'op1', status: 'pending' })
            .mockResolvedValueOnce({ id: 'op1', status: 'successful', receipt_no: 'RC-00007' })
        renderWithRouter(<PayFeesPanel childId="c1" />)

        fireEvent.click(await screen.findByRole('button', { name: 'Pay with mobile money' }))
        fireEvent.change(screen.getByLabelText('Mobile money number'), { target: { value: '0788123456' } })
        fireEvent.click(screen.getByRole('button', { name: 'Send the prompt to my phone' }))

        expect(startChildPay).toHaveBeenCalledWith('c1', { amount: '50000', phone: '0788123456' })
        expect(await screen.findByText(/Check your phone/)).toBeInTheDocument()

        await act(async () => { await vi.advanceTimersByTimeAsync(4100) })
        expect(screen.getByText(/Check your phone/)).toBeInTheDocument()       // still pending: keeps asking
        await act(async () => { await vi.advanceTimersByTimeAsync(4100) })
        expect(await screen.findByText('Paid. Receipt RC-00007. Thank you.')).toBeInTheDocument()
    })

    it('tells the parent when the payment was declined, with the reason', async () => {
        getChildPay.mockResolvedValue({ enabled: true, outstanding: '50000.00', attempts: [] })
        startChildPay.mockResolvedValue({ id: 'op1', status: 'pending' })
        getChildPayAttempt.mockResolvedValue({ id: 'op1', status: 'failed', detail: 'PAYER_LIMIT_REACHED' })
        renderWithRouter(<PayFeesPanel childId="c1" />)

        fireEvent.click(await screen.findByRole('button', { name: 'Pay with mobile money' }))
        fireEvent.change(screen.getByLabelText('Mobile money number'), { target: { value: '0788123456' } })
        fireEvent.click(screen.getByRole('button', { name: 'Send the prompt to my phone' }))
        await screen.findByText(/Check your phone/)
        await act(async () => { await vi.advanceTimersByTimeAsync(4100) })

        expect(await screen.findByText('The payment did not go through: PAYER_LIMIT_REACHED')).toBeInTheDocument()
    })

    it('shows the reason when the school refuses to start one', async () => {
        getChildPay.mockResolvedValue({ enabled: true, outstanding: '50000.00', attempts: [] })
        startChildPay.mockRejectedValue({ response: { data: { detail: 'Enter the mobile money number as 07XX XXX XXX.' } } })
        renderWithRouter(<PayFeesPanel childId="c1" />)
        fireEvent.click(await screen.findByRole('button', { name: 'Pay with mobile money' }))
        fireEvent.change(screen.getByLabelText('Mobile money number'), { target: { value: '12' } })
        fireEvent.click(screen.getByRole('button', { name: 'Send the prompt to my phone' }))
        expect(await screen.findByText('Enter the mobile money number as 07XX XXX XXX.')).toBeInTheDocument()
    })
})
