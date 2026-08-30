import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { LibraryCirculation } from './LibraryCirculation'
import {
    getFines, getLibraryAvailability, getLoans, getMembers, issueLoan, returnLoan,
} from '../../api/library'

vi.mock('../../api/library', () => ({
    getLibraryAvailability: vi.fn(),
    getLoans: vi.fn(),
    getFines: vi.fn(),
    getMembers: vi.fn(),
    issueLoan: vi.fn(),
    returnLoan: vi.fn(),
    renewLoan: vi.fn(),
    payFine: vi.fn(),
    waiveFine: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn(),
}))

const LOAN = {
    id: 'loan-1',
    book_title: 'Things Fall Apart',
    book_author: 'Chinua Achebe',
    copy_code: 'THI-001',
    borrower_detail: { id: 'u1', name: 'Aline K', class_label: 'S4A' },
    due_on: '2026-09-12',
    status: 'on_loan',
    days_late: 0,
}

const OVERDUE = { ...LOAN, id: 'loan-2', status: 'overdue', days_late: 3 }

describe('LibraryCirculation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getLibraryAvailability.mockResolvedValue({ enabled: true })
        getFines.mockResolvedValue([])
        getMembers.mockResolvedValue([])
        getLoans.mockResolvedValue([LOAN])
    })

    it('lists what is out', async () => {
        renderWithRouter(<LibraryCirculation />)
        await waitFor(() => expect(screen.getByText('Things Fall Apart')).toBeInTheDocument())
        expect(screen.getByText(/Aline K/)).toBeInTheDocument()
    })

    it('says how late an overdue loan is, not just that it is due', async () => {
        getLoans.mockResolvedValue([OVERDUE])
        renderWithRouter(<LibraryCirculation />)
        await waitFor(() => expect(screen.getByText('3 days late')).toBeInTheDocument())
    })

    it('tells the desk to put a returned book aside when somebody is waiting', async () => {
        // The whole point of the return response: shelve it, or hold it?
        returnLoan.mockResolvedValue({
            loan: { ...LOAN, status: 'returned' },
            fine: null,
            held_for: { id: 'u2', name: 'Eric N' },
        })
        renderWithRouter(<LibraryCirculation />)
        await waitFor(() => expect(screen.getByText('Things Fall Apart')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Return' }))

        await waitFor(() => expect(returnLoan).toHaveBeenCalledWith('loan-1'))
        expect(await screen.findByText(/put it aside for Eric N/i)).toBeInTheDocument()
    })

    it('will not issue without both a copy and a borrower', async () => {
        renderWithRouter(<LibraryCirculation />)
        await waitFor(() => expect(screen.getByText('Things Fall Apart')).toBeInTheDocument())

        const issue = screen.getByRole('button', { name: /^Issue$/i })
        expect(issue).toBeDisabled()

        fireEvent.change(screen.getByLabelText('Copy code'), { target: { value: 'THI-001' } })
        // Still disabled: a code alone does not say who is taking it.
        expect(issue).toBeDisabled()
        expect(issueLoan).not.toHaveBeenCalled()
    })

    it('shows the upgrade notice, and asks for nothing, off the plan', async () => {
        getLibraryAvailability.mockResolvedValue({ enabled: false })
        renderWithRouter(<LibraryCirculation />)

        expect(await screen.findByText(/part of the Premium plan/i)).toBeInTheDocument()
        expect(screen.queryByText('Things Fall Apart')).not.toBeInTheDocument()
    })
})
