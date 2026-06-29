import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
import { DisDining } from './DisDining'
import {
    getDisDining, createDisDining, patchDisDining, deleteDisDining, getDisStudents,
} from '../../api/discipline'
import { getNotifications } from '../../api/notifications'

vi.mock('../../api/discipline', () => ({
    getDisDining: vi.fn(),
    createDisDining: vi.fn(),
    patchDisDining: vi.fn(),
    deleteDisDining: vi.fn(),
    getDisStudents: vi.fn(),
}))
vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
}))

const plan = {
    id: 1, student_name: 'Iris N.', student_id: 'ADM001', plan_type: 'full_board', term_name: 'Term 2',
}

describe('DisDining', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getNotifications.mockResolvedValue([])
    })

    it('shows loading state', () => {
        getDisDining.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<DisDining />)
        expect(screen.getByText(/Loading dining plans/i)).toBeInTheDocument()
    })

    it('renders dining plans once loaded', async () => {
        getDisDining.mockResolvedValue([plan])
        renderWithRouter(<DisDining />)
        await waitFor(() => expect(screen.getByText('Iris N.')).toBeInTheDocument())
        expect(screen.getByText('ADM001')).toBeInTheDocument()
        expect(screen.getAllByText('Full Board').length).toBeGreaterThan(0)
        expect(screen.getByText('Term 2')).toBeInTheDocument()
    })

    it('shows empty state with no plans', async () => {
        getDisDining.mockResolvedValue([])
        renderWithRouter(<DisDining />)
        await waitFor(() => expect(screen.getByText('No dining plans')).toBeInTheDocument())
    })

    it('shows an error-safe empty state when the fetch fails', async () => {
        getDisDining.mockRejectedValue(new Error('network error'))
        renderWithRouter(<DisDining />)
        await waitFor(() => expect(screen.getByText('No dining plans')).toBeInTheDocument())
    })

    it('filters plans by plan type using the select', async () => {
        const halfPlan = { id: 2, student_name: 'Amina U.', student_id: 'ADM005', plan_type: 'half_board', term_name: 'Term 2' }
        getDisDining.mockResolvedValue([plan, halfPlan])
        renderWithRouter(<DisDining />)
        await waitFor(() => expect(screen.getByText('Iris N.')).toBeInTheDocument())
        expect(screen.getByText('Amina U.')).toBeInTheDocument()

        fireEvent.change(screen.getByDisplayValue('All Students'), { target: { value: 'half_board' } })
        await waitFor(() => expect(screen.queryByText('Iris N.')).not.toBeInTheDocument())
        expect(screen.getByText('Amina U.')).toBeInTheDocument()
    })

    it('creates a new dining plan after searching and selecting a student', async () => {
        getDisDining.mockResolvedValue([])
        getDisStudents.mockResolvedValue([{ id: 5, name: 'Amina U.', student_id: 'ADM005', grade: 'S1', section: 'B' }])
        createDisDining.mockResolvedValue({ id: 2, student_name: 'Amina U.', student_id: 'ADM005', plan_type: 'full_board', term_name: 'Term 2' })

        renderWithRouter(<DisDining />)
        await waitFor(() => expect(screen.getByText('No dining plans')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Add Dining Plan/i }))
        fireEvent.change(screen.getByPlaceholderText(/Search by name or ADM number/i), { target: { value: 'Amina' } })

        await waitFor(() => expect(getDisStudents).toHaveBeenCalledWith({ search: 'Amina' }), { timeout: 2000 })
        await waitFor(() => expect(screen.getByText('Amina U.')).toBeInTheDocument())
        fireEvent.click(screen.getByText('Amina U.'))

        // Two buttons match /Add/i: the modal's own "Add Plan" submit button
        // (rendered first) and the page-level "Add Dining Plan" button that
        // opened the modal (rendered second, still present behind it).
        const addButtons = screen.getAllByRole('button', { name: /Add Plan/i })
        fireEvent.click(addButtons[0])

        await waitFor(() => expect(createDisDining).toHaveBeenCalledWith(
            expect.objectContaining({ student_id: 5, plan_type: 'full_board' })
        ))
    })

    it('edits a dining plan and submits the updated plan type', async () => {
        getDisDining.mockResolvedValue([plan])
        patchDisDining.mockResolvedValue({ ...plan, plan_type: 'half_board' })
        renderWithRouter(<DisDining />)
        await waitFor(() => expect(screen.getByText('Iris N.')).toBeInTheDocument())

        const editButtons = screen.getAllByRole('button').filter(b => b.querySelector('.material-symbols-rounded')?.textContent === 'edit')
        fireEvent.click(editButtons[0])

        await waitFor(() => expect(screen.getByText('Edit Dining Plan')).toBeInTheDocument())
        fireEvent.click(screen.getByLabelText('Half Board'))
        fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

        await waitFor(() => expect(patchDisDining).toHaveBeenCalledWith(1, { plan_type: 'half_board' }))
    })

    it('deletes a dining plan after confirming', async () => {
        getDisDining.mockResolvedValue([plan])
        deleteDisDining.mockResolvedValue({})
        renderWithRouter(<DisDining />)
        await waitFor(() => expect(screen.getByText('Iris N.')).toBeInTheDocument())

        const deleteButtons = screen.getAllByRole('button').filter(b => b.querySelector('.material-symbols-rounded')?.textContent === 'delete')
        fireEvent.click(deleteButtons[0])
        fireEvent.click(screen.getByRole('button', { name: 'Yes' }))

        await waitFor(() => expect(deleteDisDining).toHaveBeenCalledWith(1))
        await waitFor(() => expect(screen.queryByText('Iris N.')).not.toBeInTheDocument())
    })
})
