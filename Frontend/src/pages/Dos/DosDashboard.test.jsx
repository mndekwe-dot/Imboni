import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, setSessionUser } from '../../test/test-utils'
import { DosDashboard } from './DosDashboard'
import {
  getDosDashboardStats, getDosRecentActivity, getDosPerformanceByGrade,
  getDosWeeklyTrend, getDosTasks, createDosTask, updateDosTask, deleteDosTask,
} from '../../api/dos'

vi.mock('../../api/dos', () => ({
  getDosDashboardStats: vi.fn(),
  getDosRecentActivity: vi.fn(),
  getDosPerformanceByGrade: vi.fn(),
  getDosWeeklyTrend: vi.fn(),
  getDosTasks: vi.fn(),
  createDosTask: vi.fn(),
  updateDosTask: vi.fn(),
  deleteDosTask: vi.fn(),
  // The welcome banner names the school, so the page reads school settings.
  getSchoolSettings: vi.fn().mockResolvedValue({ school_name: 'Imboni Academy' }),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const STATS = {
  total_students: 540, new_students: 12, teaching_staff: 38,
  avg_performance: 82, avg_performance_change: 3, pending_approvals: 5,
}

const ACTIVITY_PAGE = {
  total: 2, has_more: false,
  results: [
    { activity_type: 'approval', description: 'Approved S4A Maths results', time_ago: '2h ago' },
    { activity_type: 'staff', description: 'New teacher onboarded', time_ago: '1d ago' },
  ],
}

const TASKS = [
  { id: 1, title: 'Review timetable', priority: 'high', is_completed: false, due_date: '2026-07-01' },
  { id: 2, title: 'Sign reports', priority: 'low', is_completed: true, due_date: null },
]

function setupHappyPath() {
  getDosDashboardStats.mockResolvedValue(STATS)
  getDosPerformanceByGrade.mockResolvedValue([{ grade: 'S1', avg_score: 70 }])
  getDosWeeklyTrend.mockResolvedValue([{ week: 'W1', attendance: 90, performance: 80 }])
  getDosRecentActivity.mockResolvedValue(ACTIVITY_PAGE)
  getDosTasks.mockResolvedValue(TASKS)
}

beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ first_name: 'Dr', last_name: 'Ndagijimana', role: 'dos' })
})

