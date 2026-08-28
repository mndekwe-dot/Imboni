import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, fireEvent, waitFor } from '../../test/test-utils'
import { MatronStudents } from './MatronStudents'
import { getMatronStudents, getMatronDashboard, getMatronStudent } from '../../api/matron'
import { getSchoolSettings, getSchoolConfig } from '../../api/dos'

vi.mock('../../api/matron', () => ({
    getMatronDashboard: vi.fn(),
    getMatronStudents: vi.fn(),
    getMatronStudent: vi.fn(),
}))
vi.mock('../../api/dos', () => ({
    getSchoolSettings: vi.fn(),
    getSchoolConfig: vi.fn(),
}))

const STUDENTS = [
    { id: 'b1', full_name: 'Iris Niyomugabo', student_code: 'ADM001', grade: 'S2', section: 'A', room_number: '12', dormitory: 'Karisimbi', boarding_type: 'full' },
    { id: 'b2', full_name: 'Peter N.',        student_code: 'ADM002', grade: 'S3', section: 'B', room_number: '14', dormitory: 'Karisimbi', boarding_type: 'day'  },
    { id: 'b3', full_name: 'Alice Uwase',     student_code: 'ADM003', grade: 'S2', section: 'A', room_number: '3',  dormitory: 'Bisoke',    boarding_type: 'full' },
]

describe('MatronStudents', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getMatronDashboard.mockResolvedValue({ stats: { dormitory: 'Karisimbi' } })
        setSessionUser({ first_name: 'Gloriose', last_name: 'Hakizimana', role: 'matron' })
        getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali', school_name: 'Imboni' })
        getSchoolConfig.mockResolvedValue([])
        getMatronStudent.mockResolvedValue({
            id: 'b1', student_pk: 's1', student_id: 'ADM001', name: 'Iris Niyomugabo',
            bed_number: '4', conduct_grade: 'B', recent_incidents: [
                { id: 'r1', title: 'Missed evening prep', report_type: 'warning', severity: 'minor', date: '2026-08-01', reported_by: 'G. Hakizimana' },
            ],
        })
    })

    it('renders the loading state initially', () => {
        getMatronStudents.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<MatronStudents />)
        expect(screen.getByText('Loading…')).toBeInTheDocument()
    })

    it('renders the error state when the load fails', async () => {
        getMatronStudents.mockRejectedValue(new Error('Network down'))
        renderWithRouter(<MatronStudents />)
        await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
    })

    it('renders stats and the student table once loaded', async () => {
        getMatronStudents.mockResolvedValue(STUDENTS)
        renderWithRouter(<MatronStudents />)

        await waitFor(() => expect(screen.getByText('Iris Niyomugabo')).toBeInTheDocument())
        expect(screen.getByText('Peter N.')).toBeInTheDocument()
        expect(screen.getByText('Total Students')).toBeInTheDocument()
        expect(screen.getByText('Full Boarders')).toBeInTheDocument()
        expect(screen.getByText('Day Boarders')).toBeInTheDocument()
    })

    it('lists the whole school, not only the matron own house', async () => {
        getMatronStudents.mockResolvedValue(STUDENTS)
        renderWithRouter(<MatronStudents />)

        // Alice is in Bisoke; the signed-in matron is assigned to Karisimbi.
        await waitFor(() => expect(screen.getByText('Alice Uwase')).toBeInTheDocument())
        // The request carries no dormitory scope at all.
        expect(getMatronStudents).toHaveBeenCalledWith()
    })

    it('shows the empty state when there are no students', async () => {
        getMatronStudents.mockResolvedValue([])
        renderWithRouter(<MatronStudents />)
        await waitFor(() => expect(screen.getByText('No students found')).toBeInTheDocument())
    })

    it('filters live as you type, without re-requesting the roll', async () => {
        getMatronStudents.mockResolvedValue(STUDENTS)
        renderWithRouter(<MatronStudents />)
        await waitFor(() => expect(screen.getByText('Iris Niyomugabo')).toBeInTheDocument())

        getMatronStudents.mockClear()
        fireEvent.change(screen.getByPlaceholderText('Search by name or student ID...'), { target: { value: 'Iris' } })

        // Filtered immediately — no debounce to wait out.
        expect(screen.getByText('Iris Niyomugabo')).toBeInTheDocument()
        expect(screen.queryByText('Peter N.')).not.toBeInTheDocument()
        // The list a page-wide reload would have blanked is still standing.
        expect(screen.getByText('Total Students')).toBeInTheDocument()
        expect(getMatronStudents).not.toHaveBeenCalled()
    })

    it('searches by admission number as well as name', async () => {
        getMatronStudents.mockResolvedValue(STUDENTS)
        renderWithRouter(<MatronStudents />)
        await waitFor(() => expect(screen.getByText('Iris Niyomugabo')).toBeInTheDocument())

        fireEvent.change(screen.getByPlaceholderText('Search by name or student ID...'), { target: { value: 'ADM002' } })
        expect(screen.getByText('Peter N.')).toBeInTheDocument()
        expect(screen.queryByText('Iris Niyomugabo')).not.toBeInTheDocument()
    })

    it('narrows to one dormitory', async () => {
        getMatronStudents.mockResolvedValue(STUDENTS)
        renderWithRouter(<MatronStudents />)
        await waitFor(() => expect(screen.getByText('Alice Uwase')).toBeInTheDocument())

        fireEvent.change(screen.getByLabelText('Dormitory'), { target: { value: 'Bisoke' } })
        expect(screen.getByText('Alice Uwase')).toBeInTheDocument()
        expect(screen.queryByText('Iris Niyomugabo')).not.toBeInTheDocument()
    })

    /* The roll answered "who is in this house" but not "who is this". Finding a
       student by name and then having to leave the page and type the name again
       into the incident form was the dead end this closes. */
    it('opens the student when their row is clicked', async () => {
        getMatronStudents.mockResolvedValue(STUDENTS)
        renderWithRouter(<MatronStudents />)
        await waitFor(() => expect(screen.getByText('Iris Niyomugabo')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Iris Niyomugabo' }))

        await waitFor(() => expect(screen.getByText('Recent record')).toBeInTheDocument())
        expect(getMatronStudent).toHaveBeenCalledWith('b1')
        expect(screen.getByText('Missed evening prep')).toBeInTheDocument()
    })

    it('offers to report an incident against the student it is showing', async () => {
        getMatronStudents.mockResolvedValue(STUDENTS)
        renderWithRouter(<MatronStudents />)
        await waitFor(() => expect(screen.getByText('Iris Niyomugabo')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Iris Niyomugabo' }))
        const link = await screen.findByRole('link', { name: /Report an incident/i })
        // The id, not the name: two students can share a name.
        expect(link).toHaveAttribute('href', '/matron/incidents?student=b1')
    })

    /* A <tr onClick> alone cannot be tabbed to and is announced as nothing, so
       the row must always carry a real control with the same action. */
    it('reaches the student from the keyboard, not only the mouse', async () => {
        getMatronStudents.mockResolvedValue(STUDENTS)
        renderWithRouter(<MatronStudents />)
        await waitFor(() => expect(screen.getByText('Peter N.')).toBeInTheDocument())
        expect(screen.getByRole('button', { name: 'Peter N.' })).toBeInTheDocument()
    })
})
