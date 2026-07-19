import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PeriodManager } from './PeriodManager'

beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = vi.fn()
  }
})

const periods = [
  { id: 1, label: 'Period 1', time: '8:00 - 8:40' },
  { id: 2, label: 'Period 2', time: '8:40 - 9:20' },
]

describe('PeriodManager', () => {
  it('renders one row per period', () => {
    render(<PeriodManager periods={periods} onChange={() => {}} onClose={() => {}} />)
    expect(screen.getByDisplayValue('Period 1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Period 2')).toBeInTheDocument()
  })

  it('updates a row label via onChange', () => {
    const onChange = vi.fn()
    render(<PeriodManager periods={periods} onChange={onChange} onClose={() => {}} />)
    fireEvent.change(screen.getByDisplayValue('Period 1'), { target: { value: 'Morning Period' } })
    expect(onChange).toHaveBeenCalledWith([
      { id: 1, label: 'Morning Period', time: '8:00 - 8:40' },
      periods[1],
    ])
  })

  it('adds a new blank row', () => {
    const onChange = vi.fn()
    render(<PeriodManager periods={periods} onChange={onChange} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Add Row'))
    const arg = onChange.mock.calls[0][0]
    expect(arg).toHaveLength(3)
    expect(arg[2].label).toBe('New Slot')
  })

  it('requires a confirm click before removing a row', () => {
    const onChange = vi.fn()
    render(<PeriodManager periods={periods} onChange={onChange} onClose={() => {}} />)
    const deleteButtons = screen.getAllByTitle('Remove row')
    fireEvent.click(deleteButtons[0])
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Confirm'))
    expect(onChange).toHaveBeenCalledWith([periods[1]])
  })

  it('cancels a pending delete', () => {
    const onChange = vi.fn()
    render(<PeriodManager periods={periods} onChange={onChange} onClose={() => {}} />)
    fireEvent.click(screen.getAllByTitle('Remove row')[0])
    fireEvent.click(screen.getByText('Cancel'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getAllByTitle('Remove row')).toHaveLength(2)
  })

  it('calls onClose when Done is clicked', () => {
    const onClose = vi.fn()
    render(<PeriodManager periods={periods} onChange={() => {}} onClose={onClose} />)
    fireEvent.click(screen.getByText('Done'))
    expect(onClose).toHaveBeenCalled()
  })
})
