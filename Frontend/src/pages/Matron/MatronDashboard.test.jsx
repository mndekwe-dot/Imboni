import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, waitFor } from '../../test/test-utils'
import { MatronDashboard } from './MatronDashboard'
import { getMatronDashboard, getMatronNightCheck } from '../../api/matron'
import { getNotifications } from '../../api/notifications'

vi.mock('../../api/matron', () => ({
    getMatronDashboard: vi.fn(),
    getMatronNightCheck: vi.fn(),
}))
vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
}))

const DASHBOARD = {
    stats: { dormitory: 'Karisimbi House' },
    recent_incidents: [
        { student: 'Iris N.', title: 'Late return', date: '2026-06-20', severity: 'minor', report_type: 'incident' },
        { student: 'Peter N.', title: 'Helped a sick friend', date: '2026-06-19', report_type: 'positive' },
    ],
}

const NIGHT_CHECK = {
    boarders: [
        { full_name: 'Iris Niyomugabo', room_number: '12', is_present: true },
        { full_name: 'Peter N.', room_number: '14', is_present: false },
        { full_name: 'Aline U.', room_number: '15', is_present: null },
    ],
}

describe('MatronDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setSessionUser({ first_name: 'Gloriose', last_name: 'Hakizimana', role: 'matron' })
        getNotifications.mockResolvedValue([])
    })

    it('renders the loading state initially', () => {
        getMatronDashboard.mockReturnValue(new Promise(() => {}))
        getMatronNightCheck.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<MatronDashboard />)
        expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders the error state when the load fails', async () => {
        getMatronDashboard.mockRejectedValue(new Error('Network down'))
        getMatronNightCheck.mockResolvedValue(NIGHT_CHECK)
        renderWithRouter(<MatronDashboard />)
        await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
    })

    it('renders stats, roll call and reports once loaded', async () => {
        getMatronDashboard.mockResolvedValue(DASHBOARD)
        getMatronNightCheck.mockResolvedValue(NIGHT_CHECK)
        renderWithRouter(<MatronDashboard />)

        await waitFor(() => expect(screen.getByText('Students in Dormitory')).toBeInTheDocument())

        // 3 boarders total
        expect(screen.getByText('3')).toBeInTheDocument()
        // roll call rows
        expect(screen.getByText('Iris Niyomugabo')).toBeInTheDocument()
        expect(screen.getByText('Present')).toBeInTheDocument()
        expect(screen.getAllByText('Absent').length).toBeGreaterThan(0)
        expect(screen.getByText('Not Checked')).toBeInTheDocument()

        // recent reports
        expect(screen.getByText(/Iris N\.: Late return/)).toBeInTheDocument()
        expect(screen.getByText('Flagged')).toBeInTheDocument()
        expect(screen.getByText(/Peter N\.: Helped a sick friend/)).toBeInTheDocument()
        expect(screen.getByText('Positive')).toBeInTheDocument()

        // welcome banner uses dormitory
        expect(screen.getByText(/Karisimbi House Matron/)).toBeInTheDocument()
    })

    it('shows empty states for roll call and reports when none exist', async () => {
        getMatronDashboard.mockResolvedValue({ stats: {}, recent_incidents: [] })
        getMatronNightCheck.mockResolvedValue({ boarders: [] })
        renderWithRouter(<MatronDashboard />)

        await waitFor(() => expect(screen.getByText('No boarders found.')).toBeInTheDocument())
        expect(screen.getByText('No reports filed yet.')).toBeInTheDocument()
    })
})
