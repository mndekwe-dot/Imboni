import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { MessagesPage } from './MessagesPage'

const CONVERSATIONS = [
  { initials: 'CU', name: 'Ms. C. Umutoni', typeTag: 'Teacher', time: '10:22 AM', preview: 'Hello' },
  { initials: 'EM', name: 'Mr. E. Mutabazi', typeTag: 'Discipline', time: 'Yesterday', preview: 'Resolved' },
]

const MESSAGES = [
  { type: 'received', text: 'Hi there', time: '10:00 AM', senderInitials: 'CU' },
  { type: 'sent', text: 'Hello back', time: '10:05 AM' },
]

function renderPage(props = {}) {
  return render(
    <MemoryRouter>
      <MessagesPage
        navItems={[]}
        secondaryItems={[]}
        conversations={CONVERSATIONS}
        tabs={['All', 'Unread']}
        messages={MESSAGES}
        activeContact={{ initials: 'CU', name: 'Ms. C. Umutoni', typeTag: 'Teacher', isOnline: true }}
        composerPlaceholder="Type a message…"
        {...props}
      />
    </MemoryRouter>
  )
}

describe('MessagesPage', () => {
  it('renders the conversation list and active thread', () => {
    renderPage()
    expect(screen.getAllByText('Ms. C. Umutoni').length).toBeGreaterThan(0)
    expect(screen.getByText('Mr. E. Mutabazi')).toBeInTheDocument()
    expect(screen.getByText('Hi there')).toBeInTheDocument()
    expect(screen.getByText('Hello back')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type a message…')).toBeInTheDocument()
  })

  it('switches filter tabs', () => {
    renderPage()
    const unreadTab = screen.getByRole('button', { name: 'Unread' })
    fireEvent.click(unreadTab)
    expect(unreadTab).toHaveClass('active')
  })

  it('opens the thread (mobile view) when a conversation is clicked, and back returns to the list', () => {
    const { container } = renderPage()
    expect(container.querySelector('.msg-page-wrap.thread-open')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Mr. E. Mutabazi'))
    expect(container.querySelector('.msg-page-wrap.thread-open')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to conversations' }))
    expect(container.querySelector('.msg-page-wrap.thread-open')).not.toBeInTheDocument()
  })

  it('renders an optional extra panel when provided', () => {
    renderPage({ extraPanel: <div>Quick Replies Panel</div> })
    expect(screen.getByText('Quick Replies Panel')).toBeInTheDocument()
  })

  it('shows "Active now" for an online contact with no explicit subtitle', () => {
    renderPage({ activeContact: { initials: 'CU', name: 'Ms. C. Umutoni', isOnline: true } })
    expect(screen.getByText('Active now')).toBeInTheDocument()
  })
})
