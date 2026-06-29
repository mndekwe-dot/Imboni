import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConversationItem } from './ConversationItem'

describe('ConversationItem', () => {
  it('renders name, type tag, time and preview', () => {
    render(<ConversationItem initials="CU" name="Ms. C. Umutoni" typeTag="Teacher" time="10:22 AM" preview="Hello there" />)
    expect(screen.getByText('Ms. C. Umutoni')).toBeInTheDocument()
    expect(screen.getByText('Teacher')).toBeInTheDocument()
    expect(screen.getByText('10:22 AM')).toBeInTheDocument()
    expect(screen.getByText('Hello there')).toBeInTheDocument()
  })

  it('omits the type tag badge when none is given', () => {
    render(<ConversationItem initials="CU" name="Ms. C. Umutoni" />)
    expect(screen.queryByText('Teacher')).not.toBeInTheDocument()
  })

  it('calls onClick when the row is clicked', () => {
    const onClick = vi.fn()
    render(<ConversationItem initials="CU" name="Ms. C. Umutoni" onClick={onClick} />)
    fireEvent.click(screen.getByText('Ms. C. Umutoni'))
    expect(onClick).toHaveBeenCalled()
  })

  it('applies active and unread classes conditionally', () => {
    const { container, rerender } = render(<ConversationItem initials="CU" name="X" isActive={false} isUnread={false} />)
    expect(container.querySelector('.conv-item.active')).not.toBeInTheDocument()
    expect(container.querySelector('.unread-dot')).not.toBeInTheDocument()

    rerender(<ConversationItem initials="CU" name="X" isActive={true} isUnread={true} />)
    expect(container.querySelector('.conv-item.active')).toBeInTheDocument()
    expect(container.querySelector('.unread-dot')).toBeInTheDocument()
  })

  it('shows an online presence indicator only when isOnline is true', () => {
    const { container, rerender } = render(<ConversationItem initials="CU" name="X" isOnline={false} />)
    expect(container.querySelector('.conv-avatar > span')).not.toBeInTheDocument()

    rerender(<ConversationItem initials="CU" name="X" isOnline={true} />)
    expect(container.querySelector('.conv-avatar > span')).toBeInTheDocument()
  })
})
