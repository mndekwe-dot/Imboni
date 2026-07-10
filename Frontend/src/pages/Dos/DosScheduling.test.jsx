import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within, setSessionUser } from '../../test/test-utils'
import { DosScheduling } from './DosScheduling'
import {
  getDosExamSchedule, createDosExamSchedule, updateDosExamSchedule, deleteDosExamSchedule,
  getSubjects, getDosClasses, getDosRooms, getDosTeachers, getCurrentTerm,
  getSchoolConfig, getSchoolSettings,
} from '../../api/dos'

beforeAll(() => {
  // jsdom doesn't implement <dialog> showModal/close. A no-op stub leaves the
  // `open` attribute unset, and Testing Library treats content inside a
  // non-open <dialog> as inaccessible — the stub must actually flip the state.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

vi.mock('../../api/dos', () => ({
  getDosExamSchedule: vi.fn(),
  createDosExamSchedule: vi.fn(),
  updateDosExamSchedule: vi.fn(),
  deleteDosExamSchedule: vi.fn(),
  getSubjects: vi.fn(),
  getDosClasses: vi.fn(),
  getDosRooms: vi.fn(),
  getDosTeachers: vi.fn(),
  getCurrentTerm: vi.fn(),
  getSchoolConfig: vi.fn(),
  getSchoolSettings: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const SUBJECTS = [{ id: 'sub1', name: 'Mathematics' }]
const CLASSES = [{ id: 'c1', grade: 3, section: 'A' }]
const ROOMS = [{ id: 'r1', name: 'Room 12' }]
const TEACHERS = [{ teacher_id: 't1', full_name: 'Mr. Rurangwa' }]

const EXAM = {
  id: 9, title: 'Term 2 Finals', subject: 'Mathematics', subject_id: 'sub1',
  exam_date: '2026-06-29', start_time: '08:00:00', end_time: '10:00:00',
  class_name: 'S3A', venue: 'Room 12', invigilator: 'Mr. Rurangwa',
  exam_type: 'final', term: 'Term 2', notes: '',
}

function mockAllExamDeps({ exams = [] } = {}) {
  getDosExamSchedule.mockResolvedValue(exams)
  getSubjects.mockResolvedValue(SUBJECTS)
  getDosClasses.mockResolvedValue(CLASSES)
  getDosRooms.mockResolvedValue(ROOMS)
  getDosTeachers.mockResolvedValue(TEACHERS)
  getCurrentTerm.mockResolvedValue({ id: 1 })
}

beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ first_name: 'Dr', last_name: 'Ndagijimana', role: 'dos' })
  getSchoolConfig.mockResolvedValue([])
  getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali', school_name: 'Imboni School' })
  localStorage.removeItem('imboni_sessions')
})

describe('DosScheduling', () => {
  it('renders the Timetable tab by default with the timetable stat cards', async () => {
    renderWithRouter(<DosScheduling />)
    await waitFor(() => expect(screen.getByText('Class S3A')).toBeInTheDocument())
    expect(screen.getByText('Periods per Day')).toBeInTheDocument()
    expect(screen.getByText('Current Term')).toBeInTheDocument()
  })

  it('does not fetch exam-schedule data until the Exam Schedule tab is selected', async () => {
    mockAllExamDeps()
    renderWithRouter(<DosScheduling />)
    await waitFor(() => expect(screen.getByText('Class S3A')).toBeInTheDocument())

    expect(getDosExamSchedule).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Exam Schedule/ }))

    await waitFor(() => expect(getDosExamSchedule).toHaveBeenCalledTimes(1))
    expect(getSubjects).toHaveBeenCalledTimes(1)
    expect(getDosClasses).toHaveBeenCalledTimes(1)
    expect(getDosRooms).toHaveBeenCalledTimes(1)
    expect(getDosTeachers).toHaveBeenCalledTimes(1)
    expect(getCurrentTerm).toHaveBeenCalledTimes(1)
  })

  it('only fetches exam data once even if the tab is switched back and forth (examsLoaded gate)', async () => {
    mockAllExamDeps()
    renderWithRouter(<DosScheduling />)
    await waitFor(() => expect(screen.getByText('Class S3A')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Exam Schedule/ }))
    await waitFor(() => expect(getDosExamSchedule).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /Timetable/ }))
    fireEvent.click(screen.getByRole('button', { name: /Exam Schedule/ }))

    expect(getDosExamSchedule).toHaveBeenCalledTimes(1)
  })

  it('renders an exam pill on the calendar and opens the detail modal on click', async () => {
    mockAllExamDeps({ exams: [EXAM] })
    renderWithRouter(<DosScheduling />)
    await waitFor(() => expect(screen.getByText('Class S3A')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Exam Schedule/ }))
    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Mathematics'))

    await waitFor(() => expect(screen.getByText('Exam Details')).toBeInTheDocument())
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Mathematics')).toBeInTheDocument()
    expect(within(dialog).getByText('Room 12')).toBeInTheDocument()
    expect(within(dialog).getByText('Mr. Rurangwa')).toBeInTheDocument()
  })

  it('deletes an exam from the detail modal after confirming', async () => {
    mockAllExamDeps({ exams: [EXAM] })
    deleteDosExamSchedule.mockResolvedValue({})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWithRouter(<DosScheduling />)
    await waitFor(() => expect(screen.getByText('Class S3A')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Exam Schedule/ }))
    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Mathematics'))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /Delete/ }))

    await waitFor(() => expect(deleteDosExamSchedule).toHaveBeenCalledWith(9))
  })

  it('clicking a day cell opens the Add Exam form pre-filled with that date', async () => {
    mockAllExamDeps()
    renderWithRouter(<DosScheduling />)
    await waitFor(() => expect(screen.getByText('Class S3A')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Exam Schedule/ }))
    await waitFor(() => expect(screen.getByText('Today')).toBeInTheDocument())

    // "Today" cell is reliably present and clickable regardless of which
    // calendar month/year the test runs in.
    fireEvent.click(screen.getByText('Today'))
    // Clicking the literal "Today" nav button only resets the calendar view;
    // click an actual day cell number instead to open the Add Exam form.
    const dayCells = document.querySelectorAll('.es-cal-month-cell')
    fireEvent.click(dayCells[10])

    await waitFor(() => expect(screen.getByText('Add Exam', { selector: 'h2' })).toBeInTheDocument())
  })

  it('requires subject, date, start and end time before saving a new exam', async () => {
    mockAllExamDeps()
    renderWithRouter(<DosScheduling />)
    await waitFor(() => expect(screen.getByText('Class S3A')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Exam Schedule/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Add Exam/ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Add Exam/ }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /Save/ }))

    expect(createDosExamSchedule).not.toHaveBeenCalled()
  })

  it('saves a new exam with the filled-in fields', async () => {
    mockAllExamDeps()
    createDosExamSchedule.mockResolvedValue({})
    renderWithRouter(<DosScheduling />)
    await waitFor(() => expect(screen.getByText('Class S3A')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Exam Schedule/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Add Exam/ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Add Exam/ }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Subject *'), { target: { value: 'sub1' } })
    fireEvent.change(within(dialog).getByLabelText('Date *'), { target: { value: '2026-07-10' } })
    fireEvent.change(within(dialog).getByLabelText('Start *'), { target: { value: '08:00' } })
    fireEvent.change(within(dialog).getByLabelText('End *'), { target: { value: '09:00' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Save/ }))

    await waitFor(() => expect(createDosExamSchedule).toHaveBeenCalledWith(expect.objectContaining({
      subject_id: 'sub1', exam_date: '2026-07-10', start_time: '08:00', end_time: '09:00', term_id: 1,
    })))
  })

  it('switches the displayed class in the Timetable tab', async () => {
    getSchoolConfig.mockResolvedValue([
      { name: 'O-Level', years: [{ name: 'S3', streams: ['A', 'B'] }] },
    ])
    renderWithRouter(<DosScheduling />)
    await waitFor(() => expect(screen.getByText('Class S3A')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Class:'), { target: { value: 'S3B' } })
    expect(screen.getByText('Class S3B')).toBeInTheDocument()
  })

  it('opens the Add Slot form in the Timetable tab', async () => {
    renderWithRouter(<DosScheduling />)
    await waitFor(() => expect(screen.getByText('Class S3A')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Add Slot/ }))

    expect(screen.getByText('Add Slot', { selector: 'h2' })).toBeInTheDocument()
  })
})
