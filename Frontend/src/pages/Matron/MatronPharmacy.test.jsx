import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { MatronPharmacy } from './MatronPharmacy'
import { getPharmacy, addPharmacyItem, movePharmacyStock, getPharmacyHistory } from '../../api/matron'

vi.mock('../../api/matron', () => ({
    getPharmacy: vi.fn(), addPharmacyItem: vi.fn(), movePharmacyStock: vi.fn(), getPharmacyHistory: vi.fn(),
}))
vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn(),
}))

const ITEMS = [
    { id: 'i1', name: 'ORS', unit: 'sachets', quantity: 0, reorder_level: 10, expiry_date: null, status: 'out' },
    { id: 'i2', name: 'Paracetamol', unit: 'tablets', quantity: 200, reorder_level: 50, expiry_date: '2030-01-01', status: 'ok' },
]

describe('MatronPharmacy', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getPharmacy.mockResolvedValue(ITEMS)
        getPharmacyHistory.mockResolvedValue([])
    })

    it('shows each item with its status and counts what needs attention', async () => {
        renderWithRouter(<MatronPharmacy />)
        expect(await screen.findByText('ORS')).toBeInTheDocument()
        expect(screen.getByText('Out of stock')).toBeInTheDocument()
        expect(screen.getByText('In stock')).toBeInTheDocument()
        expect(screen.getByText('Low or out').closest('.portal-stat-body')).toHaveTextContent('1')
    })

    it('records stock coming in with a reason and refreshes', async () => {
        movePharmacyStock.mockResolvedValue({})
        renderWithRouter(<MatronPharmacy />)
        fireEvent.click((await screen.findAllByRole('button', { name: 'Change stock' }))[0])
        fireEvent.change(screen.getByLabelText(/How many/), { target: { value: '30' } })
        fireEvent.click(screen.getByRole('button', { name: 'Update stock' }))

        await waitFor(() => expect(movePharmacyStock).toHaveBeenCalledWith('i1', { reason: 'received', change: '30', note: '' }))
        await waitFor(() => expect(getPharmacy).toHaveBeenCalledTimes(2))
    })

    it('shows why the server refused a movement', async () => {
        movePharmacyStock.mockRejectedValue({ response: { data: { detail: 'Only 0 sachets of ORS in stock.' } } })
        renderWithRouter(<MatronPharmacy />)
        fireEvent.click((await screen.findAllByRole('button', { name: 'Change stock' }))[0])
        fireEvent.change(screen.getByLabelText(/How many/), { target: { value: '5' } })
        fireEvent.click(screen.getByRole('button', { name: 'Update stock' }))
        expect(await screen.findByText('Only 0 sachets of ORS in stock.')).toBeInTheDocument()
    })

    it('adds an item with opening stock', async () => {
        addPharmacyItem.mockResolvedValue({})
        renderWithRouter(<MatronPharmacy />)
        fireEvent.click(await screen.findByRole('button', { name: 'Add an item' }))
        fireEvent.change(screen.getByLabelText('Item'), { target: { value: 'Bandages' } })
        fireEvent.change(screen.getByLabelText('In stock'), { target: { value: '12' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save item' }))
        await waitFor(() => expect(addPharmacyItem).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bandages', quantity: '12', expiry_date: null })))
    })

    it('invites the first item when the cupboard is empty', async () => {
        getPharmacy.mockResolvedValue([])
        renderWithRouter(<MatronPharmacy />)
        expect(await screen.findByText('Nothing in the cupboard yet.')).toBeInTheDocument()
    })
})
