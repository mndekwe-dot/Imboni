import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DormitoryCaptainModal } from './DormitoryCaptainModal'
import { getDisStudents } from '../../api/discipline'

vi.mock('../../api/discipline')

describe('DormitoryCaptainModal', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders add mode with dormitory select and disabled save', () => {
    render(<DormitoryCaptainModal onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByText('Add Dormitory Captain')).toBeInTheDocument()
    expect(screen.getByText('Add Captain').closest('button')).toBeDisabled()
  })

  it('requires both a student and a dormitory before saving', async () => {
    getDisStudents.mockResolvedValue([
      { id: 's1', name: 'Aisha Kamau', student_id: 'ADM-1', grade: 'S1', section: 'A' },
    ])
    const onSave = vi.fn()
    render(<DormitoryCaptainModal onClose={() => {}} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('Search by name or ADM number…'), { target: { value: 'Ai' } })
    await waitFor(() => expect(screen.getByText('Aisha Kamau')).toBeInTheDocument(), { timeout: 1000 })
    fireEvent.click(screen.getByText('Aisha Kamau'))

    expect(screen.getByText('Add Captain').closest('button')).toBeDisabled()

    fireEvent.change(screen.getByDisplayValue('Select dormitory'), { target: { value: 'bisoke' } })
    expect(screen.getByText('Add Captain').closest('button')).not.toBeDisabled()

    fireEvent.click(screen.getByText('Add Captain').closest('button'))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      student_id: 's1',
      notes: 'Dormitory: Bisoke',
    })))
  })

  it('disables the dormitory select in edit mode', () => {
    const captain = { student_uuid: 'u1', student_name: 'Aisha Kamau', student_id: 'ADM-1', grade: 'S1', section: 'A', notes: 'Dormitory: Bisoke' }
    render(<DormitoryCaptainModal captain={captain} onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByText('Edit Dormitory Captain')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Bisoke')).toBeDisabled()
  })

  it('calls onClose without saving on cancel', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<DormitoryCaptainModal onClose={onClose} onSave={onSave} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
