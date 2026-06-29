import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within, setSessionUser } from '../../test/test-utils'
import { DosAnnouncement } from './DosAnnouncement'
import {
  getDosAnnouncements, createDosAnnouncement,
  updateDosAnnouncement, deleteDosAnnouncement, getSchoolConfig,
} from '../../api/dos'

vi.mock('../../api/dos', () => ({
  getDosAnnouncements: vi.fn(),
  createDosAnnouncement: vi.fn(),
  updateDosAnnouncement: vi.fn(),
  deleteDosAnnouncement: vi.fn(),
  getSchoolConfig: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const ANN_PUBLISHED = {
  id: 1, title: 'Term 2 Exams', content: 'Exams start next week.',
  category: 'academic', status: 'published', target_audience: 'all',
  target_grade: '', author: 'Dr Ndagijimana', created_at: '2026-06-01T10:00:00Z', published_at: '2026-06-01T10:00:00Z',
}

const ANN_DRAFT = {
  id: 2, title: 'Sports Day', content: 'Planning in progress.',
  category: 'event', status: 'draft', target_audience: 'students',
  target_grade: '', author: 'Dr Ndagijimana', updated_at: '2026-06-02T10:00:00Z',
}

function page(results, opts = {}) {
  return { total: opts.total ?? results.length, has_more: opts.has_more ?? false, results }
}

beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ first_name: 'Dr', last_name: 'Ndagijimana', role: 'dos' })
  getSchoolConfig.mockResolvedValue([])
})

