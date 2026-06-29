import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { MatronHealth } from './MatronHealth'
import { getMatronHealth, createHealthRecord, updateHealthRecord, getMatronStudents } from '../../api/matron'

vi.mock('../../api/matron', () => ({
    getMatronHealth: vi.fn(),
    createHealthRecord: vi.fn(),
    updateHealthRecord: vi.fn(),
    getMatronStudents: vi.fn(),
}))

const HEALTH_DATA = {
    stats: { in_sick_bay_now: 2, under_observation: 1, visits_this_month: 14, cleared_this_month: 9, beds_total: 6, beds_occupied: 2 },
    beds: [
        { bed: 'Bed 1', badgeClass: 'occupied', badge: 'Occupied', student: 'Iris N.', condition: 'Fever', since: '2 hrs ago', isEmpty: false, record_id: 101 },
        { bed: 'Bed 2', badgeClass: 'empty', badge: 'Empty', isEmpty: true, record_id: null },
    ],
    history: [
        {
            visit_datetime: '2026-06-20T10:00:00Z', name: 'Iris Niyomugabo', condition_tag: 'illness',
            complaint: 'Fever', temperature_c: 38.2, action_taken: 'Paracetamol given', status: 'in_sick_bay',
        },
        {
            visit_datetime: '2026-06-18T08:00:00Z', name: 'Peter N.', condition_tag: 'checkup',
            complaint: 'Routine', temperature_c: null, action_taken: null, status: 'cleared',
        },
    ],
}

const STUDENTS = [
    { student_pk: 1, full_name: 'Iris Niyomugabo', grade: 2, section: 'A' },
    { student_pk: 2, full_name: 'Peter N.', grade: 3, section: 'B' },
]

// The "Log Health Visit" form has no <label for=...> association, so we locate
// its fields by walking from the label text to the next sibling control.
function fieldByLabel(labelText) {
    const formCard = screen.getByText('Log Health Visit').closest('.card')
    const label = within(formCard).getByText(labelText)
    return label.parentElement.querySelector('input, select, textarea')
}

beforeEach(() => {
    vi.clearAllMocks()
    setSessionUser({ first_name: 'Gloriose', last_name: 'Hakizimana', role: 'matron' })
    getMatronStudents.mockResolvedValue(STUDENTS)
})

describe('MatronHealth', () => {
    it('renders the loading state initially', () => {
        getMatronHealth.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<MatronHealth />)
        expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders loaded stats, beds and history', async () => {
        getMatronHealth.mockResolvedValue(HEALTH_DATA)
        renderWithRouter(<MatronHealth />)

        await waitFor(() => expect(screen.getByText('In Sick Bay Now')).toBeInTheDocument())

        expect(screen.getByText('2')).toBeInTheDocument() // in_sick_bay_now
        expect(screen.getByText('Iris N.')).toBeInTheDocument()
        expect(screen.getAllByText(/Empty/).length).toBeGreaterThan(0)
        expect(screen.getByRole('cell', { name: 'Iris Niyomugabo' })).toBeInTheDocument()
        expect(screen.getByText('38.2 °C')).toBeInTheDocument()
        expect(screen.getByText((_, el) => el.className === 'settings-info-text align-self-center' && el.textContent.includes('6 beds total'))).toBeInTheDocument()
    })

    it('renders the error state when the load fails', async () => {
        getMatronHealth.mockRejectedValue(new Error('Network down'))
        renderWithRouter(<MatronHealth />)

        await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
    })

    it('disables Save Record until a student and complaint are provided', async () => {
        getMatronHealth.mockResolvedValue(HEALTH_DATA)
        renderWithRouter(<MatronHealth />)
        await waitFor(() => expect(screen.getByText('Log Health Visit')).toBeInTheDocument())

        const saveBtn = screen.getByRole('button', { name: /Save Record/ })
        expect(saveBtn).toBeDisabled()

        fireEvent.change(fieldByLabel('Student'), { target: { value: '1' } })
        expect(saveBtn).toBeDisabled() // still no complaint

        fireEvent.change(fieldByLabel('Complaint / Condition'), { target: { value: 'Headache' } })
        expect(saveBtn).not.toBeDisabled()
    })

    it('submits a new health record with the expected payload shape', async () => {
        getMatronHealth.mockResolvedValue(HEALTH_DATA)
        createHealthRecord.mockResolvedValue({})
        renderWithRouter(<MatronHealth />)
        await waitFor(() => expect(screen.getByText('Log Health Visit')).toBeInTheDocument())

        fireEvent.change(fieldByLabel('Student'), { target: { value: '1' } })
        fireEvent.change(fieldByLabel('Visit Type'), { target: { value: 'injury' } })
        fireEvent.change(fieldByLabel('Complaint / Condition'), { target: { value: 'Twisted ankle' } })
        fireEvent.change(fieldByLabel('Action Taken / Treatment'), { target: { value: 'Iced and bandaged' } })
        fireEvent.change(fieldByLabel('Admit to Sick Bay?'), { target: { value: 'yes' } })

        fireEvent.click(screen.getByRole('button', { name: /Save Record/ }))

        await waitFor(() => expect(createHealthRecord).toHaveBeenCalledTimes(1))
        expect(createHealthRecord).toHaveBeenCalledWith(expect.objectContaining({
            student_id: '1',
            visit_type: 'injury',
            condition_tag: 'injury',
            complaint: 'Twisted ankle',
            action_taken: 'Iced and bandaged',
            admitted: true,
            notify_parent: 'none',
        }))
    })

    it('shows a save error message when createHealthRecord rejects', async () => {
        getMatronHealth.mockResolvedValue(HEALTH_DATA)
        createHealthRecord.mockRejectedValue({ response: { data: { error: 'Backend exploded' } } })
        renderWithRouter(<MatronHealth />)
        await waitFor(() => expect(screen.getByText('Log Health Visit')).toBeInTheDocument())

        fireEvent.change(fieldByLabel('Student'), { target: { value: '1' } })
        fireEvent.change(fieldByLabel('Complaint / Condition'), { target: { value: 'Cough' } })
        fireEvent.click(screen.getByRole('button', { name: /Save Record/ }))

        await waitFor(() => expect(screen.getByText('Backend exploded')).toBeInTheDocument())
    })

    it('discharges a bed by calling updateHealthRecord with status cleared', async () => {
        getMatronHealth.mockResolvedValue(HEALTH_DATA)
        updateHealthRecord.mockResolvedValue({})
        renderWithRouter(<MatronHealth />)
        await waitFor(() => expect(screen.getByText('Iris N.')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Discharge/ }))

        await waitFor(() => expect(updateHealthRecord).toHaveBeenCalledWith(101, { status: 'cleared' }))
    })

    it('filters the history table by selecting a student in the history filter', async () => {
        getMatronHealth.mockResolvedValue(HEALTH_DATA)
        renderWithRouter(<MatronHealth />)
        await waitFor(() => expect(screen.getByText('Health Visit History')).toBeInTheDocument())

        getMatronHealth.mockClear()
        const filterSelect = within(screen.getByText('Health Visit History').closest('.card')).getByDisplayValue('All Students')
        fireEvent.change(filterSelect, { target: { value: '1' } })

        await waitFor(() => expect(getMatronHealth).toHaveBeenCalledWith({ student_id: '1' }))
    })
})
