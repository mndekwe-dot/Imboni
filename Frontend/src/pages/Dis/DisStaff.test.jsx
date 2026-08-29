import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent, within } from '../../test/test-utils'
import { DisStaff } from './DisStaff'
import { getDisStaff, createDisStaff, updateDisStaff } from '../../api/discipline'
import { getNotifications } from '../../api/notifications'

vi.mock('../../api/discipline', () => ({
    getDisStaff: vi.fn(),
    createDisStaff: vi.fn(),
    updateDisStaff: vi.fn(),
}))
vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
}))

const matron = {
    id: 1, full_name: 'Mrs. G. Hakizimana', email: 'g.h@imboni.edu',
    assigned_dormitory: 'Bisoke', assigned_grade: null, staff_type: 'matron',
}
const patron = {
    id: 2, full_name: 'Mr. G. Nkurunziza', email: 'g.n@imboni.edu',
    assigned_dormitory: null, assigned_grade: 'S2', staff_type: 'patron',
}

describe('DisStaff', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getNotifications.mockResolvedValue([])
    })

    it('shows loading state', () => {
        getDisStaff.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<DisStaff />)
        expect(screen.getByText(/Loading staff/i)).toBeInTheDocument()
    })

    it('renders matrons and patrons in their own sections once loaded', async () => {
        getDisStaff.mockResolvedValue([matron, patron])
        renderWithRouter(<DisStaff />)

        await waitFor(() => expect(screen.getByText('Mrs. G. Hakizimana')).toBeInTheDocument())
        expect(screen.getByText(/Matron \(Bisoke\)/)).toBeInTheDocument()
        expect(screen.getByText('Mr. G. Nkurunziza')).toBeInTheDocument()
        expect(screen.getByText(/Patron \(S2\)/)).toBeInTheDocument()
        // "1 Matrons" is what this said before the key grew _one/_other.
        expect(screen.getByText('1 Matron')).toBeInTheDocument()
        expect(screen.getByText('1 Patron')).toBeInTheDocument()
        // Each section is a titled frame, the same one DataTable draws.
        expect(screen.getByRole('heading', { name: 'Boarding Matrons' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Activity Patrons' })).toBeInTheDocument()
        // One "Add Staff" action for the page, in the header -- not one wedged
        // between the matrons heading and the matrons grid.
        expect(screen.getAllByRole('button', { name: /Add Staff/i })).toHaveLength(1)
    })

    it('shows empty messages when there are no matrons or patrons', async () => {
        getDisStaff.mockResolvedValue([])
        renderWithRouter(<DisStaff />)
        await waitFor(() => expect(screen.getByText('No matrons on record.')).toBeInTheDocument())
        expect(screen.getByText('No patrons on record.')).toBeInTheDocument()
        // Each empty section offers the action that would fill it.
        expect(screen.getByRole('button', { name: /Add a matron/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Add a patron/i })).toBeInTheDocument()
    })

    it('filters the list as you type', async () => {
        getDisStaff.mockResolvedValue([matron, patron])
        renderWithRouter(<DisStaff />)
        await waitFor(() => expect(screen.getByText('Mrs. G. Hakizimana')).toBeInTheDocument())

        fireEvent.change(screen.getByPlaceholderText(/Search staff/i), { target: { value: 'Nkurunziza' } })
        expect(screen.getByText('Mr. G. Nkurunziza')).toBeInTheDocument()
        expect(screen.queryByText('Mrs. G. Hakizimana')).not.toBeInTheDocument()
    })

    it('offers to clear the search, not to hire, when a search matches nobody', async () => {
        // It used to say "No matrons on record." and offer "Add a matron" --
        // both wrong when the school has twelve and none is called "zzz".
        getDisStaff.mockResolvedValue([matron, patron])
        renderWithRouter(<DisStaff />)
        await waitFor(() => expect(screen.getByText('Mrs. G. Hakizimana')).toBeInTheDocument())

        fireEvent.change(screen.getByPlaceholderText(/Search staff/i), { target: { value: 'zzz' } })

        expect(screen.getAllByText('No matches for "zzz"')).toHaveLength(2)
        expect(screen.queryByText('No matrons on record.')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Add a matron/i })).not.toBeInTheDocument()

        fireEvent.click(screen.getAllByText('Clear')[0].closest('button'))
        expect(screen.getByText('Mrs. G. Hakizimana')).toBeInTheDocument()
    })

    it('adds a new staff member and persists it via the API', async () => {
        getDisStaff.mockResolvedValue([])
        createDisStaff.mockResolvedValue({
            id: 3, full_name: 'Mr. X', email: '', assigned_dormitory: null, assigned_grade: null, staff_type: 'patron',
        })
        renderWithRouter(<DisStaff />)
        await waitFor(() => expect(screen.getByText('No matrons on record.')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Add Staff/i }))
        await waitFor(() => expect(screen.getByText('Add Staff Member')).toBeInTheDocument())

        fireEvent.change(screen.getByPlaceholderText('e.g. Ms. J. Mukamana'), { target: { value: 'Mr. X' } })
        fireEvent.change(screen.getByPlaceholderText(/e\.g\. Matron/), { target: { value: 'Patron' } })
        const modal = screen.getByText('Add Staff Member').closest('.modal-box')
        fireEvent.click(within(modal).getByText('Add Staff').closest('button'))

        await waitFor(() => expect(createDisStaff).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Mr. X', role: 'Patron' })
        ))
    })

    it('edits an existing staff member and persists the update via the API', async () => {
        getDisStaff.mockResolvedValue([matron])
        updateDisStaff.mockResolvedValue({ ...matron, full_name: 'Mrs. Updated' })
        renderWithRouter(<DisStaff />)
        await waitFor(() => expect(screen.getByText('Mrs. G. Hakizimana')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Edit/i }))
        await waitFor(() => expect(screen.getByText('Edit Staff Member')).toBeInTheDocument())

        fireEvent.click(screen.getByText('Save Changes').closest('button'))

        await waitFor(() => expect(updateDisStaff).toHaveBeenCalledWith(1, expect.any(Object)))
    })
})
