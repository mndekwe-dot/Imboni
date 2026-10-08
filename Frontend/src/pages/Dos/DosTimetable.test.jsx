import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import {
  DosTimetablePanel, periodTimes, buildMovePayload, periodsFromApi, periodsToApi, slotsToSchedules,
} from './DosTimetable'
import {
  getDosClasses, getDosTimetable, saveDosSlot, updateDosSlot, deleteDosSlot,
  getSubjects, getDosTeachersBySubjectAndClass, getDosRooms,
  getTerms, generateDosTimetable, commitDosTimetable,
  getTimetablePeriods, saveTimetablePeriods, getSchoolConfig,
} from '../../api/dos'

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
  getTimetablePeriods: vi.fn(),
  saveTimetablePeriods: vi.fn(),
  getSchoolConfig: vi.fn(),
}))

beforeAll(() => {
  // jsdom doesn't implement <dialog> showModal/close; the stub must flip `open`
  // or Testing Library treats the dialog's content as inaccessible.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

const CLASSES = [
  { id: 'c1', grade: 'S3', section: 'A' },
  { id: 'c2', grade: 'S3', section: 'B' },
]
const SUBJECTS = [
  { id: 'sub1', name: 'Mathematics' },
  { id: 'sub2', name: 'English' },
]
const ROOMS = [{ id: 'r1', name: 'Room 12' }]

// The school's bell schedule: real lesson times, not the sample 8:00/8:40 day.
const BELLS = {
  source: 'school',
  periods: [
    { label: 'Period 1', start_time: '07:30', end_time: '08:30', is_break: false },
    { label: 'Break',    start_time: '08:30', end_time: '09:00', is_break: true },
    { label: 'Period 2', start_time: '09:00', end_time: '10:00', is_break: false },
  ],
}

const TIMETABLE_DATA = {
  slots: [{
    id: 501, day: 'monday', start_time: '07:30', end_time: '08:30',
    subject_name: 'Mathematics', teacher_name: 'Mr. Rurangwa', room: 'Room 12',
    subject_id: 'sub1', teacher_id: 't1',
  }],
}

beforeEach(() => {
  vi.clearAllMocks()
  getSchoolConfig.mockResolvedValue([])
  getDosClasses.mockResolvedValue(CLASSES)
  getSubjects.mockResolvedValue(SUBJECTS)
  getDosRooms.mockResolvedValue(ROOMS)
  getTerms.mockResolvedValue([{ id: 1, name: 'Term 2', year: 2026, is_current: true }])
  getTimetablePeriods.mockResolvedValue(BELLS)
  getDosTimetable.mockResolvedValue({ slots: [] })
})

const heading = name => screen.findByText(`Class ${name}: Weekly Timetable`)

function openCellEditor(subject) {
  const cell = screen.getByText(subject).closest('td')
  const editBtn = within(cell).getAllByRole('button').find(b => b.getAttribute('aria-label') !== 'Drag to move this lesson')
  fireEvent.click(editBtn)
}

describe('DosTimetablePanel', () => {
  it('shows the loading state while the timetable is fetched', async () => {
    getDosTimetable.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DosTimetablePanel />)
    expect(await screen.findByText('Loading timetable…')).toBeInTheDocument()
  })

  it("lays the first class's lessons on the school's bell schedule", async () => {
    getDosTimetable.mockResolvedValue(TIMETABLE_DATA)
    renderWithRouter(<DosTimetablePanel />)

    await waitFor(() => expect(getDosTimetable).toHaveBeenCalledWith('c1'))
    expect(await screen.findByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('Class S3A: Weekly Timetable')).toBeInTheDocument()
    expect(screen.getByText('Break')).toBeInTheDocument()
  })

  it('says where its rows come from when the school has not saved a bell schedule', async () => {
    getTimetablePeriods.mockResolvedValue({ ...BELLS, source: 'lessons' })
    renderWithRouter(<DosTimetablePanel />)
    expect(await screen.findByText(/come from the times your lessons already use/)).toBeInTheDocument()
  })

  it('saves a new lesson at the chosen period with the correct payload', async () => {
    saveDosSlot.mockResolvedValue({})
    getDosTeachersBySubjectAndClass.mockResolvedValue([])
    renderWithRouter(<DosTimetablePanel />)
    await heading('S3A')

    fireEvent.click(screen.getByRole('button', { name: /Add Slot/ }))
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: 'Monday' } })
    // Breaks are not offered as a lesson period.
    expect(within(screen.getByLabelText('Period')).queryByText(/Break/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'sub1' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))

    await waitFor(() => expect(saveDosSlot).toHaveBeenCalledWith({
      class_id: 'c1', subject_id: 'sub1', teacher_id: null,
      day: 'monday', start_time: '09:00', end_time: '10:00', room: '',
    }))
  })

  it('keeps the form open and says so when saving fails', async () => {
    saveDosSlot.mockRejectedValue({ response: { status: 400, data: { error: 'No active term.' } } })
    renderWithRouter(<DosTimetablePanel />)
    await heading('S3A')

    fireEvent.click(screen.getByRole('button', { name: /Add Slot/ }))
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: 'Monday' } })
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: '07:30' } })
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'sub1' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))

    expect(await screen.findByText('No active term.')).toBeInTheDocument()
    expect(screen.getByText('Add Slot', { selector: 'h2' })).toBeInTheDocument()
  })

  it('edits an existing lesson through updateDosSlot', async () => {
    getDosTimetable.mockResolvedValue(TIMETABLE_DATA)
    getDosTeachersBySubjectAndClass.mockResolvedValue([{ teacher_id: 't1', full_name: 'Mr. Rurangwa' }])
    updateDosSlot.mockResolvedValue({})
    renderWithRouter(<DosTimetablePanel />)

    await screen.findByText('Mathematics')
    openCellEditor('Mathematics')
    await screen.findByText('Edit Slot', { selector: 'h2' })
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))

    await waitFor(() => expect(updateDosSlot).toHaveBeenCalledWith(501, expect.objectContaining({
      class_id: 'c1', day: 'monday', start_time: '07:30',
    })))
  })

  it('deletes a lesson from the edit form', async () => {
    getDosTimetable.mockResolvedValue(TIMETABLE_DATA)
    getDosTeachersBySubjectAndClass.mockResolvedValue([])
    deleteDosSlot.mockResolvedValue({})
    renderWithRouter(<DosTimetablePanel />)

    await screen.findByText('Mathematics')
    openCellEditor('Mathematics')
    fireEvent.click(await screen.findByRole('button', { name: /Delete/ }))

    await waitFor(() => expect(deleteDosSlot).toHaveBeenCalledWith(501))
  })

  it('switches class with the class picker', async () => {
    renderWithRouter(<DosTimetablePanel />)
    await heading('S3A')

    fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'B' } })

    await waitFor(() => expect(getDosTimetable).toHaveBeenCalledWith('c2'))
    expect(await heading('S3B')).toBeInTheDocument()
  })

  it('saves edited periods as the bell schedule when the editor closes', async () => {
    saveTimetablePeriods.mockImplementation(rows => Promise.resolve({ source: 'school', periods: rows }))
    renderWithRouter(<DosTimetablePanel />)
    await heading('S3A')

    fireEvent.click(screen.getByRole('button', { name: /Edit Periods/ }))
    fireEvent.change(screen.getByDisplayValue('Period 1'), { target: { value: 'Morning' } })
    fireEvent.click(screen.getByRole('button', { name: /Done/ }))

    await waitFor(() => expect(saveTimetablePeriods).toHaveBeenCalledWith([
      { label: 'Morning',  start_time: '07:30', end_time: '08:30', is_break: false },
      { label: 'Break',    start_time: '08:30', end_time: '09:00', is_break: true },
      { label: 'Period 2', start_time: '09:00', end_time: '10:00', is_break: false },
    ]))
  })

  it('refuses a period whose time cannot be read, without saving', async () => {
    renderWithRouter(<DosTimetablePanel />)
    await heading('S3A')

    fireEvent.click(screen.getByRole('button', { name: /Edit Periods/ }))
    fireEvent.change(screen.getByDisplayValue('07:30 - 08:30'), { target: { value: 'morning' } })
    fireEvent.click(screen.getByRole('button', { name: /Done/ }))

    expect(await screen.findByText(/Check the time of/)).toBeInTheDocument()
    expect(saveTimetablePeriods).not.toHaveBeenCalled()
  })

  it('generates a preview then commits it via the Generate modal', async () => {
    getTerms.mockResolvedValue([{ id: 't1', name: 'Term 1', year: 2026, is_current: true }])
    generateDosTimetable.mockResolvedValue({
      assignments: [{
        subject_name: 'Geography', class_name: 'S3A', day: 'Monday',
        start_time: '07:30', end_time: '08:30', teacher_name: 'Ms. Ingabire', room: 'Room 9',
      }],
      unscheduled: [],
      summary: { total_lessons: 1, scheduled: 1, unscheduled: 0, slots_available: 10, venues: 2 },
      warnings: [],
    })
    commitDosTimetable.mockResolvedValue({ created: 1, unscheduled: [], summary: {}, warnings: [] })

    renderWithRouter(<DosTimetablePanel />)
    await heading('S3A')

    fireEvent.click(screen.getByRole('button', { name: /Generate/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Preview/i }))
    expect(await screen.findByText('Geography')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Save 1 lesson/i }))
    await waitFor(() => expect(commitDosTimetable).toHaveBeenCalled())
  })
})

