import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { ExeatRequestPanel } from './ParentExeat'
import { getChildExeats, requestChildExeat } from '../../api/parent'

vi.mock('../../api/parent', () => ({ getChildExeats: vi.fn(), requestChildExeat: vi.fn() }))

const CHILD = { id: 'c1', student_name: 'Amina Uwase' }

describe('ExeatRequestPanel', () => {
    beforeEach(() => vi.clearAllMocks())

    it('lists earlier requests with their status', async () => {
        getChildExeats.mockResolvedValue([{
            id: 'x1', reason_type: 'medical', status: 'requested',
            departure_at: '2026-10-12T08:00:00Z', expected_return_at: '2026-10-12T16:00:00Z',
        }])
        renderWithRouter(<ExeatRequestPanel child={CHILD} />)
        expect(await screen.findByText('Medical / hospital')).toBeInTheDocument()
        expect(screen.getByText('Requested')).toBeInTheDocument()
    })

    it('sends a request with a reason and then refreshes the list', async () => {
        getChildExeats.mockResolvedValue([])
        requestChildExeat.mockResolvedValue({ id: 'x2' })
        renderWithRouter(<ExeatRequestPanel child={CHILD} />)

        fireEvent.click(await screen.findByRole('button', { name: 'Request leave' }))
        fireEvent.change(screen.getByLabelText('Why does Amina Uwase need to leave?'), { target: { value: 'Dentist' } })
        fireEvent.click(screen.getByRole('button', { name: 'Send request' }))

        await waitFor(() => expect(requestChildExeat).toHaveBeenCalledWith('c1', expect.objectContaining({ reason: 'Dentist', reason_type: 'weekend' })))
        await waitFor(() => expect(getChildExeats).toHaveBeenCalledTimes(2))
    })

    it('shows the server reason when the request is refused', async () => {
        getChildExeats.mockResolvedValue([])
        requestChildExeat.mockRejectedValue({ response: { data: { detail: 'Only boarders need an exeat pass.' } } })
        renderWithRouter(<ExeatRequestPanel child={CHILD} />)

        fireEvent.click(await screen.findByRole('button', { name: 'Request leave' }))
        fireEvent.change(screen.getByLabelText('Why does Amina Uwase need to leave?'), { target: { value: 'x' } })
        fireEvent.click(screen.getByRole('button', { name: 'Send request' }))

        expect(await screen.findByText('Only boarders need an exeat pass.')).toBeInTheDocument()
    })

    it('is absent in a school with no boarding', async () => {
        getChildExeats.mockRejectedValue({ response: { status: 404 } })
        renderWithRouter(<ExeatRequestPanel child={CHILD} />)
        await waitFor(() => expect(getChildExeats).toHaveBeenCalled())
        expect(screen.queryByRole('button', { name: 'Request leave' })).not.toBeInTheDocument()
    })
})
