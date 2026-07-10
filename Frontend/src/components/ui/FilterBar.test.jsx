import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from './FilterBar'

describe('FilterBar', () => {
  const options = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending', count: 3 },
  ]

  it('renders all options with labels', () => {
    render(<FilterBar options={options} active="all" onChange={() => {}} />)
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('shows the count badge when count is defined', () => {
    render(<FilterBar options={options} active="all" onChange={() => {}} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('marks the active option with the active class', () => {
    render(<FilterBar options={options} active="pending" onChange={() => {}} />)
    expect(screen.getByText('Pending').closest('button')).toHaveClass('active')
    expect(screen.getByText('All').closest('button')).not.toHaveClass('active')
  })

  it('calls onChange with the clicked key', () => {
    const onChange = vi.fn()
    render(<FilterBar options={options} active="all" onChange={onChange} />)
    fireEvent.click(screen.getByText('Pending'))
    expect(onChange).toHaveBeenCalledWith('pending')
  })
})
