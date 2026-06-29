import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DormitoryModal } from './DormitoryModal'

describe('DormitoryModal', () => {
  it('renders add mode with defaults', () => {
    render(<DormitoryModal onClose={() => {}} onSave={() => {}} />)
    expect(screen.getAllByText('Add Dormitory').length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText('e.g. Kigoma')).toHaveValue('')
    expect(screen.getByText('No chambers yet — add one below.')).toBeInTheDocument()
  })

  it('disables save until name and staff are filled', () => {
    render(<DormitoryModal onClose={() => {}} onSave={() => {}} />)
    const saveButton = () => screen.getByRole('button', { name: /Add Dormitory/ })
    expect(saveButton()).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('e.g. Kigoma'), { target: { value: 'Kigoma' } })
    expect(saveButton()).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('e.g. Mrs. Mukamana'), { target: { value: 'Mrs. M' } })
    expect(saveButton()).not.toBeDisabled()
  })

  it('rejects adding a chamber with no name', () => {
    render(<DormitoryModal onClose={() => {}} onSave={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Add Chamber/ }))
    expect(screen.getByText('Chamber name is required.')).toBeInTheDocument()
  })

  it('rejects a chamber whose room range exceeds total rooms', () => {
    render(<DormitoryModal onClose={() => {}} onSave={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Chamber name (e.g. Chamber A)'), { target: { value: 'Chamber A' } })
    fireEvent.change(screen.getByPlaceholderText('Room from'), { target: { value: '1' } })
    fireEvent.change(screen.getByPlaceholderText('Room to'), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: /Add Chamber/ }))
    expect(screen.getByText(/Room end cannot exceed total rooms/)).toBeInTheDocument()
  })

  it('adds a valid chamber and allows removing it', () => {
    render(<DormitoryModal onClose={() => {}} onSave={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Chamber name (e.g. Chamber A)'), { target: { value: 'Chamber A' } })
    fireEvent.change(screen.getByPlaceholderText('Room from'), { target: { value: '1' } })
    fireEvent.change(screen.getByPlaceholderText('Room to'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: /Add Chamber/ }))

    expect(screen.getByText('Chamber A')).toBeInTheDocument()
    expect(screen.getByText('Chambers (1)')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Remove chamber'))
    expect(screen.queryByText('Chamber A')).not.toBeInTheDocument()
  })

  it('calls onSave with slugified key and chambers on save', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<DormitoryModal onClose={onClose} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Kigoma'), { target: { value: 'Kigoma House' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Mrs. Mukamana'), { target: { value: 'Mrs. M' } })
    fireEvent.click(screen.getByRole('button', { name: /Add Dormitory/ }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      key: 'kigoma-house',
      name: 'Kigoma House',
      staff: 'Mrs. M',
      gender: 'Girls',
      chambers: [],
    }))
    expect(onClose).toHaveBeenCalled()
  })

  it('disables the name field and keeps existing key when editing', () => {
    const onSave = vi.fn()
    const dormitory = { key: 'kigoma', name: 'Kigoma', gender: 'Girls', staff: 'Mrs. M', totalRooms: 30, bedsPerRoom: 8, chambers: [] }
    render(<DormitoryModal dormitory={dormitory} onClose={() => {}} onSave={onSave} />)

    expect(screen.getByPlaceholderText('e.g. Kigoma')).toBeDisabled()
    fireEvent.click(screen.getByText('Save Changes').closest('button'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ key: 'kigoma' }))
  })
})
