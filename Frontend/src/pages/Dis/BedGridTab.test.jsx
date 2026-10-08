import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen } from '../../test/test-utils'
import { BedGridTab } from './BedGridTab'
import { getBedLayout } from '../../api/discipline'

vi.mock('../../api/discipline', () => ({ getBedLayout: vi.fn() }))

const LAYOUT = [{
    id: 'd1', name: 'Kivu', gender: 'male', occupied: 2, capacity: 3,
    rooms: [
        { room_number: '1', closed: false, capacity: 3, free: 2, overflow: [],
          beds: [{ bed: 1, occupant: null }, { bed: 2, occupant: 'Amina Uwase' }, { bed: 3, occupant: null }] },
        { room_number: '2', closed: true, capacity: 1, free: 0, overflow: [], beds: [{ bed: 1, occupant: null }] },
        { room_number: '3', closed: false, capacity: 1, free: 0, overflow: ['Eric Habimana'], beds: [{ bed: 1, occupant: 'Joy K' }] },
    ],
}]

describe('BedGridTab', () => {
    beforeEach(() => vi.clearAllMocks())

    it('shows each bed as taken, free or closed, per room', async () => {
        getBedLayout.mockResolvedValue(LAYOUT)
        renderWithRouter(<BedGridTab />)

        expect(await screen.findByText('Kivu')).toBeInTheDocument()
        expect(screen.getByText('2 of 3 beds taken')).toBeInTheDocument()
        expect(screen.getByLabelText('Bed 2: Amina Uwase')).toHaveClass('taken')
        expect(screen.getByLabelText('Bed 1: free')).toHaveClass('free')
        expect(screen.getByText('Closed')).toBeInTheDocument()
    })

    it('does not hide a boarder who has no bed in an over-full room', async () => {
        getBedLayout.mockResolvedValue(LAYOUT)
        renderWithRouter(<BedGridTab />)
        expect(await screen.findByText('No bed for: Eric Habimana')).toBeInTheDocument()
    })

    it('says so when the floor plan cannot be loaded', async () => {
        getBedLayout.mockRejectedValue({ response: { data: { detail: 'Nope.' } } })
        renderWithRouter(<BedGridTab />)
        expect(await screen.findByText('Nope.')).toBeInTheDocument()
    })
})
