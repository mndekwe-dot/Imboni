import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StaffModal } from './StaffModal'

describe('StaffModal', () => {
  it('renders add mode fields empty', () => {
    render(<StaffModal onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByText('Add Staff Member')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Ms. J. Kamau')).toHaveValue('')
  })

  it('renders edit mode pre-filled with staff data', () => {
    const staff = { name: 'Ms. J. Kamau', role: 'Matron', email: 'j@imboni.edu', ext: '301', duty: '6PM-7AM' }
    render(<StaffModal staff={staff} onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByText('Edit Staff Member')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Ms. J. Kamau')).toHaveValue('Ms. J. Kamau')
  })

  it('disables save button when required fields are empty', () => {
    render(<StaffModal onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByText('Add Staff').closest('button')).toBeDisabled()
  })

  it('calls onSave with form payload and onClose when valid', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<StaffModal onClose={onClose} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Ms. J. Kamau'), { target: { value: 'Mr. X' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Matron — Kigoma Dormitory'), { target: { value: 'Patron' } })
    fireEvent.click(screen.getByText('Add Staff').closest('button'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mr. X', role: 'Patron' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose without saving when cancel is clicked', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<StaffModal onClose={onClose} onSave={onSave} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
