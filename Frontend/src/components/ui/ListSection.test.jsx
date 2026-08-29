import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ListSection } from './ListSection'

describe('ListSection', () => {
  it('renders the title as a heading so the section is reachable', () => {
    render(<ListSection title="Prefects">body</ListSection>)
    expect(screen.getByRole('heading', { name: 'Prefects' })).toBeInTheDocument()
  })

  it('draws the same frame DataTable draws', () => {
    const { container } = render(<ListSection title="Clubs">body</ListSection>)
    expect(container.querySelector('.dt-container')).toBeInTheDocument()
    expect(container.querySelector('.dt-header')).toBeInTheDocument()
  })

  it('shows the count when given one and nothing when not', () => {
    const { rerender, container } = render(<ListSection title="Clubs" count="12 clubs">x</ListSection>)
    expect(screen.getByText('12 clubs')).toBeInTheDocument()
    rerender(<ListSection title="Clubs">x</ListSection>)
    expect(container.querySelector('.dt-count')).toBeNull()
  })

  it('shows a count of 0 rather than swallowing it', () => {
    // `count && ...` would hide this. A section reading "0 prefects" is the
    // point: it says the list is empty on purpose, not still loading.
    render(<ListSection title="Prefects" count={0}>x</ListSection>)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('pads the body by default and not when told otherwise', () => {
    const { container, rerender } = render(<ListSection title="Clubs">x</ListSection>)
    expect(container.querySelector('.dt-body')).toHaveClass('dt-body-pad')
    rerender(<ListSection title="Clubs" pad={false}>x</ListSection>)
    expect(container.querySelector('.dt-body')).not.toHaveClass('dt-body-pad')
  })

  it('merges a caller className instead of replacing the frame', () => {
    const { container } = render(<ListSection title="Clubs" className="mb-1-5">x</ListSection>)
    const section = container.querySelector('section')
    expect(section).toHaveClass('dt-container')
    expect(section).toHaveClass('mb-1-5')
  })
})
