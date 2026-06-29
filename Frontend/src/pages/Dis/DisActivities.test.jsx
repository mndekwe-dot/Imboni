import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
import { DisActivities } from './DisActivities'
import { getDisActivities, createDisActivity } from '../../api/discipline'
import { getNotifications } from '../../api/notifications'

vi.mock('../../api/discipline', () => ({
    getDisActivities: vi.fn(),
    createDisActivity: vi.fn(),
}))
vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
}))

const activity = {
    id: 1, name: 'Chess Club', category: 'academic', teacher_name: 'Mr. Karenzi',
    schedule: 'Tue 4pm', venue: 'Room 12', enrolled_count: 10, max_members: 20,
    is_full: false, is_active: true,
}

describe('DisActivities', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getNotifications.mockResolvedValue([])
    })

    it('shows loading state before data resolves', () => {
        getDisActivities.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<DisActivities />)
        expect(screen.getByText(/Loading activities/i)).toBeInTheDocument()
    })

    it('renders activities once loaded', async () => {
        getDisActivities.mockResolvedValue([activity])
        renderWithRouter(<DisActivities />)
        await waitFor(() => expect(screen.getByText('Chess Club')).toBeInTheDocument())
        expect(screen.getByText(/Patron: Mr. Karenzi/)).toBeInTheDocument()
        expect(screen.getByText(/10 enrolled/)).toBeInTheDocument()
    })

    it('shows empty state when no activities match filter', async () => {
        getDisActivities.mockResolvedValue([])
        renderWithRouter(<DisActivities />)
        await waitFor(() => expect(screen.getByText(/No.*activities found/i)).toBeInTheDocument())
    })

    it('creates a new activity via the modal and shows it in the list', async () => {
        getDisActivities.mockResolvedValue([])
        createDisActivity.mockResolvedValue({ id: 2, name: 'Drama Club', category: 'arts', enrolled_count: 0, max_members: 15, is_active: true })
        renderWithRouter(<DisActivities />)
        await waitFor(() => expect(screen.getByText(/No.*activities found/i)).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /New Club/i }))
        fireEvent.change(screen.getByPlaceholderText('e.g. Science Club'), { target: { value: 'Drama Club' } })
        fireEvent.click(screen.getByRole('button', { name: /Create Club/i }))

        await waitFor(() => expect(createDisActivity).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Drama Club' })
        ))
        await waitFor(() => expect(screen.getByText('Drama Club')).toBeInTheDocument())
    })
})
