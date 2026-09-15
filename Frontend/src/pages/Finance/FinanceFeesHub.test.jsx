import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { FinanceFeesHub } from './FinanceFeesHub'
import {
    getDebtors, getFeeCategories, getFeeDiscounts, getFeeStructures, getFinanceAvailability,
    getTerms, invoiceTerm,
} from '../../api/finance'

vi.mock('../../api/finance', () => ({
    getFinanceAvailability: vi.fn(),
    getDebtors: vi.fn(),
    getStudentFinance: vi.fn(),
    saveStudentAccount: vi.fn(),
    getFees: vi.fn().mockResolvedValue([]),
    getArrears: vi.fn().mockResolvedValue({ total: '0', results: [] }),
    carryArrears: vi.fn(),
    getFeeStructures: vi.fn(),
    getFeeCategories: vi.fn(),
    getFeeDiscounts: vi.fn(),
    getTerms: vi.fn(),
    invoiceTerm: vi.fn(),
    invoiceStructure: vi.fn(),
    previewStructure: vi.fn(),
    copyStructures: vi.fn(),
    createFeeStructure: vi.fn(),
    updateFeeStructure: vi.fn(),
    deleteFeeStructure: vi.fn(),
    createFeeCategory: vi.fn(),
    updateFeeCategory: vi.fn(),
    deleteFeeCategory: vi.fn(),
    createFeeDiscount: vi.fn(),
    updateFeeDiscount: vi.fn(),
    deleteFeeDiscount: vi.fn(),
    searchStudents: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn(),
}))

vi.mock('../../hooks/useSchoolConfig', () => ({
    useSchoolConfig: () => ({ config: [{ name: 'O-Level', years: [{ name: 'S1', streams: ['A'] }] }] }),
}))

const BOARDING_LINE = {
    id: 'line-1', term: 't2', term_name: 'Term 2 2026', name: 'Boarding fee', category: 'boarding',
    category_name: 'Boarding', amount: '150000.00', due_date: '2026-09-20', classes: [],
    class_label: 'All classes', boarding: 'boarders', intake: 'all', frequency: 'term',
    is_mandatory: true, students: [], student_list: [], notes: '', is_active: true, charged: 0,
    instalments: [{ percent: 50, due_date: '2026-09-20' }, { percent: 50, due_date: '2026-10-20' }],
}

describe('FinanceFeesHub', () => {
    beforeAll(() => {
        HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
        HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    })

    beforeEach(() => {
        vi.clearAllMocks()
        getFinanceAvailability.mockResolvedValue({ enabled: true })
        getDebtors.mockResolvedValue([])
        getFeeStructures.mockResolvedValue([BOARDING_LINE])
        getFeeCategories.mockResolvedValue([{ id: 'c1', code: 'boarding', name: 'Boarding', is_active: true }])
        getFeeDiscounts.mockResolvedValue([])
        getTerms.mockResolvedValue([{ id: 't2', name: 'Term 2 2026', is_current: true }])
    })

    it('opens on who owes and switches to the fee setup', async () => {
        renderWithRouter(<FinanceFeesHub />)
        expect(await screen.findByRole('tab', { name: /Who owes/i })).toHaveAttribute('aria-selected', 'true')

        fireEvent.click(screen.getByRole('tab', { name: /Fee setup/i }))

        expect(await screen.findByText('Boarding fee')).toBeInTheDocument()
        expect(screen.getByText('Boarders only')).toBeInTheDocument()
        expect(screen.getByText('2 instalments')).toBeInTheDocument()
    })

    it('previews the whole term before billing anyone', async () => {
        invoiceTerm.mockResolvedValue({
            dry_run: true, students: 12, total: '1800000.00',
            lines: [{ id: 'line-1', name: 'Boarding fee', class_label: 'All classes', students: 12, skipped: 0, total: '1800000.00' }],
        })
        renderWithRouter(<FinanceFeesHub />, { route: '/finance/fees?tab=setup' })
        await screen.findByText('Boarding fee')

        fireEvent.click(screen.getByRole('button', { name: /Invoice the term/i }))

        await waitFor(() => expect(invoiceTerm).toHaveBeenCalledWith({ dry_run: true }))
        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByRole('button', { name: /Bill 1,800,000 RWF/ })).toBeInTheDocument()
        expect(invoiceTerm).toHaveBeenCalledTimes(1)
    })
})
