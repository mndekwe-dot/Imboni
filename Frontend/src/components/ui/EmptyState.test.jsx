import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(<EmptyState title="Nothing here" description="Try again later" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.getByText('Try again later')).toBeInTheDocument()
  })

  it('does not render description block when omitted', () => {
    render(<EmptyState title="Nothing here" />)
    expect(screen.queryByText('Try again later')).not.toBeInTheDocument()
  })

  it('renders and triggers the primary action', () => {
    const onClick = vi.fn()
    render(<EmptyState title="Empty" action={{ label: 'Add item', onClick }} />)
    fireEvent.click(screen.getByText('Add item'))
    expect(onClick).toHaveBeenCalled()
  })

  it('renders and triggers the secondary action', () => {
    const onClick = vi.fn()
    render(<EmptyState title="Empty" secondAction={{ label: 'Cancel', onClick }} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClick).toHaveBeenCalled()
  })

  it('renders no action buttons when neither action is provided', () => {
    render(<EmptyState title="Empty" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
