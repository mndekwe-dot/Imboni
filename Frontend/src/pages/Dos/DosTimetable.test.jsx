import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, setSessionUser, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { DosTimetable, periodTimes, buildMovePayload } from './DosTimetable'
import {
  getDosClasses, getDosTimetable, saveDosSlot, updateDosSlot, deleteDosSlot,
  getSubjects, getDosTeachersBySubjectAndClass, getDosRooms,
  getTerms, generateDosTimetable, commitDosTimetable,
} from '../../api/dos'
import { getNotifications } from '../../api/notifications'

vi.mock('../../api/dos', () => ({
  getDosClasses: vi.fn(),
  getDosTimetable: vi.fn(),
  saveDosSlot: vi.fn(),
  updateDosSlot: vi.fn(),
  deleteDosSlot: vi.fn(),
  getSubjects: vi.fn(),
  getDosTeachersBySubjectAndClass: vi.fn(),
  getDosRooms: vi.fn(),
  getTerms: vi.fn(),
  generateDosTimetable: vi.fn(),
  commitDosTimetable: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}))

beforeAll(() => {
  // jsdom doesn't implement <dialog> showModal/close. A no-op stub leaves the
  // `open` attribute unset, and Testing Library treats content inside a
  // non-open <dialog> as inaccessible to role/text queries — the stub must
  // actually flip the open state.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

const CLASSES = [
  { id: 'c1', grade: 3, section: 'A' },
  { id: 'c2', grade: 3, section: 'B' },
]

const SUBJECTS = [
  { id: 'sub1', name: 'Mathematics' },
  { id: 'sub2', name: 'English' },
]

const ROOMS = [{ id: 'r1', name: 'Room 12' }]

const TIMETABLE_DATA = {
  slots: [
    {
      id: 501, day: 'monday', start_time: '08:00', end_time: '08:40',
      subject_name: 'Mathematics', teacher_name: 'Mr. Rurangwa', room: 'Room 12',
      subject_id: 'sub1', teacher_id: 't1',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ first_name: 'Aline', last_name: 'Uwimana', role: 'dos' })
  getNotifications.mockResolvedValue([])
  getDosClasses.mockResolvedValue(CLASSES)
  getSubjects.mockResolvedValue(SUBJECTS)
  getDosRooms.mockResolvedValue(ROOMS)
  getDosTimetable.mockResolvedValue({ slots: [] })
})

describe('DosTimetable', () => {
  it('shows the timetable loading state while fetching', async () => {
    getDosTimetable.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DosTimetable />)
    await waitFor(() => expect(screen.getByText('Loading timetable…')).toBeInTheDocument())
  })

  it('loads classes and renders the first class timetable with mapped slot data', async () => {
    getDosTimetable.mockResolvedValue(TIMETABLE_DATA)
    renderWithRouter(<DosTimetable />)

    await waitFor(() => expect(getDosTimetable).toHaveBeenCalledWith('c1'))
    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
    expect(screen.getByText('Class S3A: Weekly Timetable')).toBeInTheDocument()
  })

  it('renders an empty timetable without crashing when classes/subjects load correctly (regression for the res.data unwrap bug)', async () => {
    // getDosClasses/getSubjects/getDosRooms resolve already-unwrapped data (the
    // client.js response interceptor strips axios's `.data` envelope) — the page
    // must consume them directly rather than reaching for a non-existent `.data`.
    renderWithRouter(<DosTimetable />)
    await waitFor(() => expect(screen.getByText('Class S3A: Weekly Timetable')).toBeInTheDocument())
  })

  it('opens the add-slot form and saves a new slot with the correct payload', async () => {
    getDosTimetable.mockResolvedValue({ slots: [] })
    saveDosSlot.mockResolvedValue({})
    getDosTeachersBySubjectAndClass.mockResolvedValue([])
    renderWithRouter(<DosTimetable />)

    await waitFor(() => expect(screen.getByText('Class S3A: Weekly Timetable')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Add Slot/ }))
    expect(screen.getByText('Add Slot', { selector: 'h2' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Day'), { target: { value: 'Monday' } })
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'sub1' } })

    fireEvent.click(screen.getByRole('button', { name: /Save/  }))

    await waitFor(() => expect(saveDosSlot).toHaveBeenCalledWith({
      class_id: 'c1',
      subject_id: 'sub1',
      teacher_id: null,
      day: 'monday',
      start_time: '08:00',
      end_time: '08:40',
      room: '',
    }))
  })

  it('edits an existing slot and calls updateDosSlot with the slot id', async () => {
    getDosTimetable.mockResolvedValue(TIMETABLE_DATA)
    getDosTeachersBySubjectAndClass.mockResolvedValue([{ teacher_id: 't1', full_name: 'Mr. Rurangwa' }])
    updateDosSlot.mockResolvedValue({})
    renderWithRouter(<DosTimetable />)

    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())

    // The subject text itself isn't clickable — only the small edit-icon
    // button inside the same cell opens the edit form.
    const cell = screen.getByText('Mathematics').closest('td')
    const editBtn = within(cell).getAllByRole('button').find(b => b.getAttribute('aria-label') !== 'Drag to move this lesson')
    fireEvent.click(editBtn)

    await waitFor(() => expect(screen.getByText('Edit Slot', { selector: 'h2' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Save/  }))

    await waitFor(() => expect(updateDosSlot).toHaveBeenCalledWith(501, expect.objectContaining({
      class_id: 'c1',
      day: 'monday',
    })))
  })

  it('deletes a slot when Delete is clicked in the edit form', async () => {
    getDosTimetable.mockResolvedValue(TIMETABLE_DATA)
    getDosTeachersBySubjectAndClass.mockResolvedValue([])
    deleteDosSlot.mockResolvedValue({})
    renderWithRouter(<DosTimetable />)

    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
    const cell = screen.getByText('Mathematics').closest('td')
    const editBtn = within(cell).getAllByRole('button').find(b => b.getAttribute('aria-label') !== 'Drag to move this lesson')
    fireEvent.click(editBtn)

    await waitFor(() => expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }))

    await waitFor(() => expect(deleteDosSlot).toHaveBeenCalledWith(501))
  })

  it('switches the displayed class when a different class is selected', async () => {
    getDosTimetable.mockResolvedValue({ slots: [] })
    renderWithRouter(<DosTimetable />)

    await waitFor(() => expect(screen.getByText('Class S3A: Weekly Timetable')).toBeInTheDocument())

    // The class Select auto-selects the first class on load, so its trigger
    // shows the current label ("S3A"), not the "Select class" placeholder.
    fireEvent.click(screen.getByText('S3A'))
    fireEvent.click(screen.getByText('S3B'))

    await waitFor(() => expect(getDosTimetable).toHaveBeenCalledWith('c2'))
    expect(screen.getByText('Class S3B: Weekly Timetable')).toBeInTheDocument()
  })

  it('generates a preview then commits it via the Generate modal', async () => {
    getDosTimetable.mockResolvedValue({ slots: [] })
    getTerms.mockResolvedValue([{ id: 't1', name: 'Term 1', year: 2026, is_current: true }])
    generateDosTimetable.mockResolvedValue({
      assignments: [{
        subject_name: 'Geography', class_name: 'S3A', day: 'Monday',
        start_time: '08:00', end_time: '08:40', teacher_name: 'Ms. Ingabire', room: 'Room 9',
      }],
      unscheduled: [],
      summary: { total_lessons: 1, scheduled: 1, unscheduled: 0, slots_available: 10, venues: 2 },
      warnings: [],
    })
    commitDosTimetable.mockResolvedValue({ created: 1, unscheduled: [], summary: {}, warnings: [] })

    renderWithRouter(<DosTimetable />)
    await waitFor(() => expect(screen.getByText('Class S3A: Weekly Timetable')).toBeInTheDocument())

    // Open the modal.
    fireEvent.click(screen.getByRole('button', { name: /Generate/i }))
    await waitFor(() => expect(getTerms).toHaveBeenCalled())

    // Preview the generated plan.
    fireEvent.click(screen.getByRole('button', { name: /Preview/i }))
    await waitFor(() => expect(generateDosTimetable).toHaveBeenCalled())
    // Preview table renders the proposed lesson.
    await waitFor(() => expect(screen.getByText('Geography')).toBeInTheDocument())
    expect(screen.getByText('Ms. Ingabire')).toBeInTheDocument()

    // Commit persists it.
    fireEvent.click(screen.getByRole('button', { name: /Save 1 lesson/i }))
    await waitFor(() => expect(commitDosTimetable).toHaveBeenCalled())
  })
})