describe('DosDashboard', () => {
  it('shows a loading state before the main stats resolve', () => {
    getDosDashboardStats.mockReturnValue(new Promise(() => {}))
    getDosPerformanceByGrade.mockReturnValue(new Promise(() => {}))
    getDosWeeklyTrend.mockReturnValue(new Promise(() => {}))
    getDosRecentActivity.mockReturnValue(new Promise(() => {}))
    getDosTasks.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DosDashboard />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an error state when the stats fetch fails', async () => {
    getDosDashboardStats.mockRejectedValue(new Error('Network down'))
    getDosPerformanceByGrade.mockResolvedValue([])
    getDosWeeklyTrend.mockResolvedValue([])
    getDosRecentActivity.mockResolvedValue({ total: 0, has_more: false, results: [] })
    getDosTasks.mockResolvedValue([])
    renderWithRouter(<DosDashboard />)
    await waitFor(() => expect(screen.getByText('Error: Network down')).toBeInTheDocument())
  })

  it('renders stat cards, recent activity and task widget once data resolves', async () => {
    setupHappyPath()
    renderWithRouter(<DosDashboard />)

    await waitFor(() => expect(screen.getByText('Total Students')).toBeInTheDocument())
    expect(screen.getByText('540')).toBeInTheDocument()
    expect(screen.getByText('Teaching Staff')).toBeInTheDocument()
    expect(screen.getByText('38')).toBeInTheDocument()
    expect(screen.getByText('Avg Performance')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('Pending Approvals')).toBeInTheDocument()

    expect(screen.getByText('Approved S4A Maths results')).toBeInTheDocument()
    expect(screen.getByText('New teacher onboarded')).toBeInTheDocument()

    expect(screen.getByText('Term Trend')).toBeInTheDocument()
    expect(screen.getByText('Performance by Grade')).toBeInTheDocument()

    expect(screen.getByText('Review timetable')).toBeInTheDocument()
    expect(screen.getByText('Sign reports')).toBeInTheDocument()
  })

  it('fetches recent activity with limit/offset and tasks separately', async () => {
    setupHappyPath()
    renderWithRouter(<DosDashboard />)

    await waitFor(() => expect(getDosRecentActivity).toHaveBeenCalledWith({ limit: 10, offset: 0 }))
    expect(getDosTasks).toHaveBeenCalledTimes(1)
  })

  it('adds a new task via the Add form and calls createDosTask with the right payload', async () => {
    setupHappyPath()
    const newTask = { id: 3, title: 'New task', priority: 'medium', is_completed: false, due_date: null }
    createDosTask.mockResolvedValue(newTask)
    renderWithRouter(<DosDashboard />)

    await waitFor(() => expect(screen.getByText('My Tasks')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Add/ }))
    fireEvent.change(screen.getByPlaceholderText('Task title…'), { target: { value: 'New task' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Task/ }))

    await waitFor(() => expect(createDosTask).toHaveBeenCalledWith({
      title: 'New task', priority: 'medium', due_date: null,
    }))
    await waitFor(() => expect(screen.getByText('New task')).toBeInTheDocument())
  })

  it('toggles a task as completed via its checkbox and calls updateDosTask', async () => {
    setupHappyPath()
    updateDosTask.mockResolvedValue({ ...TASKS[0], is_completed: true })
    renderWithRouter(<DosDashboard />)

    await waitFor(() => expect(screen.getByText('Review timetable')).toBeInTheDocument())

    const checkbox = screen.getByText('Review timetable')
      .closest('div')
      .parentElement
      .querySelector('input[type="checkbox"]')
    fireEvent.click(checkbox)

    await waitFor(() => expect(updateDosTask).toHaveBeenCalledWith(1, { is_completed: true }))
  })

  it('shows the empty tasks message when there are no tasks', async () => {
    setupHappyPath()
    getDosTasks.mockResolvedValue([])
    renderWithRouter(<DosDashboard />)

    await waitFor(() => expect(screen.getByText('No tasks yet. Click Add to create one.')).toBeInTheDocument())
  })

  it('deletes a single task and drops it from the list', async () => {
    setupHappyPath()
    deleteDosTask.mockResolvedValue({})
    renderWithRouter(<DosDashboard />)

    await waitFor(() => expect(screen.getByText('Review timetable')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Delete "Review timetable"' }))

    await waitFor(() => expect(deleteDosTask).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByText('Review timetable')).not.toBeInTheDocument())
  })

  it('puts the task back when the delete fails', async () => {
    setupHappyPath()
    deleteDosTask.mockRejectedValue(new Error('network'))
    renderWithRouter(<DosDashboard />)

    await waitFor(() => expect(screen.getByText('Review timetable')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Delete "Review timetable"' }))

    await waitFor(() => expect(deleteDosTask).toHaveBeenCalled())
    // Optimistic removal must be undone — the row is still on the server.
    await waitFor(() => expect(screen.getByText('Review timetable')).toBeInTheDocument())
  })

  it('clears only the completed tasks, after confirming', async () => {
    setupHappyPath()
    deleteDosTask.mockResolvedValue({})
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWithRouter(<DosDashboard />)

    await waitFor(() => expect(screen.getByText('Sign reports')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Clear done/ }))

    await waitFor(() => expect(deleteDosTask).toHaveBeenCalledWith(2))
    expect(deleteDosTask).toHaveBeenCalledTimes(1)              // the pending one is untouched
    await waitFor(() => expect(screen.queryByText('Sign reports')).not.toBeInTheDocument())
    expect(screen.getByText('Review timetable')).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('deletes nothing when the clear confirmation is declined', async () => {
    setupHappyPath()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderWithRouter(<DosDashboard />)

    await waitFor(() => expect(screen.getByText('Sign reports')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Clear done/ }))

    expect(deleteDosTask).not.toHaveBeenCalled()
    expect(screen.getByText('Sign reports')).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('hides "Clear done" when no task is completed', async () => {
    setupHappyPath()
    getDosTasks.mockResolvedValue([
      { id: 1, title: 'Review timetable', priority: 'high', is_completed: false, due_date: null },
    ])
    renderWithRouter(<DosDashboard />)

    await waitFor(() => expect(screen.getByText('Review timetable')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Clear done/ })).not.toBeInTheDocument()
  })

  it('shows a "Load more" button for recent activity when has_more is true, and loads the next page', async () => {
    setupHappyPath()
    getDosRecentActivity.mockImplementation(({ offset }) => {
      if (offset === 0) {
        return Promise.resolve({
          total: 3, has_more: true,
          results: [{ activity_type: 'approval', description: 'Approved S4A Maths results', time_ago: '2h ago' }],
        })
      }
      return Promise.resolve({
        total: 3, has_more: false,
        results: [{ activity_type: 'pending', description: 'Pending review', time_ago: '3h ago' }],
      })
    })
    renderWithRouter(<DosDashboard />)

    await waitFor(() => expect(screen.getByText('Approved S4A Maths results')).toBeInTheDocument())
    const loadMoreBtn = screen.getByRole('button', { name: /Load more/ })
    fireEvent.click(loadMoreBtn)

    await waitFor(() => expect(getDosRecentActivity).toHaveBeenCalledWith({ limit: 10, offset: 1 }))
    await waitFor(() => expect(screen.getByText('Pending review')).toBeInTheDocument())
  })
})