describe('DosAnnouncement', () => {
  it('shows a loading state before announcements resolve', () => {
    getDosAnnouncements.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DosAnnouncement />)
    expect(screen.getByText('Loading announcements…')).toBeInTheDocument()
  })

  it('fetches the first page with limit/offset and renders the list', async () => {
    getDosAnnouncements.mockResolvedValue(page([ANN_PUBLISHED, ANN_DRAFT]))
    renderWithRouter(<DosAnnouncement />)

    await waitFor(() => expect(getDosAnnouncements).toHaveBeenCalledWith({ limit: 50, offset: 0 }))
    expect(screen.getByText('Term 2 Exams')).toBeInTheDocument()
    expect(screen.getByText('Sports Day')).toBeInTheDocument()
  })

  it('shows the empty state when there are no announcements', async () => {
    getDosAnnouncements.mockResolvedValue(page([]))
    renderWithRouter(<DosAnnouncement />)
    await waitFor(() => expect(screen.getByText('No announcements yet.')).toBeInTheDocument())
  })

  it('validates required fields before publishing', async () => {
    getDosAnnouncements.mockResolvedValue(page([]))
    renderWithRouter(<DosAnnouncement />)
    await waitFor(() => expect(screen.getByText('No announcements yet.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }))

    expect(screen.getByText('Title is required.')).toBeInTheDocument()
    expect(createDosAnnouncement).not.toHaveBeenCalled()
  })

  it('publishes a new announcement with the correct payload', async () => {
    getDosAnnouncements.mockResolvedValue(page([]))
    createDosAnnouncement.mockResolvedValue({})
    renderWithRouter(<DosAnnouncement />)
    await waitFor(() => expect(screen.getByText('No announcements yet.')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Announcement Title *'), { target: { value: 'New Notice' } })
    fireEvent.change(screen.getByLabelText('Announcement Content *'), { target: { value: 'Body text here.' } })
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }))

    await waitFor(() => expect(createDosAnnouncement).toHaveBeenCalledWith(expect.objectContaining({
      title: 'New Notice',
      content: 'Body text here.',
      status: 'published',
    })))
  })

  it('saves a draft via Save Draft', async () => {
    getDosAnnouncements.mockResolvedValue(page([]))
    createDosAnnouncement.mockResolvedValue({})
    renderWithRouter(<DosAnnouncement />)
    await waitFor(() => expect(screen.getByText('No announcements yet.')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Announcement Title *'), { target: { value: 'Draft notice' } })
    fireEvent.change(screen.getByLabelText('Announcement Content *'), { target: { value: 'Draft body.' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }))

    await waitFor(() => expect(createDosAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' })))
  })

  it('edits an existing announcement, pre-filling the form, and updates+publishes from the form scope', async () => {
    getDosAnnouncements.mockResolvedValue(page([ANN_DRAFT]))
    updateDosAnnouncement.mockResolvedValue({})
    renderWithRouter(<DosAnnouncement />)
    await waitFor(() => expect(screen.getByText('Sports Day')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Edit'))

    expect(screen.getByDisplayValue('Sports Day')).toBeInTheDocument()
    expect(screen.getByText('Edit Announcement')).toBeInTheDocument()

    // Scope the Publish click to the form's own card — the draft card behind
    // it also has its own "Publish" icon-button with the same accessible name.
    const formCard = screen.getByText('Edit Announcement').closest('.card')
    fireEvent.click(within(formCard).getByRole('button', { name: /Update & Publish/ }))

    await waitFor(() => expect(updateDosAnnouncement).toHaveBeenCalledWith(2, expect.objectContaining({
      title: 'Sports Day',
      status: 'published',
    })))
  })

  it('publishes a draft directly from its card icon-button', async () => {
    getDosAnnouncements.mockResolvedValue(page([ANN_DRAFT]))
    updateDosAnnouncement.mockResolvedValue({ ...ANN_DRAFT, status: 'published' })
    renderWithRouter(<DosAnnouncement />)
    await waitFor(() => expect(screen.getByText('Sports Day')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Publish'))

    await waitFor(() => expect(updateDosAnnouncement).toHaveBeenCalledWith(2, { status: 'published' }))
  })

  it('archives a published announcement from its card icon-button', async () => {
    getDosAnnouncements.mockResolvedValue(page([ANN_PUBLISHED]))
    updateDosAnnouncement.mockResolvedValue({ ...ANN_PUBLISHED, status: 'archived' })
    renderWithRouter(<DosAnnouncement />)
    await waitFor(() => expect(screen.getByText('Term 2 Exams')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Archive'))

    await waitFor(() => expect(updateDosAnnouncement).toHaveBeenCalledWith(1, { status: 'archived' }))
  })

  it('deletes an announcement after confirming', async () => {
    getDosAnnouncements.mockResolvedValue(page([ANN_PUBLISHED]))
    deleteDosAnnouncement.mockResolvedValue({})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWithRouter(<DosAnnouncement />)
    await waitFor(() => expect(screen.getByText('Term 2 Exams')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Delete'))

    await waitFor(() => expect(deleteDosAnnouncement).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByText('Term 2 Exams')).not.toBeInTheDocument())
  })

  it('does not delete when the confirm dialog is dismissed', async () => {
    getDosAnnouncements.mockResolvedValue(page([ANN_PUBLISHED]))
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderWithRouter(<DosAnnouncement />)
    await waitFor(() => expect(screen.getByText('Term 2 Exams')).toBeInTheDocument())

    fireEvent.click(screen.getByTitle('Delete'))

    expect(deleteDosAnnouncement).not.toHaveBeenCalled()
    expect(screen.getByText('Term 2 Exams')).toBeInTheDocument()
  })

  it('filter pills narrow the list client-side without refetching', async () => {
    getDosAnnouncements.mockResolvedValue(page([ANN_PUBLISHED, ANN_DRAFT]))
    renderWithRouter(<DosAnnouncement />)
    await waitFor(() => expect(screen.getByText('Term 2 Exams')).toBeInTheDocument())

    expect(getDosAnnouncements).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /^Draft/ }))

    expect(screen.queryByText('Term 2 Exams')).not.toBeInTheDocument()
    expect(screen.getByText('Sports Day')).toBeInTheDocument()
    // Still only the one initial fetch — filtering happens in-memory.
    expect(getDosAnnouncements).toHaveBeenCalledTimes(1)
  })

  it('shows the "no year groups found" message when grade_specific is selected and config has no years', async () => {
    getDosAnnouncements.mockResolvedValue(page([]))
    getSchoolConfig.mockResolvedValue([])
    renderWithRouter(<DosAnnouncement />)
    await waitFor(() => expect(screen.getByText('No announcements yet.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('radio', { name: /filter_list Specific Year/ }))

    expect(screen.getByText(/No year groups found\./)).toBeInTheDocument()
  })
})
