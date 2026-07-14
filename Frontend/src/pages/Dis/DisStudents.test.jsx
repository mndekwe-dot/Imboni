import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { DisStudents } from './DisStudents'
import { getDisStudents, getDisReports, updateDisReport, reviewDisReport, getSchoolConfig } from '../../api/discipline'

vi.mock('../../api/discipline', () => ({
  getDisStudents: vi.fn(),
  getDisReports: vi.fn(),
  updateDisReport: vi.fn(),
  reviewDisReport: vi.fn(),
  getSchoolConfig: vi.fn(),
}))

vi.mock('../../api/dos', () => ({
  getSchoolConfig: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const STUDENTS = [
  { id: 1, name: 'Eric N.', grade: '4', section: 'A', student_id: 'STU001', conduct_grade: 'A', incident_count: 0 },
  { id: 2, name: 'Alice M.', grade: '4', section: 'B', student_id: 'STU002', conduct_grade: 'D', incident_count: 5 },
]

const REPORTS = [
  { id: 1, student: 'Eric N.', grade: '4', section: 'A', report_type: 'incident', title: 'Late', date: '2026-06-01', status: 'pending_review' },
  { id: 2, student: 'Alice M.', grade: '4', section: 'B', report_type: 'warning', title: 'Uniform', date: '2026-06-02', status: 'approved' },
  { id: 3, student: 'Eric N.', grade: '4', section: 'A', report_type: 'incident', title: 'Fight', date: '2026-06-03', status: 'rejected', review_notes: 'Insufficient evidence' },
]

describe('DisStudents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state then student conduct records', async () => {
    getDisStudents.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DisStudents />)
    expect(screen.getByText('Loading students…')).toBeInTheDocument()
  })

  it('renders student conduct rows once loaded', async () => {
    getDisStudents.mockResolvedValue(STUDENTS)
    renderWithRouter(<DisStudents />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    expect(screen.getByText('Alice M.')).toBeInTheDocument()
    expect(screen.getAllByText('Excellent').length).toBeGreaterThan(0)
  })

  it('switches to the reports tab and loads reports only once', async () => {
    getDisStudents.mockResolvedValue(STUDENTS)
    getDisReports.mockResolvedValue(REPORTS)
    renderWithRouter(<DisStudents />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Behavior Reports/ }))
    await waitFor(() => expect(screen.getByText('1 report awaiting review.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Conduct Records/ }))
    fireEvent.click(screen.getByRole('button', { name: /Behavior Reports/ }))

    expect(getDisReports).toHaveBeenCalledTimes(1)
  })

  it('approves a pending report from the review card', async () => {
    getDisStudents.mockResolvedValue(STUDENTS)
    getDisReports.mockResolvedValue(REPORTS)
    reviewDisReport.mockResolvedValue({ status: 'approved', reviewed_by: 'Mr. Mutabazi', reviewed_at: '2026-06-04' })
    renderWithRouter(<DisStudents />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Behavior Reports/ }))
    await waitFor(() => expect(screen.getByText('Late')).toBeInTheDocument())

    const card = screen.getByText('Late').closest('.dis-pending-card')
    fireEvent.click(within(card).getByRole('button', { name: /Review/ }))
    fireEvent.click(screen.getByRole('button', { name: /Approve & Notify/ }))

    await waitFor(() => expect(reviewDisReport).toHaveBeenCalledWith(1, { action: 'approve', notes: '' }))
  })

  it('shows approved reports with the follow-up filter bar', async () => {
    getDisStudents.mockResolvedValue(STUDENTS)
    getDisReports.mockResolvedValue(REPORTS)
    renderWithRouter(<DisStudents />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Behavior Reports/ }))
    await waitFor(() => expect(screen.getByText('Late')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Approved/ }))

    expect(screen.getByText('Uniform')).toBeInTheDocument()
  })

  it('shows rejected reports with their review notes', async () => {
    getDisStudents.mockResolvedValue(STUDENTS)
    getDisReports.mockResolvedValue(REPORTS)
    renderWithRouter(<DisStudents />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Behavior Reports/ }))
    await waitFor(() => expect(screen.getByText('Late')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Rejected/ }))

    expect(screen.getByText('Fight')).toBeInTheDocument()
    expect(screen.getByText('Reason: Insufficient evidence')).toBeInTheDocument()
  })

  it('marks a follow-up as done on an approved report', async () => {
    getDisStudents.mockResolvedValue(STUDENTS)
    getDisReports.mockResolvedValue([{ ...REPORTS[1], follow_up_required: true, follow_up_completed: false }])
    updateDisReport.mockResolvedValue({})
    renderWithRouter(<DisStudents />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Behavior Reports/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Approved/ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Approved/ }))
    await waitFor(() => expect(screen.getByText('Uniform')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Mark Done' }))

    await waitFor(() => expect(updateDisReport).toHaveBeenCalledWith(2, { follow_up_completed: true }))
  })
})
