import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { ParentAnnouncements } from './ParentAnnouncements'
import {
  getPublishedAnnouncements, getAnnouncementStats,
  markAnnouncementRead, markAllAnnouncementsRead,
} from '../../api/parent'

vi.mock('../../api/parent', () => ({
  getPublishedAnnouncements: vi.fn(),
  getAnnouncementStats: vi.fn(),
  markAnnouncementRead: vi.fn(),
  markAllAnnouncementsRead: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const ANNOUNCEMENTS = [
  { id: 1, title: 'Exam Notice', content: 'Exams start Monday.', category: 'urgent', is_read: false, target_audience: 'all', published_at: '2026-06-01' },
  { id: 2, title: 'Library Hours', content: 'Open until 7pm.', category: 'general', is_read: true, target_audience: 'all', published_at: '2026-05-01' },
]

describe('ParentAnnouncements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAnnouncementStats.mockResolvedValue(null)
  })

  it('shows a loading state before announcements resolve', () => {
    getPublishedAnnouncements.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<ParentAnnouncements />)
    expect(screen.getByText('Loading announcements…')).toBeInTheDocument()
  })

  it('renders announcements and stat counts once loaded', async () => {
    getPublishedAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    renderWithRouter(<ParentAnnouncements />)

    await waitFor(() => expect(screen.getByText('Exam Notice')).toBeInTheDocument())
    expect(screen.getByText('Library Hours')).toBeInTheDocument()
    expect(screen.getByText('Mark as read')).toBeInTheDocument()
  })

  it('shows the empty state for a category with no matches', async () => {
    getPublishedAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    renderWithRouter(<ParentAnnouncements />)
    await waitFor(() => expect(screen.getByText('Exam Notice')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Events0/ }))
    expect(screen.getByText('No announcements in this category.')).toBeInTheDocument()
  })

  it('filters by category chip', async () => {
    getPublishedAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    renderWithRouter(<ParentAnnouncements />)
    await waitFor(() => expect(screen.getByText('Exam Notice')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Urgent/ }))
    expect(screen.queryByText('Library Hours')).not.toBeInTheDocument()
    expect(screen.getByText('Exam Notice')).toBeInTheDocument()
  })

  it('marks a single announcement as read', async () => {
    getPublishedAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    markAnnouncementRead.mockResolvedValue({})
    renderWithRouter(<ParentAnnouncements />)
    await waitFor(() => expect(screen.getByText('Exam Notice')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Mark as read'))

    expect(markAnnouncementRead).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByText('Mark as read')).not.toBeInTheDocument())
  })

  it('marks all announcements as read', async () => {
    getPublishedAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    markAllAnnouncementsRead.mockResolvedValue({})
    renderWithRouter(<ParentAnnouncements />)
    await waitFor(() => expect(screen.getByText('Mark all as read')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Mark all as read'))

    await waitFor(() => expect(markAllAnnouncementsRead).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('Mark as read')).not.toBeInTheDocument())
    expect(screen.queryByText('Mark all as read')).not.toBeInTheDocument()
  })
})
