import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent, within } from '../../test/test-utils'
import { DosExamSchedule } from './DosExamSchedule'
import {
  getDosExamSchedule, deleteDosExamSchedule, getSchoolSettings,
  getTerms, generateDosExamSchedule, commitDosExamSchedule,
} from '../../api/dos'

vi.mock('../../api/dos', () => ({
  getDosExamSchedule: vi.fn(),
  deleteDosExamSchedule: vi.fn(),
  getSchoolSettings: vi.fn(),
  getTerms: vi.fn(),
  generateDosExamSchedule: vi.fn(),
  commitDosExamSchedule: vi.fn(),
}))

const examData = [
  {
    id: 11,
    subject: 'Mathematics',
    exam_type: 'MAT 401',
    class_name: 'S4A',
    exam_date: '2026-03-16',
    start_time: '08:00',
    end_time: '11:00',
    venue: 'Hall A',
    invigilator: 'Mr. Rurangwa',
  },
  {
    id: 12,
    subject: 'Physics',
    exam_type: 'PHY 401',
    class_name: '',
    exam_date: '2026-03-18',
    start_time: '09:00',
    end_time: '12:00',
    venue: '',
    invigilator: '',
  },
]

describe('DosExamSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali', school_name: 'Test School' })
  })

  it('shows a loading state initially', () => {
    getDosExamSchedule.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DosExamSchedule />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows an error state when the fetch fails', async () => {
    getDosExamSchedule.mockRejectedValue(new Error('Network down'))
    renderWithRouter(<DosExamSchedule />)
    await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
  })

  it('renders fetched exam rows with mapped fields', async () => {
    getDosExamSchedule.mockResolvedValue(examData)
    renderWithRouter(<DosExamSchedule />)

    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())
    expect(screen.getByText('MAT 401')).toBeInTheDocument()
    expect(screen.getByText('S4A')).toBeInTheDocument()
    expect(screen.getByText('08:00 – 11:00')).toBeInTheDocument()
    expect(screen.getByText('Hall A')).toBeInTheDocument()
    expect(screen.getByText('Mr. Rurangwa')).toBeInTheDocument()

    // Row 2 falls back to placeholders for missing fields
    expect(screen.getByText('Physics')).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    const physicsRow = rows.find(r => within(r).queryByText('Physics'))
    expect(within(physicsRow).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('keeps the default/fallback exam rows when the API returns an empty array', async () => {
    getDosExamSchedule.mockResolvedValue([])
    renderWithRouter(<DosExamSchedule />)

    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    // falls back to the built-in examRows constant
    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('English Language')).toBeInTheDocument()
  })

  it('deletes an exam row when the delete button is clicked, calling the api with the right id', async () => {
    getDosExamSchedule.mockResolvedValue(examData)
    deleteDosExamSchedule.mockResolvedValue({})
    renderWithRouter(<DosExamSchedule />)

    await waitFor(() => expect(screen.getByText('Mathematics')).toBeInTheDocument())

    const rows = screen.getAllByRole('row')
    const mathRow = rows.find(r => within(r).queryByText('Mathematics'))
    const deleteBtn = within(mathRow).getByText('delete').closest('button')
    fireEvent.click(deleteBtn)

    await waitFor(() => expect(deleteDosExamSchedule).toHaveBeenCalledWith(11))
    await waitFor(() => expect(screen.queryByText('Mathematics')).not.toBeInTheDocument())
    expect(screen.getByText('Physics')).toBeInTheDocument()
  })

  it('generates a preview then commits it via the Generate modal', async () => {
    getDosExamSchedule.mockResolvedValue([])
    getTerms.mockResolvedValue([{ id: 't1', name: 'Term 1', year: 2026, is_current: true }])
    generateDosExamSchedule.mockResolvedValue({
      assignments: [{
        subject_name: 'Geography', class_name: 'S4A', exam_date: '2026-08-10',
        start_time: '09:00', end_time: '11:00', venue: 'Hall A', invigilator_name: 'Ms. Ingabire',
      }],
      unscheduled: [],
      summary: { total_exams: 1, scheduled: 1, unscheduled: 0, slots_available: 10, venues: 2 },
      warnings: [],
    })
    commitDosExamSchedule.mockResolvedValue({ created: 1, unscheduled: [], summary: {}, warnings: [] })

    renderWithRouter(<DosExamSchedule />)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())

    // Open the modal.
    fireEvent.click(screen.getByRole('button', { name: /Generate/i }))
    await waitFor(() => expect(getTerms).toHaveBeenCalled())

    // Fill the required start date, then Preview.
    const dateInput = document.querySelector('input[type="date"]')
    fireEvent.change(dateInput, { target: { value: '2026-08-10' } })
    fireEvent.click(screen.getByRole('button', { name: /Preview/i }))

    await waitFor(() => expect(generateDosExamSchedule).toHaveBeenCalled())
    // Preview table renders the proposed exam.
    await waitFor(() => expect(screen.getByText('Geography')).toBeInTheDocument())

    // Commit persists it.
    fireEvent.click(screen.getByRole('button', { name: /Save 1 exam/i }))
    await waitFor(() => expect(commitDosExamSchedule).toHaveBeenCalled())
  })
})
