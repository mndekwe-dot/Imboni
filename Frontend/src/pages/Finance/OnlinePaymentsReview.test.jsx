import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { OnlinePaymentsReview } from './OnlinePaymentsReview'
import { getOnlinePayments, resolveOnlinePayment } from '../../api/finance'

vi.mock('../../api/finance', () => ({ getOnlinePayments: vi.fn(), resolveOnlinePayment: vi.fn() }))

const ROW = { id: 'o1', student: 'Amina Uwase', amount: '500', paid_by: 'Mama Amina', phone: '250788123456', transaction_id: 'TX1', detail: '' }

describe('OnlinePaymentsReview', () => {
    beforeEach(() => vi.clearAllMocks())

    it('shows nothing when there is nothing to place', async () => {
        getOnlinePayments.mockResolvedValue([])
        renderWithRouter(<OnlinePaymentsReview />)
        await waitFor(() => expect(getOnlinePayments).toHaveBeenCalledWith({ status: 'needs_review' }))
        expect(screen.queryByRole('region', { name: 'Online payments to place' })).not.toBeInTheDocument()
    })

    it('will not close one without saying what was done, then closes it and refreshes', async () => {
        getOnlinePayments.mockResolvedValueOnce([ROW]).mockResolvedValueOnce([])
        resolveOnlinePayment.mockResolvedValue({})
        renderWithRouter(<OnlinePaymentsReview />)

        const close = await screen.findByRole('button', { name: 'Close' })
        expect(close).toBeDisabled()
        fireEvent.change(screen.getByLabelText('What was done with the money: Amina Uwase'), { target: { value: 'Credited to next term' } })
        fireEvent.click(close)

        await waitFor(() => expect(resolveOnlinePayment).toHaveBeenCalledWith('o1', 'Credited to next term'))
        await waitFor(() => expect(screen.queryByRole('region', { name: 'Online payments to place' })).not.toBeInTheDocument())
    })
})
