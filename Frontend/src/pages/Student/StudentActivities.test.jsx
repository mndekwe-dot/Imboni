import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent, within } from '../../test/test-utils'
import { StudentActivities } from './StudentActivities'
import {
    getStudentProfile, getStudentDiscipline,
    getStudentActivities, getStudentActivityEvents,
    joinActivity, withdrawActivity,
} from '../../api/student'

vi.mock('../../api/student', () => ({
    getStudentProfile: vi.fn(),
    getStudentDiscipline: vi.fn(),
    getStudentActivities: vi.fn(),
    getStudentActivityEvents: vi.fn(),
    joinActivity: vi.fn(),
    withdrawActivity: vi.fn(),
}))

const PROFILE = { grade: 'S4', section: 'A' }

const DISCIPLINE = {
    conduct_grade: 'B',
    conduct_label: 'Good Standing',
    reports: [
        { id: 1, report_type: 'positive', description: 'Helped organize event', reported_by: 'Mr. X', date: '2024-03-01' },
        { id: 2, report_type: 'incident', description: 'Late to class', reported_by: 'Ms. Y', date: '2024-03-05' },
    ],
}

const ACTIVITIES = {
    enrolled: [
        { id: 10, name: 'Chess Club', category: 'Club', schedule: 'Tue 4pm', venue: 'Room 5', teacher_name: 'Mr. A', max_members: 20, enrolled_count: 12, is_full: false },
    ],
    available: [
        { id: 20, name: 'Debate Club', category: 'Club', schedule: 'Thu 4pm', venue: 'Hall', teacher_name: 'Ms. B', max_members: 15, enrolled_count: 15, is_full: true },
        { id: 21, name: 'Drama Club', category: 'Club', schedule: 'Fri 4pm', venue: 'Hall', teacher_name: 'Ms. C', max_members: 10, enrolled_count: 2, is_full: false },
    ],
}

const EVENTS = [
    { id: 1, title: 'Chess Tournament', activity_name: 'Chess Club', venue: 'Room 5', date: '2026-04-01', start_time: '14:00:00', end_time: '16:00:00' },
]

beforeEach(() => {
    vi.clearAllMocks()
})

describe('StudentActivities', () => {
    it('shows loading state while data is being fetched', () => {
        getStudentProfile.mockReturnValue(new Promise(() => {}))
        getStudentDiscipline.mockReturnValue(new Promise(() => {}))
        getStudentActivities.mockReturnValue(new Promise(() => {}))
        getStudentActivityEvents.mockReturnValue(new Promise(() => {}))

        renderWithRouter(<StudentActivities />)

        expect(screen.getByText('Loading records…')).toBeInTheDocument()
    })

    it('renders discipline records by default once loaded', async () => {
        getStudentProfile.mockResolvedValue(PROFILE)
        getStudentDiscipline.mockResolvedValue(DISCIPLINE)
        getStudentActivities.mockResolvedValue(ACTIVITIES)
        getStudentActivityEvents.mockResolvedValue(EVENTS)

        renderWithRouter(<StudentActivities />)

        await waitFor(() => expect(screen.getByText('Helped organize event')).toBeInTheDocument())
        expect(screen.getByText('Late to class')).toBeInTheDocument()
        expect(screen.getByText('Good Standing')).toBeInTheDocument()
    })

    it('switches to the Extracurricular Activities tab and shows enrolled/available lists', async () => {
        getStudentProfile.mockResolvedValue(PROFILE)
        getStudentDiscipline.mockResolvedValue(DISCIPLINE)
        getStudentActivities.mockResolvedValue(ACTIVITIES)
        getStudentActivityEvents.mockResolvedValue(EVENTS)

        renderWithRouter(<StudentActivities />)
        await waitFor(() => expect(screen.getByText('Helped organize event')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Extracurricular Activities' }))

        expect(screen.getByText('Chess Club')).toBeInTheDocument()
        expect(screen.getByText('Debate Club')).toBeInTheDocument()
        expect(screen.getByText('Drama Club')).toBeInTheDocument()
        expect(screen.getByText('Full')).toBeInTheDocument()
    })

    it('shows the Upcoming Events tab content', async () => {
        getStudentProfile.mockResolvedValue(PROFILE)
        getStudentDiscipline.mockResolvedValue(DISCIPLINE)
        getStudentActivities.mockResolvedValue(ACTIVITIES)
        getStudentActivityEvents.mockResolvedValue(EVENTS)

        renderWithRouter(<StudentActivities />)
        await waitFor(() => expect(screen.getByText('Helped organize event')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Upcoming Events' }))

        expect(screen.getByText('Chess Tournament')).toBeInTheDocument()
    })

    it('joins an available activity when Join is clicked', async () => {
        getStudentProfile.mockResolvedValue(PROFILE)
        getStudentDiscipline.mockResolvedValue(DISCIPLINE)
        getStudentActivities.mockResolvedValue(ACTIVITIES)
        getStudentActivityEvents.mockResolvedValue(EVENTS)
        joinActivity.mockResolvedValue({})

        renderWithRouter(<StudentActivities />)
        await waitFor(() => expect(screen.getByText('Helped organize event')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Extracurricular Activities' }))

        const dramaCard = screen.getByText('Drama Club').closest('.card')
        fireEvent.click(within(dramaCard).getByRole('button', { name: /Join/i }))

        await waitFor(() => expect(joinActivity).toHaveBeenCalledWith(21))
    })

    it('withdraws from an enrolled activity when Withdraw is clicked', async () => {
        getStudentProfile.mockResolvedValue(PROFILE)
        getStudentDiscipline.mockResolvedValue(DISCIPLINE)
        getStudentActivities.mockResolvedValue(ACTIVITIES)
        getStudentActivityEvents.mockResolvedValue(EVENTS)
        withdrawActivity.mockResolvedValue({})

        renderWithRouter(<StudentActivities />)
        await waitFor(() => expect(screen.getByText('Helped organize event')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: 'Extracurricular Activities' }))

        const chessCard = screen.getByText('Chess Club').closest('.card')
        fireEvent.click(within(chessCard).getByRole('button', { name: /Withdraw/i }))

        await waitFor(() => expect(withdrawActivity).toHaveBeenCalledWith(10))
    })

    it('filters discipline records by type tab', async () => {
        getStudentProfile.mockResolvedValue(PROFILE)
        getStudentDiscipline.mockResolvedValue(DISCIPLINE)
        getStudentActivities.mockResolvedValue(ACTIVITIES)
        getStudentActivityEvents.mockResolvedValue(EVENTS)

        renderWithRouter(<StudentActivities />)
        await waitFor(() => expect(screen.getByText('Helped organize event')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Positive/ }))

        expect(screen.getByText('Helped organize event')).toBeInTheDocument()
        expect(screen.queryByText('Late to class')).not.toBeInTheDocument()
    })
})
