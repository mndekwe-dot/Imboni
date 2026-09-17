import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { TeacherMaterials } from './TeacherMaterials'
import {
  getTeacherMaterials, getTeacherMyClasses, createTeacherMaterial,
  updateTeacherMaterial, deleteTeacherMaterial,
} from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  getTeacherMaterials: vi.fn(),
  getTeacherMyClasses: vi.fn(),
  createTeacherMaterial: vi.fn(),
  updateTeacherMaterial: vi.fn(),
  deleteTeacherMaterial: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close    = function () { this.removeAttribute('open') }
})

function pickClass(dialog, name) {
  fireEvent.click(within(dialog).getByLabelText('Class *'))
  fireEvent.click(within(within(dialog).getByRole('listbox')).getByRole('option', { name }))
}

const CLASSES = [
  { class_id: 'c1', class_name: 'S4A', grade: 'S4', section: 'A', subject_id: 's1', subject_name: 'Mathematics' },
  { class_id: 'c2', class_name: 'S5B', grade: 'S5', section: 'B', subject_id: 's1', subject_name: 'Mathematics' },
]

const NOTES = {
  id: 'm1', title: 'Week 3 notes', description: 'Fractions', kind: 'file',
  file: 'http://x/media/teaching-materials/notes.pdf', file_name: 'notes.pdf', file_size: 204800, url: '',
  class_id: 'c1', class_name: 'S4A', subject_id: 's1', subject_name: 'Mathematics',
  teacher_name: 'Claire Umutoni', created_at: '2026-09-10T08:00:00Z',
}
const VIDEO = {
  ...NOTES, id: 'm2', title: 'Fractions video', kind: 'video', file: null, file_name: '', file_size: null,
  url: 'https://www.youtube.com/watch?v=abc', description: '', class_id: 'c2', class_name: 'S5B',
}

describe('TeacherMaterials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTeacherMyClasses.mockResolvedValue(CLASSES)
    getTeacherMaterials.mockResolvedValue([NOTES, VIDEO])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('lists shared materials with their class and a way to open them', async () => {
    renderWithRouter(<TeacherMaterials />)

    const link = await screen.findByRole('link', { name: 'Week 3 notes' })
    expect(link).toHaveAttribute('href', NOTES.file)
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByText(/S4A · .* · 200 KB/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fractions video: Watch' })).toHaveAttribute('href', VIDEO.url)
  })

  it('shows the empty state when nothing has been shared', async () => {
    getTeacherMaterials.mockResolvedValue([])
    renderWithRouter(<TeacherMaterials />)
    expect(await screen.findByText('Nothing shared yet')).toBeInTheDocument()
  })

  it('says why sharing is off when the teacher has no classes', async () => {
    getTeacherMyClasses.mockResolvedValue([])
    getTeacherMaterials.mockResolvedValue([])
    renderWithRouter(<TeacherMaterials />)
    expect(await screen.findByText(/no classes this term/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Share material/ })).toBeDisabled()
  })

  it('shows the reason when the list fails to load', async () => {
    getTeacherMaterials.mockRejectedValue({ response: { data: { detail: 'Server down' } } })
    renderWithRouter(<TeacherMaterials />)
    expect((await screen.findAllByText('Server down')).length).toBeGreaterThan(0)
  })

  it('shares a link with a class and adds it to the list', async () => {
    const created = { ...VIDEO, id: 'm3', title: 'Khan Academy: fractions', kind: 'link', url: 'https://khanacademy.org/f', class_id: 'c1', class_name: 'S4A' }
    createTeacherMaterial.mockResolvedValue(created)
    renderWithRouter(<TeacherMaterials />)
    await screen.findByRole('link', { name: 'Week 3 notes' })

    fireEvent.click(screen.getByRole('button', { name: /Share material/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Title *'), { target: { value: 'Khan Academy: fractions' } })
    pickClass(dialog, 'S4A')
    fireEvent.click(within(dialog).getByLabelText('A link or video'))
    fireEvent.change(within(dialog).getByLabelText('Link *'), { target: { value: 'https://khanacademy.org/f' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Share material' }))

    await waitFor(() => expect(createTeacherMaterial).toHaveBeenCalledWith({
      title: 'Khan Academy: fractions', description: '', class_obj: 'c1', subject: 's1',
      url: 'https://khanacademy.org/f',
    }))
    expect(await screen.findByRole('link', { name: 'Khan Academy: fractions' })).toBeInTheDocument()
  })

  it('keeps the form open with the reason when saving fails', async () => {
    createTeacherMaterial.mockRejectedValue({ response: { data: { detail: 'You can only share materials with a class and subject you teach.' } } })
    renderWithRouter(<TeacherMaterials />)
    await screen.findByRole('link', { name: 'Week 3 notes' })

    fireEvent.click(screen.getByRole('button', { name: /Share material/ }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Title *'), { target: { value: 'Notes' } })
    pickClass(dialog, 'S4A')
    fireEvent.click(within(dialog).getByLabelText('A link or video'))
    fireEvent.change(within(dialog).getByLabelText('Link *'), { target: { value: 'https://example.com/n' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Share material' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('class and subject you teach')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('refuses a file over 25 MB before uploading it', async () => {
    renderWithRouter(<TeacherMaterials />)
    await screen.findByRole('link', { name: 'Week 3 notes' })
    fireEvent.click(screen.getByRole('button', { name: /Share material/ }))
    const dialog = screen.getByRole('dialog')

    const big = new File(['x'], 'huge.mp4', { type: 'video/mp4' })
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 })
    fireEvent.change(within(dialog).getByLabelText('Choose a file'), { target: { files: [big] } })

    expect(within(dialog).getByRole('alert')).toHaveTextContent('larger than 25 MB')
    expect(within(dialog).getByRole('button', { name: 'Share material' })).toBeDisabled()
  })

  it('edits a material without resending its file', async () => {
    updateTeacherMaterial.mockResolvedValue({ ...NOTES, title: 'Week 3 notes (revised)' })
    renderWithRouter(<TeacherMaterials />)
    await screen.findByRole('link', { name: 'Week 3 notes' })

    fireEvent.click(screen.getByRole('button', { name: 'Edit Week 3 notes' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('notes.pdf')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Title *'), { target: { value: 'Week 3 notes (revised)' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateTeacherMaterial).toHaveBeenCalledWith('m1', {
      title: 'Week 3 notes (revised)', description: 'Fractions', class_obj: 'c1', subject: 's1',
    }))
    expect(await screen.findByRole('link', { name: 'Week 3 notes (revised)' })).toBeInTheDocument()
  })

  it('deletes a material after confirming', async () => {
    deleteTeacherMaterial.mockResolvedValue()
    renderWithRouter(<TeacherMaterials />)
    await screen.findByRole('link', { name: 'Week 3 notes' })

    fireEvent.click(screen.getByRole('button', { name: 'Delete Week 3 notes' }))

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Week 3 notes' })).not.toBeInTheDocument())
    expect(deleteTeacherMaterial).toHaveBeenCalledWith('m1')
  })
})
