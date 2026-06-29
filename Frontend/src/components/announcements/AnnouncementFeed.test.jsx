import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AnnouncementFeed } from './AnnouncementFeed'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

const ANNOUNCEMENTS = [
  { id: 1, type: 'urgent', title: 'Exam Moved', date: 'Mar 8', body: 'Exam details.', author: 'Ms. Uwera', isUnread: true },
  { id: 2, type: 'school', title: 'Library Hours', date: 'Mar 5', body: 'Open late.', author: 'Admin', isUnread: false },
]

function renderFeed(props = {}) {
  return render(
    <MemoryRouter>
      <AnnouncementFeed
        navItems={[]}
        secondaryItems={[]}
        announcements={ANNOUNCEMENTS}
        chips={['All', 'Urgent', 'School']}
        {...props}
      />
    </MemoryRouter>
  )
}

describe('AnnouncementFeed', () => {
  it('renders all announcements by default with the unread count', () => {
    renderFeed()
    expect(screen.getByText('Exam Moved')).toBeInTheDocument()
    expect(screen.getByText('Library Hours')).toBeInTheDocument()
    expect(screen.getByText('1 unread')).toBeInTheDocument()
  })

  it('filters by chip', () => {
    renderFeed()
    fireEvent.click(screen.getByRole('button', { name: 'Urgent' }))
    expect(screen.getByText('Exam Moved')).toBeInTheDocument()
    expect(screen.queryByText('Library Hours')).not.toBeInTheDocument()
  })

  it('filters by search text', () => {
    renderFeed()
    fireEvent.change(screen.getByPlaceholderText('Search announcements...'), { target: { value: 'Library' } })
    expect(screen.queryByText('Exam Moved')).not.toBeInTheDocument()
    expect(screen.getByText('Library Hours')).toBeInTheDocument()
  })

  it('shows the empty state with a clear-search action when search matches nothing', () => {
    renderFeed()
    fireEvent.change(screen.getByPlaceholderText('Search announcements...'), { target: { value: 'nonexistent-xyz' } })
    expect(screen.getByText(/No results for/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Clear Search'))
    expect(screen.getByText('Exam Moved')).toBeInTheDocument()
  })

  it('opens the detail modal when an announcement is clicked', () => {
    renderFeed()
    fireEvent.click(screen.getByText('Exam Moved'))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Exam details.')).toBeInTheDocument()
    expect(within(dialog).getByText('Ms. Uwera')).toBeInTheDocument()
  })

  it('does not show the compose button unless canCompose is true', () => {
    renderFeed()
    expect(screen.queryByText('New Announcement')).not.toBeInTheDocument()
  })

  it('composes and publishes a new announcement when canCompose is true', () => {
    renderFeed({ canCompose: true, authorName: 'Dr. Ndagijimana' })

    fireEvent.click(screen.getByRole('button', { name: /New Announcement/ }))
    expect(screen.getByText('* Title and body are required')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/School closed/), { target: { value: 'New Notice' } })
    fireEvent.change(screen.getByPlaceholderText('Write the full announcement here…'), { target: { value: 'Body text.' } })
    fireEvent.click(screen.getByRole('button', { name: /Publish/ }))

    expect(screen.getByText('New Notice')).toBeInTheDocument()
  })

  it('saves a draft without publishing it as unread-active', () => {
    renderFeed({ canCompose: true })
    fireEvent.click(screen.getByRole('button', { name: /New Announcement/ }))
    fireEvent.change(screen.getByPlaceholderText(/School closed/), { target: { value: 'Draft Notice' } })
    fireEvent.change(screen.getByPlaceholderText('Write the full announcement here…'), { target: { value: 'Draft body.' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }))

    expect(screen.getByText('Draft Notice')).toBeInTheDocument()
  })
})
