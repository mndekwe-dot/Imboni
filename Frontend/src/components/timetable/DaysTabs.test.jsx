import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DayTabs } from './DaysTabs'

describe('DayTabs', () => {
  it('renders one tab per day using the default DAY_SHORT labels', () => {
    render(<DayTabs selected={0} onChange={() => {}} />)
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(7)
  })

  it('renders custom days when provided', () => {
    render(<DayTabs selected={0} onChange={() => {}} days={['A', 'B']} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('applies the active class to the selected tab', () => {
    render(<DayTabs selected={2} onChange={() => {}} days={['Mon', 'Tue', 'Wed']} />)
    expect(screen.getByText('Wed').className).toContain('active')
    expect(screen.getByText('Mon').className).not.toContain('active')
  })

  it('calls onChange with the clicked tab index', () => {
    const onChange = vi.fn()
    render(<DayTabs selected={0} onChange={onChange} days={['Mon', 'Tue', 'Wed']} />)
    fireEvent.click(screen.getByText('Wed'))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('offers only the days it is given, and reports the real day index', () => {
    // Mon–Fri: no Saturday or Sunday tab when the timetable hides weekends.
    const onChange = vi.fn()
    render(<DayTabs selected={4} onChange={onChange} indices={[0, 1, 2, 3, 4]} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
    expect(screen.queryByText('Sat')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fri' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByText('Thu'))
    expect(onChange).toHaveBeenCalledWith(3)
  })
})
