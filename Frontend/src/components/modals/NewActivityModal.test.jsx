import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewActivityModal } from './NewActivityModal'

describe('NewActivityModal', () => {
  it('renders with defaults and disabled create button', () => {
    render(<NewActivityModal onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByText('New Club / Event')).toBeInTheDocument()
    expect(screen.getByText('Create Club').closest('button')).toBeDisabled()
  })

  it('enables create once a name is entered and calls onSave with the right payload', async () => {
    const onSave = vi.fn().mockResolvedValue()
    render(<NewActivityModal onClose={() => {}} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Science Club'), { target: { value: 'Science Club' } })
    const createBtn = screen.getByText('Create Club').closest('button')
    expect(createBtn).not.toBeDisabled()

    fireEvent.click(createBtn)

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Science Club',
      category: 'sport',
      max_members: 30,
    })))
  })

  it('shows an error message when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('fail'))
    render(<NewActivityModal onClose={() => {}} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Science Club'), { target: { value: 'Science Club' } })
    fireEvent.click(screen.getByText('Create Club').closest('button'))

    await waitFor(() => expect(screen.getByText('Failed to create. Please try again.')).toBeInTheDocument())
  })

  it('calls onClose without saving on cancel', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<NewActivityModal onClose={onClose} onSave={onSave} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
