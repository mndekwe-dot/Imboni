import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditActivityModal } from './EditActivityModal'

const activity = {
  name: 'Science Club', category: 'science', schedule: 'Tue & Thu', venue: 'Lab 2',
  max_members: 25, description: 'A club', is_active: true,
}

describe('EditActivityModal', () => {
  it('pre-fills the form with the activity data', () => {
    render(<EditActivityModal activity={activity} onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByText('Edit Club / Event')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Science Club')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Lab 2')).toBeInTheDocument()
  })

  it('saves updated fields including the is_active checkbox toggle', async () => {
    const onSave = vi.fn().mockResolvedValue()
    render(<EditActivityModal activity={activity} onClose={() => {}} onSave={onSave} />)

    fireEvent.change(screen.getByDisplayValue('Science Club'), { target: { value: 'Science Club Updated' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByText('Save Changes').closest('button'))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Science Club Updated',
      is_active: false,
      max_members: 25,
    })))
  })

  it('shows an error message when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('fail'))
    render(<EditActivityModal activity={activity} onClose={() => {}} onSave={onSave} />)
    fireEvent.click(screen.getByText('Save Changes').closest('button'))
    await waitFor(() => expect(screen.getByText('Failed to save. Please try again.')).toBeInTheDocument())
  })

  it('falls back to defaults when activity fields are missing', () => {
    render(<EditActivityModal activity={{}} onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('calls onClose without saving on cancel', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<EditActivityModal activity={activity} onClose={onClose} onSave={onSave} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
