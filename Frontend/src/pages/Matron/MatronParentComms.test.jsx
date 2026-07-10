import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { MatronParentComms } from './MatronParentComms'
import { getParentComms, sendParentComm, getMatronStudents } from '../../api/matron'

vi.mock('../../api/matron', () => ({
    getParentComms: vi.fn(),
    sendParentComm: vi.fn(),
    getMatronStudents: vi.fn(),
}))

const STUDENTS = [
    { student_pk: 1, full_name: 'Iris Niyomugabo', grade: 2, section: 'A' },
    { student_pk: 2, full_name: 'Peter N.', grade: 3, section: 'B' },
]

const DATA = {
    stats: { calls_this_month: 4, sms_sent: 2, emails_sent: 1, awaiting_reply: 1 },
    log: [
        {
            student_name: 'Iris Niyomugabo', parent_contact: 'Mr. Niyomugabo', comm_type: 'call',
            subject: 'Health update', notes: 'Discussed fever', contacted_at: '2026-06-20T10:00:00Z',
            outcome: 'completed', follow_up_required: false, follow_up_date: null,
        },
        {
            student_name: 'Peter N.', parent_contact: 'Mrs. N.', comm_type: 'sms',
            subject: 'Conduct concern', notes: '', contacted_at: '2026-06-18T08:00:00Z',
            outcome: 'awaiting_reply', follow_up_required: true, follow_up_date: '2026-06-25',
        },
    ],
}

describe('MatronParentComms', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setSessionUser({ first_name: 'Gloriose', last_name: 'Hakizimana', role: 'matron' })
        getMatronStudents.mockResolvedValue(STUDENTS)
    })

    it('renders the loading state initially', () => {
        getParentComms.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<MatronParentComms />)
        expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders the error state when the load fails', async () => {
        getParentComms.mockRejectedValue(new Error('Network down'))
        renderWithRouter(<MatronParentComms />)
        await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
    })

    it('renders stats and the communication log once loaded', async () => {
        getParentComms.mockResolvedValue(DATA)
        renderWithRouter(<MatronParentComms />)

        await waitFor(() => expect(screen.getByText('Calls This Month')).toBeInTheDocument())
        expect(screen.getByText('Health update')).toBeInTheDocument()
        expect(screen.getByText('Conduct concern')).toBeInTheDocument()
        expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Pending Reply').length).toBeGreaterThan(0)
        expect(screen.getByText(/Follow-up due 2026-06-25/)).toBeInTheDocument()
    })

    it('shows the empty state when there are no logged communications', async () => {
        getParentComms.mockResolvedValue({ stats: { calls_this_month: 0, sms_sent: 0, emails_sent: 0, awaiting_reply: 0 }, log: [] })
        renderWithRouter(<MatronParentComms />)
        await waitFor(() => expect(screen.getByText('No communications logged yet.')).toBeInTheDocument())
    })

    it('disables Save Log until student, parent contact and subject are provided', async () => {
        getParentComms.mockResolvedValue(DATA)
        renderWithRouter(<MatronParentComms />)
        await waitFor(() => expect(screen.getByText('Log New Communication')).toBeInTheDocument())

        const saveBtn = screen.getByRole('button', { name: /Save Log/ })
        expect(saveBtn).toBeDisabled()

        const formCard = screen.getByText('Log New Communication').closest('.card')
        fireEvent.change(within(formCard).getByDisplayValue('— Select student —'), { target: { value: '1' } })
        expect(saveBtn).toBeDisabled()

        fireEvent.change(screen.getByPlaceholderText('e.g. Mr. John Doe (father)'), { target: { value: 'Mr. Niyomugabo' } })
        expect(saveBtn).toBeDisabled()

        fireEvent.change(screen.getByPlaceholderText(/Health update, Conduct concern/), { target: { value: 'Health update' } })
        expect(saveBtn).not.toBeDisabled()
    })

    it('submits a new communication log with the expected payload shape', async () => {
        getParentComms.mockResolvedValue(DATA)
        sendParentComm.mockResolvedValue({})
        renderWithRouter(<MatronParentComms />)
        await waitFor(() => expect(screen.getByText('Log New Communication')).toBeInTheDocument())

        const formCard = screen.getByText('Log New Communication').closest('.card')
        fireEvent.change(within(formCard).getByDisplayValue('— Select student —'), { target: { value: '1' } })
        fireEvent.change(screen.getByPlaceholderText('e.g. Mr. John Doe (father)'), { target: { value: 'Mr. Niyomugabo' } })
        fireEvent.change(screen.getByPlaceholderText(/Health update, Conduct concern/), { target: { value: 'Health update' } })

        fireEvent.click(screen.getByRole('button', { name: /Save Log/ }))

        await waitFor(() => expect(sendParentComm).toHaveBeenCalledWith(expect.objectContaining({
            student_id: '1',
            parent_contact: 'Mr. Niyomugabo',
            subject: 'Health update',
            comm_type: 'call',
            outcome: 'completed',
            follow_up_required: false,
            follow_up_date: null,
        })))
    })

    it('shows a save error message when sendParentComm rejects', async () => {
        getParentComms.mockResolvedValue(DATA)
        sendParentComm.mockRejectedValue({ response: { data: { error: 'Backend exploded' } } })
        renderWithRouter(<MatronParentComms />)
        await waitFor(() => expect(screen.getByText('Log New Communication')).toBeInTheDocument())

        const formCard = screen.getByText('Log New Communication').closest('.card')
        fireEvent.change(within(formCard).getByDisplayValue('— Select student —'), { target: { value: '1' } })
        fireEvent.change(screen.getByPlaceholderText('e.g. Mr. John Doe (father)'), { target: { value: 'Mr. Niyomugabo' } })
        fireEvent.change(screen.getByPlaceholderText(/Health update, Conduct concern/), { target: { value: 'Health update' } })
        fireEvent.click(screen.getByRole('button', { name: /Save Log/ }))

        await waitFor(() => expect(screen.getByText('Backend exploded')).toBeInTheDocument())
    })

    it('re-fetches the log with the type filter when the filter dropdown changes', async () => {
        getParentComms.mockResolvedValue(DATA)
        renderWithRouter(<MatronParentComms />)
        await waitFor(() => expect(screen.getByText('Communication Log')).toBeInTheDocument())

        getParentComms.mockClear()
        const logCard = screen.getByText('Communication Log').closest('.card')
        fireEvent.change(within(logCard).getByDisplayValue('All Types'), { target: { value: 'sms' } })

        await waitFor(() => expect(getParentComms).toHaveBeenCalledWith({ type: 'sms' }))
    })
})
