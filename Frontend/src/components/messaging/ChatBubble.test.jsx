import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatBubble } from './ChatBubble'

describe('ChatBubble', () => {
  it('renders sent and received text bubbles', () => {
    const { rerender } = render(<ChatBubble type="sent" text="Hello there" time="10:00 AM" />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
    expect(screen.getByText('10:00 AM')).toBeInTheDocument()

    rerender(<ChatBubble type="received" text="Hi back" time="10:01 AM" senderInitials="CU" senderAvatarClass="teacher" />)
    expect(screen.getByText('Hi back')).toBeInTheDocument()
    expect(screen.getByText('CU')).toBeInTheDocument()
  })

  it('shows a date separator only when provided', () => {
    const { rerender } = render(<ChatBubble text="A" time="1" />)
    expect(screen.queryByText('Today')).not.toBeInTheDocument()

    rerender(<ChatBubble text="A" time="1" dateSep="Today" />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('shows read ticks only when ticks is not null, with "seen" styling', () => {
    const { rerender, container } = render(<ChatBubble text="A" time="1" ticks={null} />)
    expect(container.querySelector('.read-ticks')).not.toBeInTheDocument()

    rerender(<ChatBubble text="A" time="1" ticks="seen" />)
    expect(container.querySelector('.read-ticks.seen')).toBeInTheDocument()

    rerender(<ChatBubble text="A" time="1" ticks="" />)
    expect(container.querySelector('.read-ticks')).toBeInTheDocument()
    expect(container.querySelector('.read-ticks.seen')).not.toBeInTheDocument()
  })

  it('renders a file attachment bubble instead of text when attachment is provided', () => {
    render(<ChatBubble time="1" attachment={{ fileName: 'report.pdf', fileSize: '120 KB' }} />)
    expect(screen.getByText('report.pdf')).toBeInTheDocument()
    expect(screen.getByText('120 KB')).toBeInTheDocument()
    expect(screen.getByTitle('Download')).toBeInTheDocument()
  })
})
