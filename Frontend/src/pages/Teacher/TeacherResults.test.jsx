import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
import { TeacherResults } from './TeacherResults'
import {
  getTeacherMyClasses, getTeacherStudents, getTeacherResultList, bulkSaveResults,
} from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  getTeacherMyClasses: vi.fn(),
  getTeacherStudents: vi.fn(),
  getTeacherResultList: vi.fn(),
  bulkSaveResults: vi.fn(),
  getTeacherPerformanceTrends: vi.fn().mockResolvedValue([]),
}))

// The school's own structure, which the year/stream pickers are built from.
vi.mock('../../api/dos', () => ({
  getSchoolConfig: vi.fn().mockResolvedValue([
  { name: 'O-Level', years: [{ name: 'S1', streams: ['A', 'B'] }, { name: 'S2', streams: ['A'] }, { name: 'S3', streams: ['A'] }] },
  { name: 'A-Level', years: [{ name: 'S4', streams: ['A', 'B'] }, { name: 'S5', streams: ['A'] }, { name: 'S6', streams: ['A'] }] },
]),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const CLASSES = [
  { class_id: 1, class_name: 'S1A', grade: 'S1', section: 'A', subject_name: 'Mathematics', subject_id: 10 },
]

describe('TeacherResults', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state while classes are fetched', () => {
    getTeacherMyClasses.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<TeacherResults />)
    expect(screen.getByText('Loading classes…')).toBeInTheDocument()
  })

  it('renders the Results page heading', async () => {
    getTeacherMyClasses.mockResolvedValue([])
    renderWithRouter(<TeacherResults />)
    await waitFor(() => expect(screen.getByRole('heading', { name: /Results/ })).toBeInTheDocument())
  })

  it('shows the section dropdown after classes load', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    renderWithRouter(<TeacherResults />)
    // ClassPicker renders <select> with <option> elements
    await waitFor(() => expect(screen.getByRole('option', { name: 'O-Level' })).toBeInTheDocument())
  })

  it('shows a prompt to select a class before results load', async () => {
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    renderWithRouter(<TeacherResults />)
    await waitFor(() => expect(screen.getByText('Select a class first')).toBeInTheDocument())
    expect(screen.getByText('No class selected')).toBeInTheDocument()
  })

  describe('entering marks', () => {
    const STUDENTS = [
      { student_id: 'u1', student_code: 'S001', full_name: 'Amina Uwase', initials: 'AU' },
      { student_id: 'u2', student_code: 'S002', full_name: 'Eric Habimana', initials: 'EH' },
    ]

    async function openModal() {
      getTeacherMyClasses.mockResolvedValue(CLASSES)
      getTeacherStudents.mockResolvedValue(STUDENTS)
      getTeacherResultList.mockResolvedValue([])
      renderWithRouter(<TeacherResults />)
      await waitFor(() => expect(screen.getByLabelText('Section')).toBeInTheDocument())
      fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'O-Level' } })
      fireEvent.change(screen.getByLabelText('Year'), { target: { value: 'S1' } })
      fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'A' } })
      fireEvent.click(screen.getByRole('button', { name: /Enter Results/ }))
      await waitFor(() => expect(screen.getByText('Amina Uwase')).toBeInTheDocument())
    }

    beforeEach(() => {
      HTMLDialogElement.prototype.showModal = vi.fn()
      HTMLDialogElement.prototype.close = vi.fn()
    })

    it('fills the score boxes from an uploaded CSV, checked against the max score', async () => {
      await openModal()
      const csv = 'student_code,score,remarks\nS001,18,Well done\nS002,25,'
      const file = new File([csv], 'scores.csv', { type: 'text/csv' })
      file.text = () => Promise.resolve(csv)

      fireEvent.change(screen.getByLabelText('Import CSV'), { target: { files: [file] } })
      expect(await screen.findByText('Enter the max score first, so the imported marks can be checked against it.')).toBeInTheDocument()

      fireEvent.change(screen.getByPlaceholderText('e.g. 30'), { target: { value: '20' } })
      fireEvent.change(screen.getByLabelText('Import CSV'), { target: { files: [file] } })

      expect(await screen.findByText('1 scores imported.')).toBeInTheDocument()
      expect(screen.getByText('Not a valid score: S002 (25)')).toBeInTheDocument()
      expect(screen.getAllByPlaceholderText('-')[0]).toHaveValue(18)
      expect(screen.getByDisplayValue('Well done')).toBeInTheDocument()
    })

    it('asks before throwing away typed marks, and not when nothing was typed', async () => {
      await openModal()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

      fireEvent.click(screen.getByText('Cancel'))
      expect(confirm).not.toHaveBeenCalled()
      expect(screen.queryByText('Amina Uwase')).not.toBeInTheDocument()
    })

    it('keeps the form open when the teacher declines to discard typed marks', async () => {
      await openModal()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      fireEvent.change(screen.getAllByPlaceholderText('-')[0], { target: { value: '7' } })

      fireEvent.click(screen.getByText('Cancel'))
      expect(confirm).toHaveBeenCalledWith('Discard the marks you have entered?')
      expect(screen.getByText('Amina Uwase')).toBeInTheDocument()

      confirm.mockReturnValue(true)
      fireEvent.click(screen.getByText('Cancel'))
      await waitFor(() => expect(screen.queryByText('Amina Uwase')).not.toBeInTheDocument())
      confirm.mockRestore()
    })
  })
})
