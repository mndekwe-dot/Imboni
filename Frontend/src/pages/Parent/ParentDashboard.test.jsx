import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { ParentDashboard } from './ParentDashboard'
import { getMyChildren, getChildDashboard, getChildAssessments, getChildSummative } from '../../api/parent'

vi.mock('../../api/parent', () => ({
  getMyChildren: vi.fn(),
  getChildDashboard: vi.fn(),
  getChildAssessments: vi.fn(),
  getChildSummative: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const CHILDREN = [
  { id: 1, student_name: 'Eric N.', grade: '4', section: 'A' },
  { id: 2, student_name: 'Alice M.', grade: '5', section: 'B' },
]

const STATS = {
  overall_performance: { percentage: 82 },
  attendance: { percentage: 95, present_days: 90, absent_days: 5 },
  announcements: { unread_count: 3, urgent_count: 1 },
  behaviour: { positive_count: 7 },
}

describe('ParentDashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state before children resolve', () => {
    getMyChildren.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<ParentDashboard />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the empty state when the parent has no linked children', async () => {
    getMyChildren.mockResolvedValue([])
    renderWithRouter(<ParentDashboard />)
    await waitFor(() => expect(screen.getByText('No children linked to your account yet.')).toBeInTheDocument())
  })

  it('loads the first child by default and renders their stats/assessments', async () => {
    getMyChildren.mockResolvedValue(CHILDREN)
    getChildDashboard.mockResolvedValue(STATS)
    getChildAssessments.mockResolvedValue([{ id: 1, title: 'Algebra Quiz', assessment_type: 'quiz', score_display: '18/20', grade: 'A' }])
    getChildSummative.mockResolvedValue([])

    renderWithRouter(<ParentDashboard />)

    await waitFor(() => expect(getChildDashboard).toHaveBeenCalledWith(1))
    expect(await screen.findByText('82%')).toBeInTheDocument()
    expect(screen.getByText('Algebra Quiz')).toBeInTheDocument()
  })

  it('switching the child tab re-fetches data scoped to that child only', async () => {
    getMyChildren.mockResolvedValue(CHILDREN)
    getChildDashboard.mockImplementation(id => Promise.resolve(id === 1 ? STATS : { ...STATS, overall_performance: { percentage: 60 } }))
    getChildAssessments.mockResolvedValue([])
    getChildSummative.mockResolvedValue([])

    renderWithRouter(<ParentDashboard />)
    await waitFor(() => expect(getChildDashboard).toHaveBeenCalledWith(1))
    await screen.findByText('82%')

    fireEvent.click(screen.getByText('Alice M.'))

    await waitFor(() => expect(getChildDashboard).toHaveBeenCalledWith(2))
    expect(await screen.findByText('60%')).toBeInTheDocument()
    expect(getChildDashboard).toHaveBeenCalledTimes(2)
  })

  it('shows the no-assessments message when the active child has none', async () => {
    getMyChildren.mockResolvedValue([CHILDREN[0]])
    getChildDashboard.mockResolvedValue(STATS)
    getChildAssessments.mockResolvedValue([])
    getChildSummative.mockResolvedValue([])

    renderWithRouter(<ParentDashboard />)
    await waitFor(() => expect(screen.getByText('No assessments recorded yet.')).toBeInTheDocument())
  })

  it('shows the Recent Results table only when summative results exist', async () => {
    getMyChildren.mockResolvedValue([CHILDREN[0]])
    getChildDashboard.mockResolvedValue(STATS)
    getChildAssessments.mockResolvedValue([])
    getChildSummative.mockResolvedValue([{ id: 1, subject_name: 'Mathematics', grade: 'A', final_score: 85, total_maximum: 100 }])

    renderWithRouter(<ParentDashboard />)
    await waitFor(() => expect(screen.getByText('Recent Results')).toBeInTheDocument())
    expect(screen.getByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('85/100')).toBeInTheDocument()
  })
})
