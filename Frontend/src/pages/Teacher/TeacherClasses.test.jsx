import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { TeacherClasses } from './TeacherClasses'
import {
  getTeacherMyClasses, getTeacherStudents, getTeacherResultList,
} from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
  getTeacherMyClasses: vi.fn(),
  getTeacherStudents: vi.fn(),
  getTeacherResultList: vi.fn(),
  bulkSaveResults: vi.fn(),
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

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close    = function () { this.removeAttribute('open') }
})

// One class taught two subjects, as the seed has it, plus an A-Level class.
const CLASSES = [
  { class_id: 1, class_name: 'S1A', grade: 'S1', section: 'A', subject_name: 'Mathematics', subject_id: 10, student_count: 25, avg_score: 72, room_number: 'Room 100' },
  { class_id: 1, class_name: 'S1A', grade: 'S1', section: 'A', subject_name: 'English',     subject_id: 11, student_count: 25, avg_score: null },
  { class_id: 2, class_name: 'S4B', grade: 'S4', section: 'B', subject_name: 'Physics',     subject_id: 12, student_count: 18, avg_score: 64, room_number: '12' },
]

const STUDENTS = [
  { student_id: 1, full_name: 'Alice Mukamana',   student_code: 'STU001', class_name: 'S1A', initials: 'AM', attendance_rate: 92, performance_rate: 78 },
  { student_id: 2, full_name: 'Bob Nshimiyimana', student_code: 'STU002', class_name: 'S4B', initials: 'BN', attendance_rate: 85, performance_rate: 45 },
]

function renderPage(route = '/teacher/classes') {
  getTeacherMyClasses.mockResolvedValue(CLASSES)
  getTeacherStudents.mockResolvedValue(STUDENTS)
  getTeacherResultList.mockResolvedValue({ assessment_titles: [], results: [] })
  return renderWithRouter(<TeacherClasses />, { route })
}

const openStudentsTab = () => fireEvent.click(screen.getByRole('tab', { name: /Students/ }))

describe('TeacherClasses — Classes & Students', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('classes tab', () => {
    it('renders the merged page heading', async () => {
      renderPage()
      await waitFor(() => expect(screen.getByRole('heading', { name: /Classes & Students/ })).toBeInTheDocument())
    })

    it('renders a card per class and subject, with student counts', async () => {
      renderPage()
      await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
      expect(within(screen.getByRole('main')).getByText('English', { selector: '.class-subject' })).toBeInTheDocument()
      expect(screen.getAllByText('25').length).toBeGreaterThan(0)
    })

    it('does not print "Room" twice for a room that is already named', async () => {
      renderPage()
      await waitFor(() => expect(screen.getByText('Room 100')).toBeInTheDocument())
      expect(screen.queryByText('Room Room 100')).not.toBeInTheDocument()
      expect(screen.getByText('Room 12')).toBeInTheDocument()     // a bare code still gets the word
    })

    it('filters by section using the school configuration', async () => {
      // Both old pages decided the section with parseInt("S1") — NaN — so any
      // section choice emptied the page.
      renderPage()
      await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
      await waitFor(() => expect(screen.getByRole('option', { name: 'O-Level' })).toBeInTheDocument())

      fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'O-Level' } })

      expect(screen.getByText('Mathematics')).toBeInTheDocument()
      expect(screen.queryByText('Physics')).not.toBeInTheDocument()
    })
  })

  describe('students tab', () => {
    it('opens straight onto the Students tab from /teacher/classes?tab=students', async () => {
      renderPage('/teacher/classes?tab=students')
      await waitFor(() => expect(screen.getByText('Alice Mukamana')).toBeInTheDocument())
      expect(screen.getByRole('tab', { name: /Students/ })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText('Bob Nshimiyimana')).toBeInTheDocument()
      expect(screen.getByText('STU001')).toBeInTheDocument()
    })

    it('"View Students" on a card switches tab with that class already picked', async () => {
      renderPage()
      await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())

      fireEvent.click(screen.getAllByRole('button', { name: /View Students/ })[0])

      expect(screen.getByRole('tab', { name: /Students/ })).toHaveAttribute('aria-selected', 'true')
      await waitFor(() => expect(screen.getByText('Alice Mukamana')).toBeInTheDocument())
      expect(screen.queryByText('Bob Nshimiyimana')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Class')).toHaveValue('A')
    })

    it('filters students by name search', async () => {
      renderPage()
      await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
      openStudentsTab()
      await waitFor(() => expect(screen.getByText('Alice Mukamana')).toBeInTheDocument())

      fireEvent.change(screen.getByPlaceholderText(/Search by name or student code/), { target: { value: 'Bob' } })

      expect(screen.queryByText('Alice Mukamana')).not.toBeInTheDocument()
      expect(screen.getByText('Bob Nshimiyimana')).toBeInTheDocument()
    })

    it('filters students by performance band', async () => {
      renderPage()
      await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
      openStudentsTab()
      await waitFor(() => expect(screen.getByText('Alice Mukamana')).toBeInTheDocument())

      fireEvent.change(screen.getByLabelText('Filter by performance'), { target: { value: 'low' } })

      expect(screen.queryByText('Alice Mukamana')).not.toBeInTheDocument()
      expect(screen.getByText('Bob Nshimiyimana')).toBeInTheDocument()
    })

    it('loads the students once, not again on every class change', async () => {
      renderPage()
      await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
      await waitFor(() => expect(screen.getByRole('option', { name: 'S1' })).toBeInTheDocument())
      fireEvent.change(screen.getByLabelText('Year'), { target: { value: 'S1' } })
      fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'A' } })
      expect(getTeacherStudents).toHaveBeenCalledTimes(1)
    })
  })

  describe('student profile', () => {
    it('opens the profile and goes from there to entering results for a subject', async () => {
      renderPage('/teacher/classes?tab=students')
      await waitFor(() => expect(screen.getByText('Alice Mukamana')).toBeInTheDocument())

      fireEvent.click(screen.getAllByRole('button', { name: /View/ })[0])

      expect(screen.getByRole('heading', { name: /Student Profile/ })).toBeInTheDocument()
      expect(screen.getByText('Alice Mukamana', { selector: '.student-profile-name' })).toBeInTheDocument()
      // S1A is taught two subjects by this teacher: one button each.
      expect(screen.getByRole('button', { name: 'Enter results: English' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Enter results: Mathematics' }))

      await waitFor(() => expect(screen.getByRole('heading', { name: /Enter Results for S1A/ })).toBeInTheDocument())
      expect(screen.queryByRole('heading', { name: /Student Profile/ })).not.toBeInTheDocument()
    })
  })
})
