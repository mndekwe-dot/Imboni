import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, waitFor } from '../../test/test-utils'
import { MatronSchedule } from './MatronSchedule'
import { getMatronBoardingSchedule, getMatronDashboard } from '../../api/matron'
import { getSchoolSettings } from '../../api/dos'

vi.mock('../../api/matron', () => ({
    getMatronDashboard: vi.fn(),
    getMatronBoardingSchedule: vi.fn(),
}))
vi.mock('../../api/dos', () => ({
    getSchoolSettings: vi.fn(),
    getSchoolConfig: vi.fn(),
}))

const SCHEDULE = {
    stats: { days_in_schedule: 7, total_activities: 28, changes_this_week: 1, current_term: 'Term 2' },
    changes: [
        { description: 'Study hour moved to 7pm', changed_by_name: 'Mr. Mutabazi', change_date: '2026-06-20', status: 'new' },
    ],
    weekday_rows: [
        // Label and activity deliberately differ, so counting the activity
        // measures how many columns it was drawn into, not the fixture.
        { time: '6:00 AM', label: 'Rise', isBreak: false, cellClass: 'wake', subject: 'Wake Up', teacher: '', room: '' },
        { time: '12:00 PM', label: 'Lunch', isBreak: true, breakText: 'Lunch Break' },
    ],
    weekend_rows: [
        { time: '8:00 AM', label: 'Chores', isBreak: false, sat: { cellClass: 'chores', subject: 'Chores', teacher: '', room: '' }, sun: { cellClass: 'chores', subject: 'Chores', teacher: '', room: '' } },
    ],
}

describe('MatronSchedule', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getMatronDashboard.mockResolvedValue({ stats: { dormitory: 'Karisimbi' } })
        setSessionUser({ first_name: 'Gloriose', last_name: 'Hakizimana', role: 'matron' })
        getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali', school_name: 'Imboni' })
    })

    it('renders the loading state initially', () => {
        getMatronBoardingSchedule.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<MatronSchedule />)
        expect(screen.getByText('Loading…')).toBeInTheDocument()
    })

    it('renders the error state when the load fails', async () => {
        getMatronBoardingSchedule.mockRejectedValue(new Error('Network down'))
        renderWithRouter(<MatronSchedule />)
        await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
    })

    it('renders stats, weekday/weekend tables and recent changes once loaded', async () => {
        getMatronBoardingSchedule.mockResolvedValue(SCHEDULE)
        renderWithRouter(<MatronSchedule />)

        await waitFor(() => expect(screen.getByText('Days in schedule')).toBeInTheDocument())
        expect(screen.getByText('Total activities')).toBeInTheDocument()
        expect(screen.getAllByText('Term 2').length).toBeGreaterThan(0)

        expect(screen.getByText('Lunch Break')).toBeInTheDocument()
        expect(screen.getAllByText('Chores').length).toBeGreaterThan(0)

        expect(screen.getByText('Study hour moved to 7pm')).toBeInTheDocument()
        expect(screen.getByText(/Updated by Mr\. Mutabazi/)).toBeInTheDocument()
        expect(screen.getByText('New')).toBeInTheDocument()
    })

    /* The weekday routine is one row per slot, not five. Rendering each slot
       into a Monday..Friday grid drew the same activity five times and implied
       a variation that neither the routine nor BoardingScheduleSlot has. */
    it('shows a weekday activity once rather than once per day', async () => {
        getMatronBoardingSchedule.mockResolvedValue(SCHEDULE)
        renderWithRouter(<MatronSchedule />)

        await waitFor(() => expect(screen.getAllByText('Wake Up').length).toBeGreaterThan(0))
        expect(screen.getAllByText('Wake Up')).toHaveLength(1)
    })

    it('does not head the weekday table with five separate days', async () => {
        getMatronBoardingSchedule.mockResolvedValue(SCHEDULE)
        renderWithRouter(<MatronSchedule />)

        await waitFor(() => expect(screen.getByText('Days in schedule')).toBeInTheDocument())
        expect(screen.queryByRole('columnheader', { name: 'Wednesday' })).not.toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: 'Activity' })).toBeInTheDocument()
    })

    it('still names each weekend day, because Saturday and Sunday do differ', async () => {
        getMatronBoardingSchedule.mockResolvedValue(SCHEDULE)
        renderWithRouter(<MatronSchedule />)

        await waitFor(() => expect(screen.getByText('Days in schedule')).toBeInTheDocument())
        expect(screen.getByRole('columnheader', { name: 'Saturday' })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: 'Sunday' })).toBeInTheDocument()
    })

    /* "Read-only" is a restriction. Green is the success colour, and the badge
       also pulled a .did-* class out of the Discipline stylesheet. */
    it('marks the routine read-only without dressing it as a success', async () => {
        getMatronBoardingSchedule.mockResolvedValue(SCHEDULE)
        const { container } = renderWithRouter(<MatronSchedule />)

        await waitFor(() => expect(screen.getAllByText('Read-only').length).toBeGreaterThan(0))
        expect(container.querySelectorAll('.badge-readonly').length).toBeGreaterThan(0)
        expect(container.querySelector('.did-direct-badge')).toBeNull()
    })
})
