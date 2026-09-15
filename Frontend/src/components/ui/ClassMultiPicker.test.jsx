import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClassMultiPicker } from './ClassMultiPicker'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'

vi.mock('../../hooks/useSchoolConfig', () => ({ useSchoolConfig: vi.fn() }))

describe('ClassMultiPicker', () => {
  beforeEach(() => {
    useSchoolConfig.mockReturnValue({ config: [
      { name: 'A-Level', years: [{ name: 'S5', streams: ['MPC', 'PCB'] }] },
      { name: 'O-Level', years: [{ name: 'S1', streams: ['A'] }] },
    ] })
  })

  it('lists years in school order and ticks a whole year', () => {
    const onChange = vi.fn()
    render(<ClassMultiPicker value={[]} onChange={onChange} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes.map(b => b.parentElement.textContent)).toEqual(['S1', 'S5'])
    fireEvent.click(boxes[1])
    expect(onChange).toHaveBeenCalledWith([{ grade: 'S5', stream: '' }])
  })

  it('narrows a ticked year to one stream', () => {
    const onChange = vi.fn()
    render(<ClassMultiPicker value={[{ grade: 'S5', stream: '' }]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'S5PCB' }))
    expect(onChange).toHaveBeenCalledWith([{ grade: 'S5', stream: 'MPC' }])
  })
})
