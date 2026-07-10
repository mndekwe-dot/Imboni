import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { TeacherAnnouncement } from './TeacherAnnouncement'
import {
    getTeacherAnnouncements, createTeacherAnnouncement,
    updateTeacherAnnouncement, deleteTeacherAnnouncement,
    getTeacherAudienceOptions,
} from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
    getTeacherAnnouncements: vi.fn(),
    createTeacherAnnouncement: vi.fn(),
    updateTeacherAnnouncement: vi.fn(),
    deleteTeacherAnnouncement: vi.fn(),
    getTeacherAudienceOptions: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn(),
}))

const ANNOUNCEMENTS = [
    { id: 1, title: 'Homework Due', content: 'Submit by Friday.', category: 'academic', status: 'published', target_audience: 'all', published_at: '2026-06-01T10:00:00Z' },
    { id: 2, title: 'Draft Note', content: 'Not yet sent.', category: 'general', status: 'draft', created_at: '2026-06-02T10:00:00Z' },
]

const AUDIENCE_OPTS = [
    { target_audience: 'all', label: 'All Classes' },
    { target_grade: 'S4', label: 'S4' },
]

beforeEach(() => {
    vi.clearAllMocks()
    getTeacherAnnouncements.mockResolvedValue(ANNOUNCEMENTS)
    getTeacherAudienceOptions.mockResolvedValue(AUDIENCE_OPTS)
})

