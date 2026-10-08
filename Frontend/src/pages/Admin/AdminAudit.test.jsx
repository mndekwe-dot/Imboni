import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { AdminAudit } from './AdminAudit'
import { getAuditLog } from '../../api/audit'

vi.mock('../../api/audit', () => ({ getAuditLog: vi.fn() }))
vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn(),
}))
vi.mock('../../components/ui/DocumentActions', () => ({ DocumentActions: () => null }))

const ROW = (id, action = 'student.deleted') => ({
    id, when: '2026-10-09T08:30:00Z', actor_name: 'Grace Admin', actor_role: 'admin',
    action, target: 'Amina Uwase (ADM1)', detail: { amount: '40000', notes: 'Bursary' },
})

describe('AdminAudit', () => {
    beforeEach(() => vi.clearAllMocks())

    it('lists who did what, with the detail in words', async () => {
        getAuditLog.mockResolvedValue({ count: 1, results: [ROW('1')], actions: ['student.deleted'] })
        renderWithRouter(<AdminAudit />)

        expect(await screen.findByText('Amina Uwase (ADM1)')).toBeInTheDocument()
        expect(screen.getByText('Grace Admin')).toBeInTheDocument()
        expect(screen.getByText('amount: 40000 · notes: Bursary')).toBeInTheDocument()
        expect(screen.getByText('Showing 1 of 1')).toBeInTheDocument()
    })

    it('asks the server to narrow the list when a filter is set', async () => {
        getAuditLog.mockResolvedValue({ count: 1, results: [ROW('1')], actions: ['student.deleted', 'finance.waiver'] })
        renderWithRouter(<AdminAudit />)
        await screen.findByText('Amina Uwase (ADM1)')

        fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'finance.waiver' } })

        await waitFor(() => expect(getAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'finance.waiver' })))
    })

    it('loads the next page by offset and appends it', async () => {
        getAuditLog
            .mockResolvedValueOnce({ count: 2, results: [ROW('1')], actions: [] })
            .mockResolvedValueOnce({ count: 2, results: [ROW('2', 'finance.waiver')], actions: [] })
        renderWithRouter(<AdminAudit />)
        await screen.findByText('Showing 1 of 2')

        fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

        expect(await screen.findByText('Showing 2 of 2')).toBeInTheDocument()
        expect(getAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1 }))
        expect(screen.getByText('finance.waiver')).toBeInTheDocument()
    })

    it('says so when nothing matches', async () => {
        getAuditLog.mockResolvedValue({ count: 0, results: [], actions: [] })
        renderWithRouter(<AdminAudit />)
        expect(await screen.findByText('No entries match.')).toBeInTheDocument()
    })

    it('tells the admin when the log cannot be loaded', async () => {
        getAuditLog.mockRejectedValue({ response: { data: { detail: 'Not today.' } } })
        renderWithRouter(<AdminAudit />)
        expect(await screen.findByText('Not today.')).toBeInTheDocument()
    })
})
