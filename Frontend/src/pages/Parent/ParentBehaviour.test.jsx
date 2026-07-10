import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { ParentBehaviour } from './ParentBehaviour'
import { getMyChildren, getChildBehaviourStats, getChildBehaviourReports } from '../../api/parent'

vi.mock('../../api/parent', () => ({
  getMyChildren: vi.fn(),
  getChildBehaviourStats: vi.fn(),
  getChildBehaviourReports: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const CHILDREN = [
  { id: 1, student_name: 'Eric N.', grade: '4', section: 'A' },
  { id: 2, student_name: 'Alice M.', grade: '5', section: 'B' },
]

const STATS = { positive_reports: 5, warnings: 1, conduct_grade: 'A', achievements: 2 }

const REPORTS = [
  { id: 1, title: 'Helped a classmate', report_type: 'positive', badge: 'Positive', reported_by_display: 'Mr. Habimana', description: 'Kind act', date: '2026-06-01' },
  { id: 2, title: 'Late to class', report_type: 'warning', badge: 'Warning', reported_by_display: 'Ms. Claudine', description: 'Was late', date: '2026-06-02' },
]

describe('ParentBehaviour', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state before children resolve', () => {
    getMyChildren.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<ParentBehaviour />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the no-children message when none are linked', async () => {
    getMyChildren.mockResolvedValue([])
    renderWithRouter(<ParentBehaviour />)
    await waitFor(() => expect(screen.getByText('No children linked.')).toBeInTheDocument())
  })

  it('renders conduct stats and report cards for the active child', async () => {
    getMyChildren.mockResolvedValue([CHILDREN[0]])
    getChildBehaviourStats.mockResolvedValue(STATS)
    getChildBehaviourReports.mockResolvedValue(REPORTS)

    renderWithRouter(<ParentBehaviour />)

    await waitFor(() => expect(screen.getByText('Helped a classmate')).toBeInTheDocument())
    expect(screen.getByText('Late to class')).toBeInTheDocument()
    expect(screen.getAllByText('A').length).toBeGreaterThan(0)
  })

  it('shows the no-reports message when the active child has none', async () => {
    getMyChildren.mockResolvedValue([CHILDREN[0]])
    getChildBehaviourStats.mockResolvedValue(STATS)
    getChildBehaviourReports.mockResolvedValue([])

    renderWithRouter(<ParentBehaviour />)
    await waitFor(() => expect(screen.getByText('No reports found.')).toBeInTheDocument())
  })

  it('filters reports by Positive / Warnings tabs', async () => {
    getMyChildren.mockResolvedValue([CHILDREN[0]])
    getChildBehaviourStats.mockResolvedValue(STATS)
    getChildBehaviourReports.mockResolvedValue(REPORTS)

    renderWithRouter(<ParentBehaviour />)
    await waitFor(() => expect(screen.getByText('Helped a classmate')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Warnings/ }))
    expect(screen.queryByText('Helped a classmate')).not.toBeInTheDocument()
    expect(screen.getByText('Late to class')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Positive/ }))
    expect(screen.getByText('Helped a classmate')).toBeInTheDocument()
    expect(screen.queryByText('Late to class')).not.toBeInTheDocument()
  })

  it('switching the child tab re-fetches behaviour data scoped to that child only', async () => {
    getMyChildren.mockResolvedValue(CHILDREN)
    getChildBehaviourStats.mockResolvedValue(STATS)
    getChildBehaviourReports.mockImplementation(id =>
      Promise.resolve(id === 1 ? [REPORTS[0]] : [REPORTS[1]])
    )

    renderWithRouter(<ParentBehaviour />)
    await waitFor(() => expect(screen.getByText('Helped a classmate')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Alice M.'))

    await waitFor(() => expect(screen.getByText('Late to class')).toBeInTheDocument())
    expect(screen.queryByText('Helped a classmate')).not.toBeInTheDocument()
    expect(getChildBehaviourReports).toHaveBeenCalledWith(1)
    expect(getChildBehaviourReports).toHaveBeenCalledWith(2)
  })
})
