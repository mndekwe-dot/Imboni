import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
import { DisAnnouncements } from './DisAnnouncements'
import {
    getDisAnnouncements, createDisAnnouncement,
    updateDisAnnouncement, deleteDisAnnouncement,
} from '../../api/discipline'
import { getNotifications } from '../../api/notifications'

vi.mock('../../api/discipline', () => ({
    getDisAnnouncements: vi.fn(),
    createDisAnnouncement: vi.fn(),
    updateDisAnnouncement: vi.fn(),
    deleteDisAnnouncement: vi.fn(),
}))
vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
}))

const ann = {
    id: 1, title: 'Curfew Reminder', content: 'All boarders must be in by 9pm.',
    category: 'urgent', target_audience: 'students', status: 'published',
    published_at: new Date().toISOString(), created_at: new Date().toISOString(),
}

describe('DisAnnouncements', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getNotifications.mockResolvedValue([])
    })

    it('shows loading state', () => {
        getDisAnnouncements.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<DisAnnouncements />)
        expect(screen.getByText(/Loading announcements/i)).toBeInTheDocument()
    })

    it('renders fetched announcements', async () => {
        getDisAnnouncements.mockResolvedValue({ results: [ann], total: 1, has_more: false })
        renderWithRouter(<DisAnnouncements />)
        await waitFor(() => expect(screen.getByText('Curfew Reminder')).toBeInTheDocument())
        expect(screen.getByText(/All boarders must be in by 9pm/)).toBeInTheDocument()
    })

    it('shows empty state when there are none', async () => {
        getDisAnnouncements.mockResolvedValue({ results: [], total: 0, has_more: false })
        renderWithRouter(<DisAnnouncements />)
        await waitFor(() => expect(screen.getByText(/No.*announcements yet/i)).toBeInTheDocument())
    })

    it('publishes a new announcement with correct payload', async () => {
        getDisAnnouncements.mockResolvedValue({ results: [], total: 0, has_more: false })
        createDisAnnouncement.mockResolvedValue({ ...ann, id: 2 })
        renderWithRouter(<DisAnnouncements />)
        await waitFor(() => expect(screen.getByText(/No.*announcements yet/i)).toBeInTheDocument())

        fireEvent.change(screen.getByPlaceholderText(/Curfew Reminder/i), { target: { value: 'New Notice' } })
        fireEvent.change(screen.getByPlaceholderText(/Type the full announcement/i), { target: { value: 'Body text here' } })
        fireEvent.click(screen.getByRole('button', { name: /Publish Now/i }))

        await waitFor(() => expect(createDisAnnouncement).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'New Notice', content: 'Body text here', status: 'published' })
        ))
    })

    it('deletes an announcement after confirmation', async () => {
        getDisAnnouncements.mockResolvedValue({ results: [ann], total: 1, has_more: false })
        deleteDisAnnouncement.mockResolvedValue({})
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        renderWithRouter(<DisAnnouncements />)
        await waitFor(() => expect(screen.getByText('Curfew Reminder')).toBeInTheDocument())

        fireEvent.click(screen.getByTitle('Delete'))
        await waitFor(() => expect(deleteDisAnnouncement).toHaveBeenCalledWith(1))
        await waitFor(() => expect(screen.queryByText('Curfew Reminder')).not.toBeInTheDocument())
    })
})
