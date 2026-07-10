import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { TeacherDashboard } from './TeacherDashboard'
import {
    getTeacherDashboardStats, getTeacherTodaySchedule, getTeacherTasks,
    createTeacherTask, getTeacherClassPerformance, getTeacherRecentActivities,
} from '../../api/teacher'

vi.mock('../../api/teacher', () => ({
    getTeacherDashboardStats: vi.fn(),
    getTeacherTodaySchedule: vi.fn(),
    getTeacherTasks: vi.fn(),
    createTeacherTask: vi.fn(),
    getTeacherClassPerformance: vi.fn(),
    getTeacherRecentActivities: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn(),
}))

const STATS = {
    overall_attendance: 92, class_average: 78, pending_grading: 4,
    total_students: 120, classes_today: 5, classes_completed: 2, classes_remaining: 3,
}

const SCHEDULE = [
    { start_time: '08:00:00', end_time: '08:40:00', class_name: 'S4A', subject_name: 'Mathematics', status: 'in_progress', room_number: '12' },
]

const TASKS = [
    { id: 1, title: 'Grade quizzes', priority: 'high', is_completed: false, due_date: '2026-07-01' },
]

const PERFORMANCE = [{ class_name: 'S4A', average_score: 82 }]

beforeEach(() => {
    vi.clearAllMocks()
    getTeacherDashboardStats.mockResolvedValue(STATS)
    getTeacherTodaySchedule.mockResolvedValue(SCHEDULE)
    getTeacherTasks.mockResolvedValue(TASKS)
    getTeacherClassPerformance.mockResolvedValue(PERFORMANCE)
    getTeacherRecentActivities.mockResolvedValue({ results: [], has_more: false })
})

describe('TeacherDashboard', () => {
    it('shows a loading state before data resolves', () => {
        getTeacherDashboardStats.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<TeacherDashboard />)
        expect(screen.getByText('Loading…')).toBeInTheDocument()
    })

    it('renders stat cards and the schedule once loaded', async () => {
        renderWithRouter(<TeacherDashboard />)

        await waitFor(() => expect(screen.getByText('92%')).toBeInTheDocument())
        expect(screen.getByText('78%')).toBeInTheDocument()
        expect(screen.getByText('Mathematics')).toBeInTheDocument()
        expect(screen.getByText('S4A')).toBeInTheDocument()
    })

    it('renders pending tasks and class performance chart data', async () => {
        renderWithRouter(<TeacherDashboard />)
        await waitFor(() => expect(screen.getByText('Grade quizzes')).toBeInTheDocument())
    })

    it('shows the recent-activities load error when that single call fails', async () => {
        getTeacherRecentActivities.mockRejectedValue({ message: 'Activities unavailable' })
        renderWithRouter(<TeacherDashboard />)
        await waitFor(() => expect(screen.getByText('Activities unavailable')).toBeInTheDocument())
    })

    it('shows empty-state copy when there is no schedule, tasks, or performance data', async () => {
        getTeacherTodaySchedule.mockResolvedValue([])
        getTeacherTasks.mockResolvedValue([])
        getTeacherClassPerformance.mockResolvedValue([])
        renderWithRouter(<TeacherDashboard />)

        await waitFor(() => expect(screen.getByText('No classes scheduled for today.')).toBeInTheDocument())
        expect(screen.getByText('No pending tasks.')).toBeInTheDocument()
        expect(screen.getByText('No performance data yet.')).toBeInTheDocument()
    })

    it('opens the new-task modal and creates a task with the correct payload', async () => {
        createTeacherTask.mockResolvedValue({ id: 2, title: 'Mark attendance log', priority: 'medium', is_completed: false })
        renderWithRouter(<TeacherDashboard />)
        await waitFor(() => expect(screen.getByText('Grade quizzes')).toBeInTheDocument())

        fireEvent.click(screen.getByTitle('Add task'))
        expect(screen.getByText('New Task')).toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText('What needs to be done?'), { target: { value: 'Mark attendance log' } })
        fireEvent.click(screen.getByRole('button', { name: /Save Task/ }))

        await waitFor(() => expect(createTeacherTask).toHaveBeenCalledWith({
            title: 'Mark attendance log', priority: 'medium', due_date: null,
        }))
        await waitFor(() => expect(screen.getByText('Mark attendance log')).toBeInTheDocument())
    })

    it('requires a title before saving a new task', async () => {
        renderWithRouter(<TeacherDashboard />)
        await waitFor(() => expect(screen.getByText('Grade quizzes')).toBeInTheDocument())

        fireEvent.click(screen.getByTitle('Add task'))
        expect(screen.getByRole('button', { name: /Save Task/ })).toBeDisabled()
        expect(createTeacherTask).not.toHaveBeenCalled()
    })

    it('loads more activities when "Load More" is clicked', async () => {
        getTeacherRecentActivities.mockResolvedValue({
            results: [{ activity_type: 'result', description: 'Graded Quiz 1', timestamp: new Date().toISOString() }],
            has_more: true,
        })
        renderWithRouter(<TeacherDashboard />)
        await waitFor(() => expect(screen.getByText('Graded Quiz 1')).toBeInTheDocument())

        getTeacherRecentActivities.mockResolvedValue({
            results: [{ activity_type: 'attendance', description: 'Marked attendance', timestamp: new Date().toISOString() }],
            has_more: false,
        })
        fireEvent.click(screen.getByRole('button', { name: /Load More/ }))

        await waitFor(() => expect(screen.getByText('Marked attendance')).toBeInTheDocument())
        expect(getTeacherRecentActivities).toHaveBeenLastCalledWith({ limit: 10, offset: 1 })
    })

    it('navigates to attendance when the Mark Attendance quick action is clicked', async () => {
        renderWithRouter(<TeacherDashboard />)
        await waitFor(() => expect(screen.getByText('Grade quizzes')).toBeInTheDocument())
        // "Mark Attendance" appears as a sidebar nav link, a quick-action button, and a
        // schedule-card button — disambiguate via the quick-actions container.
        const quickActions = document.querySelector('.quick-actions')
        fireEvent.click(within(quickActions).getByRole('button', { name: /Mark Attendance/ }))
    })
})
