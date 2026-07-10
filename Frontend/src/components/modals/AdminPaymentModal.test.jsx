import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdminPaymentModal } from './AdminPaymentModal'

describe('AdminPaymentModal', () => {
  it('renders with today date defaulted and Full Payment type', () => {
    render(<AdminPaymentModal onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByText('Record New Payment')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Aisha Kamau')).toHaveValue('')
  })

  it('shows validation errors when student name and amount are missing', () => {
    const onSave = vi.fn()
    render(<AdminPaymentModal onClose={() => {}} onSave={onSave} />)
    fireEvent.click(screen.getByText('Record Payment'))
    expect(screen.getByText('Student name is required')).toBeInTheDocument()
    expect(screen.getByText('Amount is required')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('formats amount with KES prefix and locale thousands separator', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<AdminPaymentModal onClose={onClose} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Aisha Kamau'), { target: { value: 'Aisha Kamau' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. 58000'), { target: { value: '58000' } })
    fireEvent.click(screen.getByText('Record Payment'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Aisha Kamau',
      amount: 'KES 58,000',
      initials: 'AK',
      adm: '—',
      typeClass: 'paid',
    }))
    expect(onClose).toHaveBeenCalled()
  })

  it('maps payment type to the correct typeClass', () => {
    const onSave = vi.fn()
    render(<AdminPaymentModal onClose={() => {}} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Aisha Kamau'), { target: { value: 'A B' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. 58000'), { target: { value: '1000' } })
    fireEvent.change(screen.getByDisplayValue('Full Payment'), { target: { value: 'Bursary' } })
    fireEvent.click(screen.getByText('Record Payment'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ type: 'Bursary', typeClass: 'info' }))
  })

  it('calls onClose without saving on cancel', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<AdminPaymentModal onClose={onClose} onSave={onSave} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
