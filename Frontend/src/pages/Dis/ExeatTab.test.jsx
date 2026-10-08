import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { ExeatTab } from './ExeatTab'
import { getExeats, actOnExeat } from '../../api/discipline'

vi.mock('../../api/discipline', () => ({
    getExeats: vi.fn(),
    createExeat: vi.fn(),
    actOnExeat: vi.fn(),
    searchDisStudents: vi.fn().mockResolvedValue([]),
}))

const pass = (over = {}) => ({
    id: 'p1', student: 's1', student_name: 'Amina Uwase', class_name: 'S4A', reason_type: 'medical', reason: 'Clinic visit',
    departure_at: '2026-10-09T08:00:00Z', expected_return_at: '2026-10-10T16:00:00Z', actual_return_at: null,
    status: 'requested', parent_approval: 'pending', parent_note: '', gate_verified_by_name: '', is_overdue: false, ...over,
})

describe('ExeatTab', () => {
    beforeEach(() => vi.clearAllMocks())

    it('offers only the next valid step for a pass', async () => {
        getExeats.mockResolvedValue([pass()])
        renderWithRouter(<ExeatTab />)

        expect(await screen.findByText('Amina Uwase')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Parent agreed' })).toBeInTheDocument()
        // Nothing can be approved or signed out before the parent has agreed.
        expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Sign out at gate' })).not.toBeInTheDocument()
    })

    it('records the parent, then lets the pass be approved', async () => {
        getExeats.mockResolvedValue([pass()])
        actOnExeat.mockResolvedValue(pass({ parent_approval: 'approved' }))
        renderWithRouter(<ExeatTab />)

        fireEvent.click(await screen.findByRole('button', { name: 'Parent agreed' }))

        await waitFor(() => expect(actOnExeat).toHaveBeenCalledWith('p1', { action: 'parent_approved' }))
        expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument()
    })

    it('shows an overdue banner for a student who is out past their return time', async () => {
        getExeats.mockResolvedValue([pass({ status: 'out', is_overdue: true, parent_approval: 'approved' })])
        renderWithRouter(<ExeatTab />)

        expect(await screen.findByRole('alert')).toHaveTextContent('1 overdue')
        expect(screen.getByRole('button', { name: /^Overdue/ })).toBeInTheDocument()
    })

    it('says so when the server refuses a step', async () => {
        getExeats.mockResolvedValue([pass({ parent_approval: 'approved' })])
        actOnExeat.mockRejectedValue({ response: { data: { detail: 'Only a requested pass can be approved.' } } })
        renderWithRouter(<ExeatTab />)

        fireEvent.click(await screen.findByRole('button', { name: 'Approve' }))

        expect(await screen.findByText('Only a requested pass can be approved.')).toBeInTheDocument()
    })
})
