import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabGroup } from './TabGroup'

describe('TabGroup', () => {
  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'dashboard' },
    { key: 'details', label: 'Details', icon: 'info' },
  ]

  it('renders all tabs', () => {
    render(<TabGroup tabs={tabs} value="overview" onChange={() => {}} />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Details')).toBeInTheDocument()
  })

  it('applies active class to the selected tab only', () => {
    render(<TabGroup tabs={tabs} value="details" onChange={() => {}} />)
    expect(screen.getByText('Details').closest('button')).toHaveClass('active')
    expect(screen.getByText('Overview').closest('button')).not.toHaveClass('active')
  })

  it('calls onChange with the tab key when clicked', () => {
    const onChange = vi.fn()
    render(<TabGroup tabs={tabs} value="overview" onChange={onChange} />)
    fireEvent.click(screen.getByText('Details'))
    expect(onChange).toHaveBeenCalledWith('details')
  })
})
