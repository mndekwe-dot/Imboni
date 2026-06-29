import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimetableEditForm } from './TimetableEditForm'

beforeEach(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = vi.fn()
  }
})

const subjects = [{ id: 'sub1', name: 'Mathematics' }]
const teachers = [{ teacher_id: 't1', full_name: 'Mr. X' }]
const rooms = [{ id: 'r1', name: 'Room 12' }]

describe('TimetableEditForm', () => {
  it('shows "Add Slot" title when no existing cell', () => {
    render(<TimetableEditForm type="academic" editingSlot={null} onSave={() => {}} onDelete={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Add Slot')).toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  it('shows "Edit Slot" title and a Delete button when editing an existing cell', () => {
    const editingSlot = { day: 'Monday', period: { id: 1 }, cell: { subject: 'Mathematics', teacher: 'Mr. X', room: 'Room 12' } }
    render(<TimetableEditForm type="academic" editingSlot={editingSlot} onSave={() => {}} onDelete={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Edit Slot')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('shows the Activity Type select only for extracurricular forms', () => {
    render(<TimetableEditForm type="extracurricular" onSave={() => {}} onDelete={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Activity Type')).toBeInTheDocument()
  })

  it('hides the Activity Type select for academic forms', () => {
    render(<TimetableEditForm type="academic" onSave={() => {}} onDelete={() => {}} onCancel={() => {}} />)
    expect(screen.queryByText('Activity Type')).not.toBeInTheDocument()
  })

  it('selecting a subject populates subject/subjectId and resets teacher selection', () => {
    const onSubjectChange = vi.fn()
    render(<TimetableEditForm type="academic" subjects={subjects} teachers={teachers} rooms={rooms} onSave={() => {}} onDelete={() => {}} onCancel={() => {}} onSubjectChange={onSubjectChange} />)
    fireEvent.change(screen.getByDisplayValue('Select subject'), { target: { value: 'sub1' } })
    expect(onSubjectChange).toHaveBeenCalledWith('sub1')
    expect(screen.getByText('Select teacher')).toBeInTheDocument()
  })

  it('calls onSave with the current form state', () => {
    const onSave = vi.fn()
    render(<TimetableEditForm type="academic" onSave={onSave} onDelete={() => {}} onCancel={() => {}} />)
    fireEvent.change(screen.getByDisplayValue('Select day'), { target: { value: 'Monday' } })
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ day: 'Monday' }))
  })

  it('calls onDelete with the editingSlot when Delete is clicked', () => {
    const onDelete = vi.fn()
    const editingSlot = { day: 'Monday', period: { id: 1 }, cell: { subject: 'Mathematics' } }
    render(<TimetableEditForm type="academic" editingSlot={editingSlot} onSave={() => {}} onDelete={onDelete} onCancel={() => {}} />)
    fireEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledWith(editingSlot)
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    render(<TimetableEditForm type="academic" onSave={() => {}} onDelete={() => {}} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
})
