import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
import { StudentAnnouncements } from './StudentAnnouncements'
import { getStudentAnnouncements, getAnnouncementStats } from '../../api/student'

vi.mock('../../api/student', () => ({
    getStudentAnnouncements: vi.fn(),
    getAnnouncementStats: vi.fn(),
}))

const ANNOUNCEMENTS = [
    { id: 1, category: 'urgent', title: 'Exam moved', content: 'Physics exam moved to Mar 14', author: 'Ms. Uwera', published_at: '2026-03-08' },
    { id: 2, category: 'academic', title: 'Revision sessions', content: 'Extra revision this week', author: 'Mr. Rurangwa', published_at: '2026-03-06' },
    { id: 3, category: 'event', title: 'Science Competition', content: 'Registration open', author: 'Dr. N', published_at: '2026-03-05' },
    { id: 4, category: 'general', title: 'Library hours', content: 'Extended hours', author: 'Admin', published_at: '2026-02-28' },
]

const STATS = { unread: 2 }

beforeEach(() => {
    vi.clearAllMocks()
})

describe('StudentAnnouncements', () => {
    it('shows loading state while fetching', () => {
        getStudentAnnouncements.mockReturnValue(new Promise(() => {}))
        getAnnouncementStats.mockReturnValue(new Promise(() => {}))

        renderWithRouter(<StudentAnnouncements />)

        expect(screen.getByText('Loading announcements…')).toBeInTheDocument()
    })

    it('renders announcements and stat cards once loaded', async () => {
        getStudentAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
        getAnnouncementStats.mockResolvedValue(STATS)

        renderWithRouter(<StudentAnnouncements />)

        await waitFor(() => expect(screen.getByText('Exam moved')).toBeInTheDocument())
        expect(screen.getByText('Revision sessions')).toBeInTheDocument()
        expect(screen.getByText('Science Competition')).toBeInTheDocument()
        expect(screen.getByText('Library hours')).toBeInTheDocument()
        // 2 unread from stats
        expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('shows an error-safe empty state when the api calls fail', async () => {
        getStudentAnnouncements.mockRejectedValue(new Error('Network down'))
        getAnnouncementStats.mockRejectedValue(new Error('Network down'))

        renderWithRouter(<StudentAnnouncements />)

        await waitFor(() => expect(screen.getByText('No announcements found.')).toBeInTheDocument())
    })

    it('filters by chip category', async () => {
        getStudentAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
        getAnnouncementStats.mockResolvedValue(STATS)

        renderWithRouter(<StudentAnnouncements />)
        await waitFor(() => expect(screen.getByText('Exam moved')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Urgent' }))

        expect(screen.getByText('Exam moved')).toBeInTheDocument()
        expect(screen.queryByText('Revision sessions')).not.toBeInTheDocument()
        expect(screen.queryByText('Science Competition')).not.toBeInTheDocument()
    })

    it('shows no announcements found when the filtered list is empty', async () => {
        getStudentAnnouncements.mockResolvedValue([])
        getAnnouncementStats.mockResolvedValue({ unread: 0 })

        renderWithRouter(<StudentAnnouncements />)

        await waitFor(() => expect(screen.getByText('No announcements found.')).toBeInTheDocument())
    })
})
