import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdminStaffModal } from './AdminStaffModal'

describe('AdminStaffModal', () => {
  it('renders add mode with default selects', () => {
    render(<AdminStaffModal onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByText('Add Staff Member')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Ms. Grace Mwangi')).toHaveValue('')
  })

  it('shows validation errors and does not save when required fields are missing', () => {
    const onSave = vi.fn()
    render(<AdminStaffModal onClose={() => {}} onSave={onSave} />)
    fireEvent.click(screen.getByText('Add Staff'))
    expect(screen.getByText('Full name is required')).toBeInTheDocument()
    expect(screen.getByText('Role is required')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('clears a field error once the user types in it', () => {
    render(<AdminStaffModal onClose={() => {}} onSave={() => {}} />)
    fireEvent.click(screen.getByText('Add Staff'))
    expect(screen.getByText('Full name is required')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('e.g. Ms. Grace Mwangi'), { target: { value: 'Grace' } })
    expect(screen.queryByText('Full name is required')).not.toBeInTheDocument()
  })

  it('computes initials and class mappings on save', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<AdminStaffModal onClose={onClose} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Ms. Grace Mwangi'), { target: { value: 'Grace Mwangi' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Mathematics Teacher'), { target: { value: 'Teacher' } })
    fireEvent.click(screen.getByText('Add Staff'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Grace Mwangi',
      role: 'Teacher',
      initials: 'GM',
      contractClass: 'fulltime',
      statusClass: 'active',
    }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose without saving on cancel', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<AdminStaffModal onClose={onClose} onSave={onSave} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
