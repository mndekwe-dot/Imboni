import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Select } from './Select'

const options = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
]

describe('Select', () => {
  it('shows the placeholder when no value is selected', () => {
    render(<Select value="" onChange={() => {}} options={options} placeholder="Pick one" />)
    expect(screen.getByText('Pick one')).toBeInTheDocument()
  })

  it('shows the label of the selected option', () => {
    render(<Select value="b" onChange={() => {}} options={options} />)
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('opens the dropdown and shows all options when trigger is clicked', () => {
    render(<Select value="" onChange={() => {}} options={options} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('calls onChange with the chosen value and closes the dropdown', () => {
    const onChange = vi.fn()
    render(<Select value="" onChange={onChange} options={options} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('Option A'))
    expect(onChange).toHaveBeenCalledWith('a')
    expect(screen.queryByText('Option B')).not.toBeInTheDocument()
  })
})
