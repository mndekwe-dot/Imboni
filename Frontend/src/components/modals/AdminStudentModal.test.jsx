import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdminStudentModal } from './AdminStudentModal'
import { getSchoolConfig } from '../../api/dos'

vi.mock('../../api/dos')

describe('AdminStudentModal', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getSchoolConfig.mockResolvedValue([
      { name: 'O-Level', years: [{ name: 'S1', streams: ['A', 'B'] }] },
    ])
  })

  it('renders add mode with default class/house/fee/status', async () => {
    render(<AdminStudentModal onClose={() => {}} onSave={() => {}} />)
    expect(screen.getAllByText('Admit Student').length).toBeGreaterThan(0)
    expect(screen.getByPlaceholderText('e.g. Aisha Kamau')).toHaveValue('')
    await waitFor(() => expect(getSchoolConfig).toHaveBeenCalled())
  })

  it('shows validation error when name is missing', () => {
    const onSave = vi.fn()
    render(<AdminStudentModal onClose={() => {}} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /Admit Student/ }))
    expect(screen.getByText('Full name is required')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves with computed initials and class mappings', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<AdminStudentModal onClose={onClose} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Aisha Kamau'), { target: { value: 'Aisha Kamau' } })
    fireEvent.click(screen.getByRole('button', { name: /Admit Student/ }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Aisha Kamau',
      initials: 'AK',
      feeClass: 'paid',
      statusClass: 'active',
    }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders read-only mode with disabled inputs and no save button', () => {
    const student = { name: 'Aisha Kamau', adm: 'ADM-1', class: 'S1A', house: 'Kigoma', fee: 'Paid', status: 'Active' }
    render(<AdminStudentModal student={student} onClose={() => {}} onSave={() => {}} readOnly />)

    expect(screen.getByText('Student Details')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Aisha Kamau')).toHaveAttribute('readonly')
    expect(screen.queryByText('Admit Student')).not.toBeInTheDocument()
    expect(screen.getByText('Close')).toBeInTheDocument()
  })

  it('calls onClose without saving on cancel', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<AdminStudentModal onClose={onClose} onSave={onSave} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })
})
