import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, waitFor } from '../../test/test-utils'
import { MatronSchedule } from './MatronSchedule'
import { getMatronBoardingSchedule, getMatronDashboard, getMatronWeeklySchedule } from '../../api/matron'
import { getSchoolSettings } from '../../api/dos'

vi.mock('../../api/matron', () => ({
    getMatronDashboard: vi.fn(),
    getMatronBoardingSchedule: vi.fn(),
    getMatronWeeklySchedule: vi.fn(),
}))
vi.mock('../../api/dos', () => ({
    getSchoolSettings: vi.fn(),
    getSchoolConfig: vi.fn(),
}))

/* Term and the change log. The routine itself no longer comes from here. */
const META = {
    stats: { days_in_schedule: 7, total_activities: 28, changes_this_week: 1, current_term: 'Term 2' },
    changes: [
        { description: 'Study hour moved to 7pm', changed_by_name: 'Mr. Mutabazi', change_date: '2026-06-20', status: 'new' },
    ],
    weekday_rows: [],
    weekend_rows: [],
}

/* Exactly the rows the Discipline Director's own grid is built from. */
const ENTRIES = [
    { id: '1', week: 'default', slot_id: 'morning',     day: 'Monday',   activity_type: 'boarding', subject: 'Wake-up & Prep', teacher: 'All Matrons',       room: 'Dormitories' },
    { id: '2', week: 'default', slot_id: 'afterschool', day: 'Tuesday',  activity_type: 'academic', subject: 'Debate Club',    teacher: 'Ms. C. Umutoni',    room: 'Library'     },
    { id: '3', week: 'default', slot_id: 'evening',     day: 'Saturday', activity_type: 'sports',   subject: 'Athletics',      teacher: 'Mr. E. Nshimiyimana', room: 'Track'     },
]

describe('MatronSchedule', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getMatronDashboard.mockResolvedValue({ stats: { dormitory: 'Karisimbi' } })
        setSessionUser({ first_name: 'Gloriose', last_name: 'Hakizimana', role: 'matron' })
        getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali', school_name: 'Imboni' })
        getMatronWeeklySchedule.mockResolvedValue(ENTRIES)
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

    /* The point of the rewrite: the matron reads the Discipline Office's own
       grid rows, through the same <Timetable> every other portal renders — not
       a second routine kept alongside it. */
    it("renders the Discipline Office's own entries in the shared timetable grid", async () => {
        getMatronBoardingSchedule.mockResolvedValue(META)
        const { container } = renderWithRouter(<MatronSchedule />)

        await waitFor(() => expect(screen.getByText('Debate Club')).toBeInTheDocument())
        expect(screen.getByText('Wake-up & Prep')).toBeInTheDocument()
        expect(screen.getByText('Athletics')).toBeInTheDocument()
        // The shared grid, identified by its own class — not a table this page
        // draws for itself.
        expect(container.querySelector('.tt-table')).not.toBeNull()
        expect(getMatronWeeklySchedule).toHaveBeenCalled()
    })

    it('summarises the week from those same entries', async () => {
        getMatronBoardingSchedule.mockResolvedValue(META)
        renderWithRouter(<MatronSchedule />)

        await waitFor(() => expect(screen.getByText('Activities this week')).toBeInTheDocument())
        expect(screen.getByText('Supervisors on duty')).toBeInTheDocument()
        expect(screen.getByText('Venues in use')).toBeInTheDocument()
        expect(screen.getAllByText('Term 2').length).toBeGreaterThan(0)
    })

    it('keeps the change log the Discipline Office publishes', async () => {
        getMatronBoardingSchedule.mockResolvedValue(META)
        renderWithRouter(<MatronSchedule />)

        await waitFor(() => expect(screen.getByText('Study hour moved to 7pm')).toBeInTheDocument())
        expect(screen.getByText(/Updated by Mr\. Mutabazi/)).toBeInTheDocument()
        expect(screen.getByText('New')).toBeInTheDocument()
    })

    it('says so when no routine has been published for the week', async () => {
        getMatronBoardingSchedule.mockResolvedValue(META)
        getMatronWeeklySchedule.mockResolvedValue([])
        renderWithRouter(<MatronSchedule />)

        await waitFor(() => expect(
            screen.getByText(/has not published a routine for this week yet/),
        ).toBeInTheDocument())
    })

    /* "Read-only" is a restriction. Green is the success colour, and the badge
       also pulled a .did-* class out of the Discipline stylesheet. */
    it('marks the routine read-only without dressing it as a success', async () => {
        getMatronBoardingSchedule.mockResolvedValue(META)
        const { container } = renderWithRouter(<MatronSchedule />)

        await waitFor(() => expect(screen.getAllByText('Read-only').length).toBeGreaterThan(0))
        expect(container.querySelectorAll('.badge-readonly').length).toBeGreaterThan(0)
        expect(container.querySelector('.did-direct-badge')).toBeNull()
    })

    it('offers no way to edit a cell', async () => {
        getMatronBoardingSchedule.mockResolvedValue(META)
        const { container } = renderWithRouter(<MatronSchedule />)

        await waitFor(() => expect(screen.getByText('Debate Club')).toBeInTheDocument())
        expect(container.querySelector('.tt-cell-edit-btn')).toBeNull()
    })
})
