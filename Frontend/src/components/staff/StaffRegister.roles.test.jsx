import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, fireEvent, waitFor } from '../../test/test-utils'
import { StaffRegister } from './StaffRegister'
import { getDepartments, getStaffMembers, setStaffExtraRoles } from '../../api/staff'

vi.mock('../../api/staff', () => ({
    getDepartments: vi.fn(), getStaffMembers: vi.fn(), setStaffExtraRoles: vi.fn(),
    createStaffMember: vi.fn(), updateStaffMember: vi.fn(), deleteStaffMember: vi.fn(),
}))
vi.mock('../ui/DocumentActions', () => ({ DocumentActions: () => null }))

const MEMBER = {
    id: 'm1', full_name: 'Grace Mukamana', first_name: 'Grace', last_name: 'Mukamana', is_active: true,
    has_account: true, account_role: 'teacher', account_extra_roles: ['matron'], employment_type: 'full_time',
}

describe('StaffRegister extra roles', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getDepartments.mockResolvedValue([])
        getStaffMembers.mockResolvedValue([MEMBER])
    })

    it('lets the administrator tick other roles and sends the full list', async () => {
        setSessionUser({ first_name: 'A', last_name: 'D', role: 'admin' })
        setStaffExtraRoles.mockResolvedValue({ extra_roles: ['dos', 'matron'] })
        renderWithRouter(<StaffRegister />)

        fireEvent.click(await screen.findByRole('button', { name: /Extra roles \(1\)/ }))
        expect(screen.getByLabelText('Matron')).toBeChecked()
        expect(screen.queryByLabelText('Teacher')).not.toBeInTheDocument()   // their own role is not an extra
        fireEvent.click(screen.getByLabelText('Director of Studies'))
        fireEvent.click(screen.getByRole('button', { name: 'Save roles' }))

        await waitFor(() => expect(setStaffExtraRoles).toHaveBeenCalledWith('m1', ['matron', 'dos']))
    })

    it('does not offer it to anyone but the administrator', async () => {
        setSessionUser({ first_name: 'B', last_name: 'U', role: 'bursar' })
        renderWithRouter(<StaffRegister />)
        await screen.findByText('Grace Mukamana')
        expect(screen.queryByRole('button', { name: /Extra roles/ })).not.toBeInTheDocument()
    })
})