describe('TeacherAnnouncement', () => {
    it('shows a loading state before announcements resolve', () => {
        getTeacherAnnouncements.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<TeacherAnnouncement />)
        expect(screen.getByText('Loading announcements…')).toBeInTheDocument()
    })

    it('renders announcements once loaded', async () => {
        renderWithRouter(<TeacherAnnouncement />)
        await waitFor(() => expect(screen.getByText('Homework Due')).toBeInTheDocument())
        expect(screen.getByText('Draft Note')).toBeInTheDocument()
        expect(screen.getByText('Draft')).toBeInTheDocument()
    })

    it('shows the empty state when there are no announcements', async () => {
        getTeacherAnnouncements.mockResolvedValue([])
        renderWithRouter(<TeacherAnnouncement />)
        await waitFor(() => expect(screen.getByText('No announcements')).toBeInTheDocument())
    })

    it('filters announcements by chip', async () => {
        renderWithRouter(<TeacherAnnouncement />)
        await waitFor(() => expect(screen.getByText('Homework Due')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /^Drafts/ }))
        expect(screen.queryByText('Homework Due')).not.toBeInTheDocument()
        expect(screen.getByText('Draft Note')).toBeInTheDocument()
    })

    it('does not submit when required fields are missing', async () => {
        renderWithRouter(<TeacherAnnouncement />)
        await waitFor(() => expect(screen.getByText('Homework Due')).toBeInTheDocument())

        const publishButtons = screen.getAllByRole('button', { name: /Publish/ })
        expect(publishButtons.some(b => b.disabled)).toBe(true)
        expect(createTeacherAnnouncement).not.toHaveBeenCalled()
    })

    it('creates and publishes a new announcement with the correct payload', async () => {
        createTeacherAnnouncement.mockResolvedValue({
            id: 3, title: 'Exam Notice', content: 'Exams start Monday.', category: 'urgent', status: 'published', target_audience: 'all',
        })
        renderWithRouter(<TeacherAnnouncement />)
        await waitFor(() => expect(screen.getByText('Homework Due')).toBeInTheDocument())

        fireEvent.change(screen.getByLabelText('Category *'), { target: { value: 'urgent' } })
        fireEvent.change(screen.getByPlaceholderText('Announcement title…'), { target: { value: 'Exam Notice' } })
        fireEvent.change(screen.getByPlaceholderText('Write your announcement…'), { target: { value: 'Exams start Monday.' } })

        // The draft card behind the form has its own "Publish now" button with
        // the same accessible name — the form's submit button has no title attr.
        const formPublish = screen.getAllByRole('button', { name: /Publish/ }).find(b => !b.title)
        fireEvent.click(formPublish)

        await waitFor(() => expect(createTeacherAnnouncement).toHaveBeenCalledWith({
            title: 'Exam Notice',
            content: 'Exams start Monday.',
            category: 'urgent',
            target_audience: 'all',
            target_grade: '',
            status: 'published',
        }))
        await waitFor(() => expect(screen.getByText('Published!')).toBeInTheDocument())
    })

    it('saves a new announcement as a draft', async () => {
        createTeacherAnnouncement.mockResolvedValue({
            id: 4, title: 'Draft Title', content: 'Draft content here.', category: 'general', status: 'draft', target_audience: 'all',
        })
        renderWithRouter(<TeacherAnnouncement />)
        await waitFor(() => expect(screen.getByText('Homework Due')).toBeInTheDocument())

        fireEvent.change(screen.getByLabelText('Category *'), { target: { value: 'general' } })
        fireEvent.change(screen.getByPlaceholderText('Announcement title…'), { target: { value: 'Draft Title' } })
        fireEvent.change(screen.getByPlaceholderText('Write your announcement…'), { target: { value: 'Draft content here.' } })

        fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }))

        await waitFor(() => expect(createTeacherAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' })))
    })

    it('populates the form for editing and saves changes', async () => {
        updateTeacherAnnouncement.mockResolvedValue({ ...ANNOUNCEMENTS[0], title: 'Homework Due Updated' })
        renderWithRouter(<TeacherAnnouncement />)
        await waitFor(() => expect(screen.getByText('Homework Due')).toBeInTheDocument())

        const card = screen.getByText('Homework Due').closest('.ann-item')
        fireEvent.click(within(card).getByTitle('Edit'))

        expect(screen.getByText('Edit Announcement')).toBeInTheDocument()
        const titleInput = screen.getByPlaceholderText('Announcement title…')
        expect(titleInput.value).toBe('Homework Due')

        fireEvent.change(titleInput, { target: { value: 'Homework Due Updated' } })
        fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }))

        await waitFor(() => expect(updateTeacherAnnouncement).toHaveBeenCalledWith(1, expect.objectContaining({ title: 'Homework Due Updated' })))
    })

    it('publishes a draft announcement directly from its card', async () => {
        updateTeacherAnnouncement.mockResolvedValue({ ...ANNOUNCEMENTS[1], status: 'published' })
        renderWithRouter(<TeacherAnnouncement />)
        await waitFor(() => expect(screen.getByText('Draft Note')).toBeInTheDocument())

        // Disambiguate: the form's own "Publish" submit button is disabled (no required fields);
        // the draft card's Publish button is the only enabled one with that name initially.
        const publishButtons = screen.getAllByRole('button', { name: /Publish/i })
        const cardPublish = publishButtons.find(b => !b.disabled)
        fireEvent.click(cardPublish)

        await waitFor(() => expect(updateTeacherAnnouncement).toHaveBeenCalledWith(2, { status: 'published' }))
    })

    it('deletes an announcement after confirmation', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        deleteTeacherAnnouncement.mockResolvedValue({})
        renderWithRouter(<TeacherAnnouncement />)
        await waitFor(() => expect(screen.getByText('Homework Due')).toBeInTheDocument())

        const card = screen.getByText('Homework Due').closest('.ann-item')
        fireEvent.click(within(card).getByTitle('Delete'))

        await waitFor(() => expect(deleteTeacherAnnouncement).toHaveBeenCalledWith(1))
        await waitFor(() => expect(screen.queryByText('Homework Due')).not.toBeInTheDocument())
    })

    it('does not delete when confirmation is cancelled', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false)
        renderWithRouter(<TeacherAnnouncement />)
        await waitFor(() => expect(screen.getByText('Homework Due')).toBeInTheDocument())

        const card = screen.getByText('Homework Due').closest('.ann-item')
        fireEvent.click(within(card).getByTitle('Delete'))

        expect(deleteTeacherAnnouncement).not.toHaveBeenCalled()
    })

    it('fills the form from a quick template', async () => {
        renderWithRouter(<TeacherAnnouncement />)
        await waitFor(() => expect(screen.getByText('Homework Due')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Class Canceled' }))

        expect(screen.getByPlaceholderText('Announcement title…').value).toBe('Class Canceled')
    })
})