describe('timetable helpers', () => {
  it('periodTimes zero-pads a "8:00 - 8:40" label into HH:MM', () => {
    expect(periodTimes({ time: '8:00 - 8:40' })).toEqual({ start_time: '08:00', end_time: '08:40' })
    expect(periodTimes({ time: '10:20 - 11:00' })).toEqual({ start_time: '10:20', end_time: '11:00' })
  })

  it('buildMovePayload keeps subject/teacher/room and targets the new day + period', () => {
    const cell = { _id: 's1', subject: 'Maths', subjectId: 'sub1', teacherId: 't1', room: 'R101' }
    expect(buildMovePayload(cell, { id: 3, time: '11:10 - 11:50' }, 'Tuesday')).toEqual({
      day: 'tuesday', start_time: '11:10', end_time: '11:50',
      subject_id: 'sub1', teacher_id: 't1', room_number: 'R101',
    })
  })

  it('buildMovePayload sends null teacher and empty room when absent', () => {
    const payload = buildMovePayload({ _id: 's2', subjectId: 'sub2' }, { id: 1, time: '8:00 - 8:40' }, 'Monday')
    expect(payload.teacher_id).toBeNull()
    expect(payload.room_number).toBe('')
  })

  it('round-trips the bell schedule between the API and the grid', () => {
    const rows = periodsFromApi(BELLS.periods)
    expect(rows[1]).toEqual({ id: '08:30', label: 'Break', time: '08:30 - 09:00', isBreak: true })
    expect(periodsToApi(rows)).toEqual({ rows: BELLS.periods })
  })

  it('periodsToApi names a backwards period instead of saving it', () => {
    expect(periodsToApi([{ label: 'Late', time: '10:00 - 9:00' }])).toEqual({ error: 'Late' })
  })

  it('slotsToSchedules draws breaks on every day and skips lessons off the schedule', () => {
    const periods = periodsFromApi(BELLS.periods)
    const slots = [
      ...TIMETABLE_DATA.slots,
      { id: 9, day: 'tuesday', start_time: '13:00', subject_name: 'Art' },
    ]
    const week = slotsToSchedules('c1', slots, periods).c1
    expect(week.Monday[0].subject).toBe('Mathematics')
    expect(week.Saturday[1]).toEqual({ type: 'break', subject: 'Break' })
    expect(week.Tuesday.filter(Boolean)).toHaveLength(1)
  })
})
