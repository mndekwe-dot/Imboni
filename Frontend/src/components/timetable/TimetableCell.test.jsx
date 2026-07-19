import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimetableCell } from './TimetableCell'

describe('TimetableCell', () => {
  it('renders a dash placeholder when cell is null', () => {
    render(<table><tbody><tr><TimetableCell cell={null} colIndex={0} /></tr></tbody></table>)
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('renders a label for an explicitly empty slot', () => {
    render(<table><tbody><tr><TimetableCell cell={{ type: 'empty', label: 'Free Period' }} colIndex={0} /></tr></tbody></table>)
    expect(screen.getByText('Free Period')).toBeInTheDocument()
  })

  it('falls back to a dash for an empty slot without a label', () => {
    render(<table><tbody><tr><TimetableCell cell={{ type: 'empty' }} colIndex={0} /></tr></tbody></table>)
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('renders "Break" for a break-type cell', () => {
    render(<table><tbody><tr><TimetableCell cell={{ type: 'break' }} colIndex={0} /></tr></tbody></table>)
    expect(screen.getByText('Break')).toBeInTheDocument()
  })

  it('renders "Break" for a legacy subject:"Break" cell without a type', () => {
    render(<table><tbody><tr><TimetableCell cell={{ subject: 'Break' }} colIndex={0} /></tr></tbody></table>)
    expect(screen.getByText('Break')).toBeInTheDocument()
  })

  it('renders subject, teacher, and room for a normal lesson cell', () => {
    render(<table><tbody><tr>
      <TimetableCell cell={{ type: 'academic', subject: 'Mathematics', teacher: 'Mr. X', room: 'Room 1' }} colIndex={1} />
    </tr></tbody></table>)
    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('Mr. X')).toBeInTheDocument()
    expect(screen.getByText('Room 1')).toBeInTheDocument()
  })

  it('omits teacher and room when not present', () => {
    render(<table><tbody><tr>
      <TimetableCell cell={{ type: 'academic', subject: 'Mathematics' }} colIndex={1} />
    </tr></tbody></table>)
    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.queryByText('Room 1')).not.toBeInTheDocument()
  })

  it('shows an edit button only when editable, and calls onEdit with the cell', () => {
    const onEdit = vi.fn()
    const cell = { type: 'academic', subject: 'Mathematics' }
    render(<table><tbody><tr>
      <TimetableCell cell={cell} editable onEdit={onEdit} colIndex={1} />
    </tr></tbody></table>)

    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(onEdit).toHaveBeenCalledWith(cell)
  })

  it('does not render an edit button when not editable', () => {
    render(<table><tbody><tr>
      <TimetableCell cell={{ type: 'academic', subject: 'Mathematics' }} editable={false} onEdit={() => {}} colIndex={1} />
    </tr></tbody></table>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
