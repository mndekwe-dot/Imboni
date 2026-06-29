import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, waitFor } from '../../test/test-utils'
import { MatronSchedule } from './MatronSchedule'
import { getMatronBoardingSchedule } from '../../api/matron'
import { getSchoolSettings } from '../../api/dos'

vi.mock('../../api/matron', () => ({
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
        { time: '6:00 AM', label: 'Wake Up', isBreak: false, cellClass: 'wake', subject: 'Wake Up', teacher: '', room: '' },
        { time: '12:00 PM', label: 'Lunch', isBreak: true, breakText: 'Lunch Break' },
    ],
    weekend_rows: [
        { time: '8:00 AM', label: 'Chores', isBreak: false, sat: { cellClass: 'chores', subject: 'Chores', teacher: '', room: '' }, sun: { cellClass: 'chores', subject: 'Chores', teacher: '', room: '' } },
    ],
}

describe('MatronSchedule', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setSessionUser({ first_name: 'Gloriose', last_name: 'Hakizimana', role: 'matron' })
        getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali', school_name: 'Imboni' })
    })

    it('renders the loading state initially', () => {
        getMatronBoardingSchedule.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<MatronSchedule />)
        expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders the error state when the load fails', async () => {
        getMatronBoardingSchedule.mockRejectedValue(new Error('Network down'))
        renderWithRouter(<MatronSchedule />)
        await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
    })

    it('renders stats, weekday/weekend tables and recent changes once loaded', async () => {
        getMatronBoardingSchedule.mockResolvedValue(SCHEDULE)
        renderWithRouter(<MatronSchedule />)

        await waitFor(() => expect(screen.getByText('Days in Schedule')).toBeInTheDocument())
        expect(screen.getByText('Total Activities')).toBeInTheDocument()
        expect(screen.getAllByText('Term 2').length).toBeGreaterThan(0)

        expect(screen.getByText('Lunch Break')).toBeInTheDocument()
        expect(screen.getAllByText('Chores').length).toBeGreaterThan(0)

        expect(screen.getByText('Study hour moved to 7pm')).toBeInTheDocument()
        expect(screen.getByText(/Updated by Mr\. Mutabazi/)).toBeInTheDocument()
        expect(screen.getByText('New')).toBeInTheDocument()
    })
})