describe('drag-to-move helpers', () => {
  it('periodTimes zero-pads a "8:00 - 8:40" label into HH:MM', () => {
    expect(periodTimes({ time: '8:00 - 8:40' })).toEqual({ start_time: '08:00', end_time: '08:40' })
    expect(periodTimes({ time: '10:20 - 11:00' })).toEqual({ start_time: '10:20', end_time: '11:00' })
  })

  it('buildMovePayload keeps subject/teacher/room and targets the new day + period', () => {
    const cell = { _id: 's1', subject: 'Maths', subjectId: 'sub1', teacherId: 't1', room: 'R101' }
    const targetPeriod = { id: 3, time: '11:10 - 11:50' }

    const payload = buildMovePayload(cell, targetPeriod, 'Tuesday')

    expect(payload).toEqual({
      day: 'tuesday',
      start_time: '11:10',
      end_time: '11:50',
      subject_id: 'sub1',
      teacher_id: 't1',
      room_number: 'R101',
    })
  })

  it('buildMovePayload sends null teacher and empty room when absent', () => {
    const cell = { _id: 's2', subjectId: 'sub2' }
    const payload = buildMovePayload(cell, { id: 1, time: '8:00 - 8:40' }, 'Monday')
    expect(payload.teacher_id).toBeNull()
    expect(payload.room_number).toBe('')
  })
})
