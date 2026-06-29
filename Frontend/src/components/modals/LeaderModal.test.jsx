import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LeaderModal } from './LeaderModal'
import { getDisStudents } from '../../api/discipline'

vi.mock('../../api/discipline')

describe('LeaderModal', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders add mode with a student search box', () => {
    render(<LeaderModal onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByText('Add Student Leader')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search by name or ADM number…')).toBeInTheDocument()
  })

  it('disables save until a student is selected (create mode)', () => {
    render(<LeaderModal onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByText('Add Leader').closest('button')).toBeDisabled()
  })

  it('searches and selects a student, then enables save', async () => {
    getDisStudents.mockResolvedValue([
      { id: 's1', name: 'Aisha Kamau', student_id: 'ADM-1', grade: 'S1', section: 'A' },
    ])
    const onSave = vi.fn()
    render(<LeaderModal onClose={() => {}} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('Search by name or ADM number…'), { target: { value: 'Ai' } })

    await waitFor(() => expect(screen.getByText('Aisha Kamau')).toBeInTheDocument(), { timeout: 1000 })
    fireEvent.click(screen.getByText('Aisha Kamau'))

    expect(screen.getByText('Add Leader').closest('button')).not.toBeDisabled()

    fireEvent.click(screen.getByText('Add Leader').closest('button'))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ student_id: 's1', role: 'prefect' })))
  })

  it('shows edit mode with student name locked and no search box', () => {
    const leader = { student_uuid: 'u1', student_name: 'Aisha Kamau', student_id: 'ADM-1', grade: 'S1', section: 'A', role: 'prefect' }
    render(<LeaderModal leader={leader} onClose={() => {}} onSave={() => {}} />)
    expect(screen.getByText('Edit Student Leader')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Search by name or ADM number…')).not.toBeInTheDocument()
    expect(screen.getByText('Aisha Kamau')).toBeInTheDocument()
  })

  it('calls onClose without saving on cancel', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<LeaderModal onClose={onClose} onSave={onSave} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
