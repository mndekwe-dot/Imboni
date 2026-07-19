import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
import { ParentChildren } from './ParentChildren'
import { getMyChildren, getChildCard, getChildFees, getChildDocuments, getConsentRequests, respondToConsent } from '../../api/parent'

vi.mock('../../api/parent', () => ({
  getMyChildren: vi.fn(),
  getChildCard: vi.fn(),
  getChildFees: vi.fn(),
  getChildDocuments: vi.fn(),
  getConsentRequests: vi.fn().mockResolvedValue([]),
  respondToConsent: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const CHILDREN = [{ id: 1 }, { id: 2 }]

const CARD_1 = { name: 'Eric N.', initials: 'EN', grade: '4', section: 'A', student_code: 'STU001', is_in_school: true, academic_focus: ['Mathematics'], class_teacher: { name: 'Mr. Habimana' } }
const CARD_2 = { name: 'Alice M.', initials: 'AM', grade: '5', section: 'B', student_code: 'STU002', is_in_school: false, academic_focus: [], class_teacher: null }

describe('ParentChildren', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state before children resolve', () => {
    getMyChildren.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<ParentChildren />)
    expect(screen.getByText('Loading children…')).toBeInTheDocument()
  })

  it('shows the empty state when the parent has no linked children', async () => {
    getMyChildren.mockResolvedValue([])
    renderWithRouter(<ParentChildren />)
    await waitFor(() => expect(screen.getByText('No children linked to your account.')).toBeInTheDocument())
  })

  it('fetches per-child data only for the ids returned by getMyChildren, never an arbitrary id', async () => {
    getMyChildren.mockResolvedValue(CHILDREN)
    getChildCard.mockImplementation(id => Promise.resolve(id === 1 ? CARD_1 : CARD_2))
    getChildFees.mockResolvedValue([])
    getChildDocuments.mockResolvedValue([])

    renderWithRouter(<ParentChildren />)

    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    expect(screen.getByText('Alice M.')).toBeInTheDocument()

    // Exactly the two ids the parent's own "my children" call returned — no
    // other id was ever requested for card/fees/documents.
    expect(getChildCard).toHaveBeenCalledTimes(2)
    expect(getChildCard).toHaveBeenCalledWith(1)
    expect(getChildCard).toHaveBeenCalledWith(2)
    expect(getChildFees).toHaveBeenCalledWith(1)
    expect(getChildFees).toHaveBeenCalledWith(2)
    expect(getChildDocuments).toHaveBeenCalledWith(1)
    expect(getChildDocuments).toHaveBeenCalledWith(2)
  })

  it('renders fee status and document links once loaded', async () => {
    getMyChildren.mockResolvedValue([{ id: 1 }])
    getChildCard.mockResolvedValue(CARD_1)
    getChildFees.mockResolvedValue([{ category: 'tuition_fee', status: 'cleared' }])
    getChildDocuments.mockResolvedValue([{ id: 1, title: 'Report Card', file: '/report.pdf' }])

    renderWithRouter(<ParentChildren />)

    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    expect(screen.getByText('Tuition Fee:')).toBeInTheDocument()
    expect(screen.getByText('Cleared')).toBeInTheDocument()
    expect(screen.getByText('Report Card')).toBeInTheDocument()
    expect(screen.getByText('Message Mr. Habimana')).toBeInTheDocument()
  })

  it('shows a loading card for a child whose own data has not resolved yet', async () => {
    getMyChildren.mockResolvedValue(CHILDREN)
    getChildCard.mockImplementation(id => id === 1 ? Promise.resolve(CARD_1) : new Promise(() => {}))
    getChildFees.mockResolvedValue([])
    getChildDocuments.mockResolvedValue([])

    renderWithRouter(<ParentChildren />)

    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    expect(screen.getAllByText('Loading…').length).toBe(1)
  })

  it('handles a paginated {results:[]} shape from getMyChildren', async () => {
    getMyChildren.mockResolvedValue({ results: [{ id: 1 }] })
    getChildCard.mockResolvedValue(CARD_1)
    getChildFees.mockResolvedValue([])
    getChildDocuments.mockResolvedValue([])

    renderWithRouter(<ParentChildren />)
    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
  })

  it('shows pending consent requests and lets the parent approve per child', async () => {
    getMyChildren.mockResolvedValue([])
    getConsentRequests.mockResolvedValue([
      {
        id: 'r1', title: 'Museum Trip', description: 'S2 trip.', event_date: '2026-08-01',
        response_deadline: '2026-07-25', grade: '2', created_by: 'DIS Office',
        children: [
          { student_id: 's1', student_name: 'Eric N.', grade: '2', status: null },
          { student_id: 's2', student_name: 'Alice N.', grade: '2', status: 'approved' },
        ],
      },
    ])
    respondToConsent.mockResolvedValue({ status: 'approved' })

    renderWithRouter(<ParentChildren />)

    await waitFor(() => expect(screen.getByText('Museum Trip')).toBeInTheDocument())
    expect(screen.getByText('1 pending')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()   // Alice already answered

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(respondToConsent).toHaveBeenCalledWith('r1', {
      student_id: 's1', status: 'approved',
    }))
  })

  it('hides the consent card entirely when there are no requests', async () => {
    getMyChildren.mockResolvedValue([])
    getConsentRequests.mockResolvedValue([])
    renderWithRouter(<ParentChildren />)

    await waitFor(() => expect(screen.getByText('No children linked to your account.')).toBeInTheDocument())
    expect(screen.queryByText('Consent Requests')).not.toBeInTheDocument()
  })
})
