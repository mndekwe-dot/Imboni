import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../../test/test-utils'
import { SchoolOverviewModal } from './SchoolOverviewModal'
import { getSchoolOverview, setSchoolModules, openSupportSession } from '../../../api/platform'

vi.mock('../../../api/platform', () => ({
    getSchoolOverview: vi.fn(),
    suspendSchool: vi.fn(),
    restrictSchool: vi.fn(),
    reactivateSchool: vi.fn(),
    setSchoolModules: vi.fn(),
    openSupportSession: vi.fn(),
}))

const overview = (disabled = []) => ({
    school: { id: 's1', name: 'Day School', status: 'active', plan: 'premium', schema_name: 'day', disabled_modules: disabled, usage: {} },
    contracts: [], payments: [], tickets: [],
})

describe('SchoolOverviewModal modules', () => {
    beforeEach(() => vi.clearAllMocks())

    it('shows what is on and switches a module off, sending the full list of what is off', async () => {
        getSchoolOverview.mockResolvedValue(overview(['library']))
        setSchoolModules.mockResolvedValue({ ...overview().school, disabled_modules: ['boarding', 'library'] })
        renderWithRouter(<SchoolOverviewModal schoolId="s1" onClose={() => {}} />)

        const boarding = await screen.findByLabelText('Boarding')
        expect(boarding).toBeChecked()
        expect(screen.getByLabelText('Library')).not.toBeChecked()

        fireEvent.click(boarding)

        await waitFor(() => expect(setSchoolModules).toHaveBeenCalledWith('s1', ['boarding', 'library']))
        await waitFor(() => expect(screen.getByLabelText('Boarding')).not.toBeChecked())
    })

    it('says so when the change is refused, and leaves the switch where it was', async () => {
        getSchoolOverview.mockResolvedValue(overview())
        setSchoolModules.mockRejectedValue({ response: { data: { detail: 'Only operations can do this.' } } })
        renderWithRouter(<SchoolOverviewModal schoolId="s1" onClose={() => {}} />)

        fireEvent.click(await screen.findByLabelText('Infirmary'))

        expect(await screen.findByText('Only operations can do this.')).toBeInTheDocument()
        expect(screen.getByLabelText('Infirmary')).toBeChecked()
    })

    it('will not open a support session without a reason, and opens one with it', async () => {
        getSchoolOverview.mockResolvedValue(overview())
        openSupportSession.mockResolvedValue({ url: 'http://day.school/support-session#token=abc', minutes: 20, as: 'Head Teacher' })
        const open = vi.spyOn(window, 'open').mockReturnValue({})
        renderWithRouter(<SchoolOverviewModal schoolId="s1" onClose={() => {}} />)

        fireEvent.click(await screen.findByRole('button', { name: /Open a read-only view/ }))
        expect(screen.getByRole('button', { name: 'Open session' })).toBeDisabled()
        fireEvent.change(screen.getByLabelText('Why do you need to look?'), { target: { value: 'Teacher cannot see marks' } })
        fireEvent.click(screen.getByRole('button', { name: 'Open session' }))

        await waitFor(() => expect(openSupportSession).toHaveBeenCalledWith('s1', 'Teacher cannot see marks', 20))
        expect(open).toHaveBeenCalledWith('http://day.school/support-session#token=abc', '_blank', 'noopener')
        open.mockRestore()
    })
})
