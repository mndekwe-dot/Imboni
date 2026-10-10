import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { RemindersModal } from './FinanceReminders'
import { sendFeeReminders, getAutoReminders, updateAutoReminders } from '../../api/finance'

vi.mock('../../api/finance', () => ({
    sendFeeReminders: vi.fn(),
    getAutoReminders: vi.fn(),
    updateAutoReminders: vi.fn(),
}))

describe('RemindersModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getAutoReminders.mockResolvedValue({ enabled: false, min_percent: 50, every_days: 14, last_sent: null })
    })

    it('cannot send until it has previewed, and sends exactly what was previewed', async () => {
        sendFeeReminders.mockResolvedValueOnce({ families: 3, total: '240000', sample: 'Fees reminder: Amina owes 80,000', sent: 0 })
        sendFeeReminders.mockResolvedValueOnce({ families: 3, sent: 5, reached: 3, unreachable: 0 })
        const onClose = vi.fn()
        renderWithRouter(<RemindersModal params={{ grade: 'S3' }} onClose={onClose} />)

        expect(screen.getByRole('button', { name: /^Send to 0$/ })).toBeDisabled()

        fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
        expect(await screen.findByText('Fees reminder: Amina owes 80,000')).toBeInTheDocument()
        expect(sendFeeReminders).toHaveBeenLastCalledWith(expect.objectContaining({ dry_run: true, grade: 'S3', min_percent: '50' }))

        fireEvent.click(screen.getByRole('button', { name: 'Send to 3' }))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(sendFeeReminders).toHaveBeenLastCalledWith(expect.objectContaining({ dry_run: false }))
    })

    it('clears the preview when a threshold changes, so a stale count is never sent', async () => {
        sendFeeReminders.mockResolvedValue({ families: 3, total: '240000', sample: 'Hello', sent: 0 })
        renderWithRouter(<RemindersModal params={{}} onClose={() => {}} />)

        fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
        await screen.findByText('Hello')
        fireEvent.change(screen.getByLabelText('Owing at least this % of the bill'), { target: { value: '80' } })

        expect(screen.queryByText('Hello')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /^Send to 0$/ })).toBeDisabled()
    })

    it('says so when nobody matches', async () => {
        sendFeeReminders.mockResolvedValue({ families: 0, total: '0', sample: '', sent: 0 })
        renderWithRouter(<RemindersModal params={{}} onClose={() => {}} />)
        fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
        expect(await screen.findByText('No family matches these thresholds.')).toBeInTheDocument()
    })
})

describe('RemindersModal: automatic reminders', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getAutoReminders.mockResolvedValue({ enabled: false, min_percent: 50, every_days: 14, last_sent: null })
    })

    it('is off until the bursar turns it on, and saves the moment it is switched', async () => {
        updateAutoReminders.mockResolvedValue({ enabled: true, min_percent: 50, every_days: 14, last_sent: null })
        renderWithRouter(<RemindersModal params={{}} onClose={() => {}} />)

        const box = await screen.findByRole('checkbox', { name: 'Remind families automatically' })
        expect(box).not.toBeChecked()
        fireEvent.click(box)

        await waitFor(() => expect(updateAutoReminders).toHaveBeenCalledWith({ enabled: true }))
        expect(await screen.findByText('Not sent yet')).toBeInTheDocument()
    })

    it('puts the switch back and says why when the save fails', async () => {
        updateAutoReminders.mockRejectedValue(new Error('server said no'))
        renderWithRouter(<RemindersModal params={{}} onClose={() => {}} />)

        const box = await screen.findByRole('checkbox', { name: 'Remind families automatically' })
        fireEvent.click(box)

        await waitFor(() => expect(box).not.toBeChecked())
        expect(await screen.findByText(/server said no|Could not update automatic reminders/)).toBeInTheDocument()
    })
})
