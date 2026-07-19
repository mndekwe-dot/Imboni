import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, fireEvent, waitFor } from '../../test/test-utils'
import { MatronIncidents } from './MatronIncidents'
import { getMatronIncidents, createMatronIncident, getMatronStudents } from '../../api/matron'
import { getSchoolSettings } from '../../api/dos'

vi.mock('../../api/matron', () => ({
    getMatronIncidents: vi.fn(),
    createMatronIncident: vi.fn(),
    getMatronStudents: vi.fn(),
}))
vi.mock('../../api/dos', () => ({
    getSchoolSettings: vi.fn(),
    getSchoolConfig: vi.fn(),
}))

const STUDENTS = [
    { student_pk: 1, full_name: 'Iris Niyomugabo', grade: 2, section: 'A' },
    { student_pk: 2, full_name: 'Peter N.', grade: 3, section: 'B' },
]

const REPORTS = [
    { id: 1, date: '2026-06-20', student_name: 'Iris N.', badge: 'incident', severity: 'minor', status: 'pending_review' },
    { id: 2, date: '2026-06-10', student_name: 'Peter N.', badge: 'warning', severity: 'serious', status: 'approved' },
]

describe('MatronIncidents', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setSessionUser({ first_name: 'Gloriose', last_name: 'Hakizimana', role: 'matron' })
        getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali', school_name: 'Imboni' })
        getMatronStudents.mockResolvedValue(STUDENTS)
    })

    it('renders the loading state initially', () => {
        getMatronIncidents.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<MatronIncidents />)
        expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders the error state when the load fails', async () => {
        getMatronIncidents.mockRejectedValue(new Error('Network down'))
        renderWithRouter(<MatronIncidents />)
        await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
    })

    it('renders past reports and the student dropdown once loaded', async () => {
        getMatronIncidents.mockResolvedValue(REPORTS)
        renderWithRouter(<MatronIncidents />)

        await waitFor(() => expect(screen.getByText('Iris N.')).toBeInTheDocument())
        expect(screen.getByText('Peter N.')).toBeInTheDocument()
        expect(screen.getAllByText('Reviewed').length).toBeGreaterThan(0)
        expect(screen.getByText('Pending Review')).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Iris Niyomugabo (S2A)' })).toBeInTheDocument()
    })

    it('disables submit until a student and description are provided', async () => {
        getMatronIncidents.mockResolvedValue([])
        renderWithRouter(<MatronIncidents />)
        await waitFor(() => expect(screen.getAllByText('Report Incident').length).toBeGreaterThan(0))

        const submitBtn = screen.getByRole('button', { name: /Submit to Discipline/ })
        expect(submitBtn).toBeDisabled()

        fireEvent.change(screen.getByDisplayValue('Select student...'), { target: { value: '1' } })
        expect(submitBtn).toBeDisabled() // still no description

        fireEvent.change(screen.getByPlaceholderText(/Describe the incident in detail/), { target: { value: 'Curfew violation' } })
        expect(submitBtn).not.toBeDisabled()
    })

    it('submits a new incident report with the expected payload shape', async () => {
        getMatronIncidents.mockResolvedValue([])
        createMatronIncident.mockResolvedValue({ id: 3, date: '2026-06-29', student_name: 'Iris N.', badge: 'incident', severity: 'minor', status: 'pending_review' })
        renderWithRouter(<MatronIncidents />)
        await waitFor(() => expect(screen.getAllByText('Report Incident').length).toBeGreaterThan(0))

        fireEvent.change(screen.getByDisplayValue('Select student...'), { target: { value: '1' } })
        fireEvent.change(screen.getByPlaceholderText(/Describe the incident in detail/), { target: { value: 'Curfew violation' } })

        fireEvent.click(screen.getByRole('button', { name: /Submit to Discipline/ }))

        await waitFor(() => expect(createMatronIncident).toHaveBeenCalledWith(expect.objectContaining({
            student_id: '1',
            report_type: 'incident',
            severity: 'minor',
            description: 'Curfew violation',
        })))
    })

    it('shows a save error message when createMatronIncident rejects', async () => {
        getMatronIncidents.mockResolvedValue([])
        createMatronIncident.mockRejectedValue(new Error('Backend exploded'))
        renderWithRouter(<MatronIncidents />)
        await waitFor(() => expect(screen.getAllByText('Report Incident').length).toBeGreaterThan(0))

        fireEvent.change(screen.getByDisplayValue('Select student...'), { target: { value: '1' } })
        fireEvent.change(screen.getByPlaceholderText(/Describe the incident in detail/), { target: { value: 'Curfew violation' } })
        fireEvent.click(screen.getByRole('button', { name: /Submit to Discipline/ }))

        await waitFor(() => expect(screen.getByText('Backend exploded')).toBeInTheDocument())
    })

    it('filters past reports using the filter bar', async () => {
        getMatronIncidents.mockResolvedValue(REPORTS)
        renderWithRouter(<MatronIncidents />)
        await waitFor(() => expect(screen.getByText('Iris N.')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Reviewed/ }))
        expect(screen.queryByText('Iris N.')).not.toBeInTheDocument()
        expect(screen.getByText('Peter N.')).toBeInTheDocument()
    })
})
