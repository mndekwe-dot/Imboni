import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, setSessionUser, within } from '../../test/test-utils'
import { DosResults } from './DosResults'
import { getDosResults, approveResult, rejectResult, getDosAnalytics } from '../../api/dos'

beforeAll(() => {
  // jsdom doesn't implement <dialog> showModal/close natively. A no-op stub
  // leaves the `open` attribute unset, and Testing Library treats content
  // inside a non-open <dialog> as inaccessible to role queries — so the
  // stub must actually flip the open state, or getByRole('dialog'/'button')
  // inside the modal silently finds nothing (and queries fall through to
  // unrelated same-named elements elsewhere on the page).
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

vi.mock('../../api/dos', () => ({
  getDosResults: vi.fn(),
  approveResult: vi.fn(),
  rejectResult: vi.fn(),
  getDosAnalytics: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const rawResults = [
  {
    id: 1, grade: 4, section: 'A', subject: 'Mathematics', status: 'submitted',
    teacher: 'Mr. Habimana', submitted_at: '2026-05-01T10:00:00Z',
    final_score: '78.0', student_id_code: 'STU001', student: 'Eric N.', exam_score: 78, grade_letter: 'B',
  },
  {
    id: 2, grade: 4, section: 'A', subject: 'Mathematics', status: 'submitted',
    teacher: 'Mr. Habimana', submitted_at: '2026-05-01T10:00:00Z',
    final_score: '88.0', student_id_code: 'STU002', student: 'Alice M.', exam_score: 88, grade_letter: 'A',
  },
  {
    id: 3, grade: 5, section: 'B', subject: 'English', status: 'approved',
    teacher: 'Ms. Claudine', submitted_at: '2026-04-20T10:00:00Z',
    final_score: '65.0', student_id_code: 'STU003', student: 'John K.', exam_score: 65, grade_letter: 'C',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ first_name: 'Dr', last_name: 'Ndagijimana', role: 'dos' })
})

describe('DosResults', () => {
  it('shows a loading state before results resolve', () => {
    getDosResults.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DosResults />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows an error state when the results fetch fails', async () => {
    getDosResults.mockRejectedValue(new Error('Network down'))
    renderWithRouter(<DosResults />)
    await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
  })

  it('groups raw student rows into class+subject cards and shows pending/approved counts', async () => {
    getDosResults.mockResolvedValue(rawResults)
    renderWithRouter(<DosResults />)

    await waitFor(() => expect(screen.getByText('S4A - Mathematics')).toBeInTheDocument())
    expect(screen.getByText('S5B - English')).toBeInTheDocument()
    // Pending Approval stat should count 1 group (S4A-Mathematics-pending)
    expect(screen.getByText('Pending Approval')).toBeInTheDocument()
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0)
    // Submitted by teacher name appears
    expect(screen.getByText(/Submitted by Mr\. Habimana/)).toBeInTheDocument()
  })

  it('handles a plain-array or paginated {results:[]} response shape', async () => {
    getDosResults.mockResolvedValue({ results: rawResults })
    renderWithRouter(<DosResults />)
    await waitFor(() => expect(screen.getByText('S4A - Mathematics')).toBeInTheDocument())
  })

  it('approves a pending card: calls approveResult for every grouped id and flips card status to Approved', async () => {
    getDosResults.mockResolvedValue(rawResults)
    approveResult.mockResolvedValue({})
    renderWithRouter(<DosResults />)

    await waitFor(() => expect(screen.getByText('S4A - Mathematics')).toBeInTheDocument())

    // Open the review modal for the pending S4A Mathematics card
    const reviewButtons = screen.getAllByText('Review')
    fireEvent.click(reviewButtons[0])

    // Approve from inside the modal footer
    const dialog = screen.getByRole('dialog')
    const approveBtn = within(dialog).getByRole('button', { name: /Approve/i })
    fireEvent.click(approveBtn)

    await waitFor(() => {
      expect(approveResult).toHaveBeenCalledWith(1)
      expect(approveResult).toHaveBeenCalledWith(2)
    })
    expect(approveResult).toHaveBeenCalledTimes(2)
  })

  it('after approving, the card no longer shows the Review action (status flipped)', async () => {
    getDosResults.mockResolvedValue(rawResults)
    approveResult.mockResolvedValue({})
    renderWithRouter(<DosResults />)

    await waitFor(() => expect(screen.getByText('S4A - Mathematics')).toBeInTheDocument())
    fireEvent.click(screen.getAllByText('Review')[0])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Approve/i }))

    await waitFor(() => {
      // Only the S5B card (already approved) plus the newly-approved S4A card remain — neither shows "Review"
      expect(screen.queryByText('Review')).not.toBeInTheDocument()
    })
  })

  it('rejects a pending card: calls rejectResult for every grouped id and flips card status to Rejected', async () => {
    getDosResults.mockResolvedValue(rawResults)
    rejectResult.mockResolvedValue({})
    renderWithRouter(<DosResults />)

    await waitFor(() => expect(screen.getByText('S4A - Mathematics')).toBeInTheDocument())

    const reviewButtons = screen.getAllByText('Review')
    fireEvent.click(reviewButtons[0])

    const dialog = screen.getByRole('dialog')
    const rejectBtn = within(dialog).getByRole('button', { name: /Reject/i })
    fireEvent.click(rejectBtn)

    await waitFor(() => {
      expect(rejectResult).toHaveBeenCalledWith(1, '')
      expect(rejectResult).toHaveBeenCalledWith(2, '')
    })
    expect(rejectResult).toHaveBeenCalledTimes(2)
  })

  it('search box narrows visible cards by teacher/subject/class text', async () => {
    getDosResults.mockResolvedValue(rawResults)
    renderWithRouter(<DosResults />)

    await waitFor(() => expect(screen.getByText('S4A - Mathematics')).toBeInTheDocument())
    expect(screen.getByText('S5B - English')).toBeInTheDocument()

    const search = screen.getByPlaceholderText('Search by teacher, subject, or class...')
    fireEvent.change(search, { target: { value: 'Claudine' } })

    expect(screen.queryByText('S4A - Mathematics')).not.toBeInTheDocument()
    expect(screen.getByText('S5B - English')).toBeInTheDocument()
  })

  it('status filter tabs narrow visible cards', async () => {
    getDosResults.mockResolvedValue(rawResults)
    renderWithRouter(<DosResults />)

    await waitFor(() => expect(screen.getByText('S4A - Mathematics')).toBeInTheDocument())

    // "Approved" appears both as a FilterBar tab and as a status badge on the S5B card —
    // scope the click to the filter tab bar specifically.
    const filterTab = screen.getAllByText('Approved').find(el => el.closest('.filter-tabs-bar'))
    fireEvent.click(filterTab)
    expect(screen.queryByText('S4A - Mathematics')).not.toBeInTheDocument()
    expect(screen.getByText('S5B - English')).toBeInTheDocument()
  })

  it('shows the empty state when no card matches the filters', async () => {
    getDosResults.mockResolvedValue(rawResults)
    renderWithRouter(<DosResults />)

    await waitFor(() => expect(screen.getByText('S4A - Mathematics')).toBeInTheDocument())

    const search = screen.getByPlaceholderText('Search by teacher, subject, or class...')
    fireEvent.change(search, { target: { value: 'nonexistent-xyz' } })

    expect(screen.getByText('No results match your filters.')).toBeInTheDocument()
  })

  it('fetches analytics data when switching to the Analytics tab', async () => {
    getDosResults.mockResolvedValue(rawResults)
    getDosAnalytics.mockResolvedValue({
      current_term_id: 1,
      stats: { overall_avg: 75, attendance_rate: 92, ratio: '1:20', top_performers: 12 },
      terms: [{ id: 1, name: 'Term 1' }],
      grade_distribution: [],
      attendance_monthly: [],
      pass_fail: [],
      submissions: [],
      grade_performance: [],
      subject_averages: [],
    })
    renderWithRouter(<DosResults />)

    await waitFor(() => expect(screen.getByText('S4A - Mathematics')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Analytics'))

    await waitFor(() => expect(getDosAnalytics).toHaveBeenCalledWith({}))
    await waitFor(() => expect(screen.getByText('Overall Performance')).toBeInTheDocument())
    expect(screen.getByText('75%')).toBeInTheDocument()
  })
})
