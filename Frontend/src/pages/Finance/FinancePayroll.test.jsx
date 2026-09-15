import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { FinancePayroll } from './FinancePayroll'
import { getPayrollRun, getPayrollRuns, getSalaries, saveSalary } from '../../api/finance'
import { getDepartments, getStaffMembers } from '../../api/staff'

vi.mock('../../api/finance', () => ({
    getFinanceAvailability: vi.fn().mockResolvedValue({ enabled: true }),
    getPayrollRuns: vi.fn(),
    getPayrollRun: vi.fn(),
    createPayrollRun: vi.fn(),
    cancelPayrollRun: vi.fn(),
    payrollAction: vi.fn(),
    getSalaries: vi.fn(),
    saveSalary: vi.fn(),
    getCashAccounts: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../api/staff', () => ({
    getDepartments: vi.fn(),
    createDepartment: vi.fn(),
    updateDepartment: vi.fn(),
    deleteDepartment: vi.fn(),
    getStaffMembers: vi.fn(),
    createStaffMember: vi.fn(),
    updateStaffMember: vi.fn(),
    deleteStaffMember: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn(),
}))

const COOK = {
    id: 'm-cook', full_name: 'Jeanne Mukamana', job_title: 'Cook', department: 'd-kitchen',
    department_name: 'Kitchen & catering', department_code: 'kitchen', employment_type: 'casual',
    has_account: false, is_active: true, salary: null,
}

describe('FinancePayroll', () => {
    beforeAll(() => {
        HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
        HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
    })

    beforeEach(() => {
        vi.clearAllMocks()
        getPayrollRuns.mockResolvedValue([{ id: 'r1', period_label: 'September 2026', staff_count: 3, net_total: '500000', status: 'draft' }])
        getSalaries.mockResolvedValue([])
        getStaffMembers.mockResolvedValue([COOK])
        getDepartments.mockResolvedValue([{ id: 'd-kitchen', code: 'kitchen', name: 'Kitchen & catering', is_active: true, member_count: 1 }])
    })

    it('counts the workers who have no salary yet', async () => {
        renderWithRouter(<FinancePayroll />)

        expect(await screen.findByText('Working without a salary set')).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /Staff & salaries/ })).toHaveTextContent('1')
    })

    it('sets a salary for a worker without a login', async () => {
        saveSalary.mockResolvedValue({})
        renderWithRouter(<FinancePayroll />, { route: '/finance/payroll?tab=staff' })

        fireEvent.click(await screen.findByRole('button', { name: 'Set salary' }))
        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByText('Cook · Kitchen & catering')).toBeInTheDocument()
        fireEvent.change(within(dialog).getByLabelText('Gross'), { target: { value: '120000' } })
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(saveSalary).toHaveBeenCalledWith(expect.objectContaining({
            staff: 'm-cook', gross: '120000', tax_method: 'paye',
        })))
    })

    it('shows what each department costs in a run', async () => {
        getPayrollRun.mockResolvedValue({
            run: { id: 'r1', period_label: 'September 2026', status: 'draft' },
            payslips: [{ id: 'p1', staff_name: 'Jeanne Mukamana', job_title: 'Cook', department: 'Kitchen & catering', gross: '120000', total_deductions: '0', net: '120000' }],
            totals: { gross: '120000', pension: '0', tax: '0', other: '0', net: '120000' },
            by_department: [{ department: 'Kitchen & catering', staff: 1, gross: '120000', net: '120000' }],
        })
        renderWithRouter(<FinancePayroll />)

        fireEvent.click(await screen.findByText('September 2026'))
        const dialog = await screen.findByRole('dialog')

        expect(await within(dialog).findByText('Cost by department')).toBeInTheDocument()
        expect(within(dialog).getAllByText(/Kitchen & catering/).length).toBeGreaterThan(1)
    })
})
