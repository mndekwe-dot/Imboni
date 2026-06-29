import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
import { DisBoarding } from './DisBoarding'
import {
    getDisBoarding, createDisBoarding, patchDisBoarding, deleteDisBoarding,
    getDisFacilities, getDisStudents,
} from '../../api/discipline'
import { getNotifications } from '../../api/notifications'

vi.mock('../../api/discipline', () => ({
    getDisBoarding: vi.fn(),
    createDisBoarding: vi.fn(),
    patchDisBoarding: vi.fn(),
    deleteDisBoarding: vi.fn(),
    getDisFacilities: vi.fn(),
    getDisStudents: vi.fn(),
}))
vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
}))

const record = {
    id: 1, student_name: 'Iris N.', student_id: 'ADM001', grade: 'S2', section: 'A',
    dormitory: 'Bisoke', room_number: '12', bed_number: '3', boarding_type: 'full_boarder', check_in_date: '2026-01-10',
}

describe('DisBoarding', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getNotifications.mockResolvedValue([])
        getDisFacilities.mockResolvedValue([])
    })

    it('shows loading state', () => {
        getDisBoarding.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<DisBoarding />)
        expect(screen.getByText(/Loading boarding records/i)).toBeInTheDocument()
    })

    it('renders boarding records once loaded', async () => {
        getDisBoarding.mockResolvedValue([record])
        renderWithRouter(<DisBoarding />)
        await waitFor(() => expect(screen.getByText('Iris N.')).toBeInTheDocument())
        expect(screen.getAllByText('Bisoke').length).toBeGreaterThan(0)
        expect(screen.getByText(/Room 12.*Bed 3/)).toBeInTheDocument()
    })

    it('shows empty state with no records', async () => {
        getDisBoarding.mockResolvedValue([])
        renderWithRouter(<DisBoarding />)
        await waitFor(() => expect(screen.getByText('No boarding records')).toBeInTheDocument())
    })

    it('creates a new boarding assignment after searching and selecting a student', async () => {
        getDisBoarding.mockResolvedValue([])
        getDisFacilities.mockResolvedValue([{ id: 1, name: 'Bisoke', capacity: 40 }])
        getDisStudents.mockResolvedValue([{ id: 5, name: 'Amina U.', student_id: 'ADM005', grade: 'S1', section: 'B' }])
        createDisBoarding.mockResolvedValue({ ...record, id: 2, student_name: 'Amina U.' })

        renderWithRouter(<DisBoarding />)
        await waitFor(() => expect(screen.getByText('No boarding records')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Assign to Boarding/i }))
        fireEvent.change(screen.getByPlaceholderText(/Search by name or ADM number/i), { target: { value: 'Amina' } })

        await waitFor(() => expect(getDisStudents).toHaveBeenCalledWith({ search: 'Amina' }), { timeout: 2000 })
        await waitFor(() => expect(screen.getByText('Amina U.')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Amina U.'))

        fireEvent.change(document.querySelector('select[name="dormitory"]'), { target: { value: 'Bisoke' } })
        fireEvent.change(screen.getByPlaceholderText('e.g. 12A'), { target: { value: '14' } })
        fireEvent.change(document.querySelector('input[name="check_in_date"]'), { target: { value: '2026-02-01' } })

        // Two buttons match /Assign/i: the modal's own "Assign" submit button
        // (rendered first) and the page-level "Assign to Boarding" button that
        // opened the modal (rendered second, still present behind it).
        const footerButtons = screen.getAllByRole('button', { name: /Assign/i })
        fireEvent.click(footerButtons[0])

        await waitFor(() => expect(createDisBoarding).toHaveBeenCalledWith(
            expect.objectContaining({ student_id: 5, room_number: '14', check_in_date: '2026-02-01' })
        ))
    })

    it('deletes a boarding record after confirming', async () => {
        getDisBoarding.mockResolvedValue([record])
        deleteDisBoarding.mockResolvedValue({})
        renderWithRouter(<DisBoarding />)
        await waitFor(() => expect(screen.getByText('Iris N.')).toBeInTheDocument())

        const deleteButtons = screen.getAllByRole('button').filter(b => b.querySelector('.material-symbols-rounded')?.textContent === 'delete')
        fireEvent.click(deleteButtons[0])
        fireEvent.click(screen.getByRole('button', { name: 'Yes' }))

        await waitFor(() => expect(deleteDisBoarding).toHaveBeenCalledWith(1))
        await waitFor(() => expect(screen.queryByText('Iris N.')).not.toBeInTheDocument())
    })
})
