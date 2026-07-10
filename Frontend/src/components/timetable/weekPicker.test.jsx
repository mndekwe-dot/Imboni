import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekPicker } from './weekPicker'
import { getThisMonday } from './dateUtils'

describe('WeekPicker', () => {
  afterEach(() => vi.useRealTimers())

  it('renders the formatted week label', () => {
    const monday = new Date('2026-04-13T00:00:00')
    render(<WeekPicker currentMonday={monday} onChange={() => {}} />)
    expect(screen.getByText('Apr 13 – Apr 19, 2026')).toBeInTheDocument()
  })

  it('calls onChange with the previous week on prev click', () => {
    const monday = new Date('2026-04-13T00:00:00')
    const onChange = vi.fn()
    render(<WeekPicker currentMonday={monday} onChange={onChange} />)
    fireEvent.click(screen.getByTitle('Previous week'))
    const arg = onChange.mock.calls[0][0]
    expect(arg.getDate()).toBe(6)
  })

  it('calls onChange with the next week on next click', () => {
    const monday = new Date('2026-04-13T00:00:00')
    const onChange = vi.fn()
    render(<WeekPicker currentMonday={monday} onChange={onChange} />)
    fireEvent.click(screen.getByTitle('Next week'))
    const arg = onChange.mock.calls[0][0]
    expect(arg.getDate()).toBe(20)
  })

  it('hides the Today button when already viewing the current week', () => {
    vi.setSystemTime(new Date('2026-04-15T10:00:00Z'))
    const monday = getThisMonday()
    render(<WeekPicker currentMonday={monday} onChange={() => {}} />)
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
  })

  it('shows the Today button when viewing a different week', () => {
    vi.setSystemTime(new Date('2026-04-15T10:00:00Z'))
    const otherMonday = new Date('2026-04-06T00:00:00')
    render(<WeekPicker currentMonday={otherMonday} onChange={() => {}} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })
})
