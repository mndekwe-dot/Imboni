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
        expect(screen.getByText('1 Matrons')).toBeInTheDocument()
        expect(screen.getByText('1 Patrons')).toBeInTheDocument()
    })

    it('shows empty messages when there are no matrons or patrons', async () => {
        getDisStaff.mockResolvedValue([])
        renderWithRouter(<DisStaff />)
        await waitFor(() => expect(screen.getByText('No matrons on record.')).toBeInTheDocument())
        expect(screen.getByText('No patrons on record.')).toBeInTheDocument()
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

        fireEvent.change(screen.getByPlaceholderText('e.g. Ms. J. Kamau'), { target: { value: 'Mr. X' } })
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
