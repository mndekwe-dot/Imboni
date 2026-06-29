import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnnouncementItem } from './AnnouncementItem'

describe('AnnouncementItem', () => {
  it('renders title, type badge, date, author and body', () => {
    render(
      <AnnouncementItem
        type="urgent" icon="priority_high" title="Exam Moved"
        date="Mar 8, 2026" body="Details about the exam." author="Ms. Uwera"
      />
    )
    expect(screen.getByText('Exam Moved')).toBeInTheDocument()
    expect(screen.getByText('Urgent')).toBeInTheDocument()
    expect(screen.getByText('Mar 8, 2026')).toBeInTheDocument()
    expect(screen.getByText('Details about the exam.')).toBeInTheDocument()
    expect(screen.getByText('Ms. Uwera')).toBeInTheDocument()
  })

  it('shows "Mark Read" for unread and "✓ Read" for read items', () => {
    const { rerender } = render(<AnnouncementItem title="A" isUnread={true} />)
    expect(screen.getByText('Mark Read')).toBeInTheDocument()

    rerender(<AnnouncementItem title="A" isUnread={false} />)
    expect(screen.getByText('✓ Read')).toBeInTheDocument()
  })

  it('calls onClick when the card is clicked', () => {
    const onClick = vi.fn()
    render(<AnnouncementItem title="A" onClick={onClick} />)
    fireEvent.click(screen.getByText('A'))
    expect(onClick).toHaveBeenCalled()
  })

  it('clicking the read-status button does not bubble up to the card onClick', () => {
    const onClick = vi.fn()
    render(<AnnouncementItem title="A" isUnread={true} onClick={onClick} />)
    fireEvent.click(screen.getByText('Mark Read'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders an audience tag only when provided', () => {
    const { rerender } = render(<AnnouncementItem title="A" />)
    expect(screen.queryByText('Parents')).not.toBeInTheDocument()

    rerender(<AnnouncementItem title="A" audience="Parents" />)
    expect(screen.getByText('Parents')).toBeInTheDocument()
  })
})
