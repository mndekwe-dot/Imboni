import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { AdminAnnouncements } from './AdminAnnouncements'
import {
  getAdminAnnouncements, createAdminAnnouncement,
  updateAdminAnnouncement, deleteAdminAnnouncement,
  getAdminAudienceOptions, getAnnouncementTemplates,
} from '../../api/admin'

vi.mock('../../api/admin', () => ({
  getAdminAnnouncements: vi.fn(),
  createAdminAnnouncement: vi.fn(),
  updateAdminAnnouncement: vi.fn(),
  deleteAdminAnnouncement: vi.fn(),
  getAdminAudienceOptions: vi.fn(),
  getAnnouncementTemplates: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const ANNOUNCEMENTS = [
  { id: 1, title: 'Term 2 Conference', content: 'Parent-teacher conference on March 20.', category: 'event', status: 'published', target_audience: 'all', created_at: '2026-01-01' },
  { id: 2, title: 'Draft notice', content: 'Not yet published.', category: 'general', status: 'draft', target_audience: 'all', created_at: '2026-01-02' },
]

describe('AdminAnnouncements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAdminAudienceOptions.mockResolvedValue(null)
    getAnnouncementTemplates.mockResolvedValue([])
  })

  it('shows a loading state before announcements resolve', () => {
    getAdminAnnouncements.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<AdminAnnouncements />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders the feed and stat counts once loaded', async () => {
    getAdminAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    renderWithRouter(<AdminAnnouncements />)

    await waitFor(() => expect(screen.getByText('Term 2 Conference')).toBeInTheDocument())
    expect(screen.getByText('Draft notice')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('shows the empty state when there are no announcements', async () => {
    getAdminAnnouncements.mockResolvedValue([])
    renderWithRouter(<AdminAnnouncements />)
    await waitFor(() => expect(screen.getByText('No announcements')).toBeInTheDocument())
  })

  it('filters the feed by search text', async () => {
    getAdminAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    renderWithRouter(<AdminAnnouncements />)
    await waitFor(() => expect(screen.getByText('Term 2 Conference')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('Search by title, content or category…'), { target: { value: 'Draft' } })

    expect(screen.queryByText('Term 2 Conference')).not.toBeInTheDocument()
    expect(screen.getByText('Draft notice')).toBeInTheDocument()
  })

  it('switching tabs re-fetches with the tab param', async () => {
    getAdminAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    renderWithRouter(<AdminAnnouncements />)
    await waitFor(() => expect(screen.getByText('Term 2 Conference')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Urgent' }))

    await waitFor(() => expect(getAdminAnnouncements).toHaveBeenCalledWith({ tab: 'urgent' }))
  })

  it('validates required fields before publishing a new announcement', async () => {
    getAdminAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    renderWithRouter(<AdminAnnouncements />)
    await waitFor(() => expect(screen.getByText('Term 2 Conference')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /New Announcement/ }))
    const formCard1 = screen.getByText('New Announcement').closest('.card')
    fireEvent.click(within(formCard1).getByRole('button', { name: /Publish/ }))

    expect(screen.getByText('Title is required.')).toBeInTheDocument()
    expect(createAdminAnnouncement).not.toHaveBeenCalled()
  })

  it('publishes a new announcement with the correct payload', async () => {
    getAdminAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    createAdminAnnouncement.mockResolvedValue({})
    renderWithRouter(<AdminAnnouncements />)
    await waitFor(() => expect(screen.getByText('Term 2 Conference')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /New Announcement/ }))
    fireEvent.change(screen.getByPlaceholderText('Announcement title'), { target: { value: 'Library hours' } })
    fireEvent.change(screen.getByPlaceholderText('Write your announcement here…'), { target: { value: 'Open until 7pm.' } })
    const formCard2 = screen.getByText('New Announcement').closest('.card')
    fireEvent.click(within(formCard2).getByRole('button', { name: /Publish/ }))

    await waitFor(() => expect(createAdminAnnouncement).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Library hours',
      content: 'Open until 7pm.',
      status: 'published',
    })))
  })

  it('saves a draft via Save Draft', async () => {
    getAdminAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    createAdminAnnouncement.mockResolvedValue({})
    renderWithRouter(<AdminAnnouncements />)
    await waitFor(() => expect(screen.getByText('Term 2 Conference')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /New Announcement/ }))
    fireEvent.change(screen.getByPlaceholderText('Announcement title'), { target: { value: 'Draft me' } })
    fireEvent.change(screen.getByPlaceholderText('Write your announcement here…'), { target: { value: 'Body text.' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }))

    await waitFor(() => expect(createAdminAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' })))
  })

  it('edits an existing announcement, pre-filling the form', async () => {
    getAdminAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    updateAdminAnnouncement.mockResolvedValue({})
    renderWithRouter(<AdminAnnouncements />)
    await waitFor(() => expect(screen.getByText('Term 2 Conference')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('Edit')[0])

    expect(screen.getByDisplayValue('Term 2 Conference')).toBeInTheDocument()
    // Scope to the edit form's own card — the draft card behind it has its
    // own unrelated "Publish" button with the same accessible name.
    const formCard = screen.getByText('Edit Announcement').closest('.card')
    fireEvent.click(within(formCard).getByRole('button', { name: /Publish/ }))

    await waitFor(() => expect(updateAdminAnnouncement).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Term 2 Conference' })))
  })

  it('publishes a draft directly from its card', async () => {
    getAdminAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    updateAdminAnnouncement.mockResolvedValue({})
    renderWithRouter(<AdminAnnouncements />)
    await waitFor(() => expect(screen.getByText('Draft notice')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Publish/ }))

    await waitFor(() => expect(updateAdminAnnouncement).toHaveBeenCalledWith(2, { status: 'published' }))
  })

  it('deletes an announcement after confirming', async () => {
    getAdminAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    deleteAdminAnnouncement.mockResolvedValue({})
    renderWithRouter(<AdminAnnouncements />)
    await waitFor(() => expect(screen.getByText('Term 2 Conference')).toBeInTheDocument())

    fireEvent.click(screen.getAllByTitle('Delete')[0])
    expect(screen.getByText('Delete Announcement?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }))

    await waitFor(() => expect(deleteAdminAnnouncement).toHaveBeenCalledWith(1))
  })
})
