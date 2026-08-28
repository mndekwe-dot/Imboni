import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, fireEvent, waitFor } from '../../test/test-utils'
import { MatronIncidents } from './MatronIncidents'
import { getMatronIncidents, createMatronIncident, searchMatronStudents, getMatronDashboard, getMatronStudent } from '../../api/matron'
import { getSchoolSettings } from '../../api/dos'

vi.mock('../../api/matron', () => ({
    getMatronDashboard: vi.fn(),
    getMatronIncidents: vi.fn(),
    createMatronIncident: vi.fn(),
    searchMatronStudents: vi.fn(),
    getMatronStudent: vi.fn(),
}))
vi.mock('../../api/dos', () => ({
    getSchoolSettings: vi.fn(),
    getSchoolConfig: vi.fn(),
}))

const STUDENTS = [
    { student_pk: 1, full_name: 'Iris Niyomugabo', grade: 'S2', section: 'A' },
    { student_pk: 2, full_name: 'Peter N.', grade: 'S3', section: 'B' },
]

/* The student is now typed, not scrolled: a dormitory roll is long and the
   whole school's is longer, and the page no longer downloads either. */
async function pickStudent(name = 'Iris') {
    fireEvent.change(screen.getByRole('combobox'), { target: { value: name } })
    fireEvent.click(await screen.findByText('Iris Niyomugabo', {}, { timeout: 2000 }))
}

const REPORTS = [
    { id: 1, date: '2026-06-20', student_name: 'Iris N.', badge: 'incident', severity: 'minor', status: 'pending_review' },
    { id: 2, date: '2026-06-10', student_name: 'Peter N.', badge: 'warning', severity: 'serious', status: 'approved' },
]

describe('MatronIncidents', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getMatronDashboard.mockResolvedValue({ stats: { dormitory: 'Karisimbi' } })
        setSessionUser({ first_name: 'Gloriose', last_name: 'Hakizimana', role: 'matron' })
        getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali', school_name: 'Imboni' })
        searchMatronStudents.mockResolvedValue(STUDENTS)
    })

    it('renders the loading state initially', () => {
        getMatronIncidents.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<MatronIncidents />)
        expect(screen.getByText('Loading…')).toBeInTheDocument()
    })

    it('renders the error state when the load fails', async () => {
        getMatronIncidents.mockRejectedValue(new Error('Network down'))
        renderWithRouter(<MatronIncidents />)
        await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
    })

    it('renders past reports and a searchable student field once loaded', async () => {
        getMatronIncidents.mockResolvedValue(REPORTS)
        renderWithRouter(<MatronIncidents />)

        await waitFor(() => expect(screen.getByText('Iris N.')).toBeInTheDocument())
        expect(screen.getByText('Peter N.')).toBeInTheDocument()
        expect(screen.getAllByText('Reviewed').length).toBeGreaterThan(0)
        expect(screen.getByText('Pending Review')).toBeInTheDocument()
        // No <option> list: the whole roll is never sent to the browser.
        expect(screen.queryAllByRole('option')).toHaveLength(0)
        expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('disables submit until a student and description are provided', async () => {
        getMatronIncidents.mockResolvedValue([])
        renderWithRouter(<MatronIncidents />)
        await waitFor(() => expect(screen.getAllByText('Report Incident').length).toBeGreaterThan(0))

        const submitBtn = screen.getByRole('button', { name: /Submit to Discipline/ })
        expect(submitBtn).toBeDisabled()

        await pickStudent()
        expect(submitBtn).toBeDisabled() // still no description

        fireEvent.change(screen.getByPlaceholderText(/Describe the incident in detail/), { target: { value: 'Curfew violation' } })
        expect(submitBtn).not.toBeDisabled()
    })

    it('submits a new incident report with the expected payload shape', async () => {
        getMatronIncidents.mockResolvedValue([])
        createMatronIncident.mockResolvedValue({ id: 3, date: '2026-06-29', student_name: 'Iris N.', badge: 'incident', severity: 'minor', status: 'pending_review' })
        renderWithRouter(<MatronIncidents />)
        await waitFor(() => expect(screen.getAllByText('Report Incident').length).toBeGreaterThan(0))

        await pickStudent()
        fireEvent.change(screen.getByPlaceholderText(/Describe the incident in detail/), { target: { value: 'Curfew violation' } })

        fireEvent.click(screen.getByRole('button', { name: /Submit to Discipline/ }))

        await waitFor(() => expect(createMatronIncident).toHaveBeenCalledWith(expect.objectContaining({
            student_id: 1,
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

        await pickStudent()
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

    /* Arriving from a student on the roll. The id travels in the URL rather
       than in router state, so a reload does not silently drop the person the
       report is about. */
    it('preselects the student named in the URL', async () => {
        getMatronIncidents.mockResolvedValue([])
        getMatronStudent.mockResolvedValue({ id: 'b1', student_pk: 's1', name: 'Iris Niyomugabo' })

        renderWithRouter(<MatronIncidents />, { route: '/matron/incidents?student=b1' })

        await waitFor(() => expect(getMatronStudent).toHaveBeenCalledWith('b1'))
        await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('Iris Niyomugabo'))
    })

    it('leaves the picker empty and typeable when the id is unknown', async () => {
        getMatronIncidents.mockResolvedValue([])
        getMatronStudent.mockRejectedValue(new Error('404'))

        renderWithRouter(<MatronIncidents />, { route: '/matron/incidents?student=nope' })

        await waitFor(() => expect(getMatronStudent).toHaveBeenCalled())
        expect(screen.getByRole('combobox')).toHaveValue('')
    })
})
