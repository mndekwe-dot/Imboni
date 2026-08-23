import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { ParentAssignments } from './ParentAssignments'
import { getMyChildren, getChildAssignments } from '../../api/parent'

vi.mock('../../api/parent', () => ({
    getMyChildren:       vi.fn(),
    getChildAssignments: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn(),
}))

const CHILDREN = [
    { id: 'c1', student_name: 'Alice M', grade: 'S4', section: 'A' },
    { id: 'c2', student_name: 'Bob K',   grade: 'S2', section: 'B' },
]

const ASSIGNMENTS = [
    { id: 'a1', title: 'Chapter 6 Homework', subject: 'Mathematics', teacher: 'Mr Rurangwa',
      due_date: '2026-09-01', mode: 'paper',  status: 'graded',  score: 27, max_score: 30, percentage: 90 },
    { id: 'a2', title: 'Poetry Quiz',        subject: 'English',     teacher: 'Ms Umutoni',
      due_date: '2026-09-05', mode: 'online', status: 'pending', score: null, max_score: 10, percentage: null },
    { id: 'a3', title: 'Lab Report',         subject: 'Chemistry',   teacher: 'Mr Bizimana',
      due_date: '2026-08-01', mode: 'paper',  status: 'overdue', score: null, max_score: 20, percentage: null },
]

describe('ParentAssignments', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getMyChildren.mockResolvedValue(CHILDREN)
        getChildAssignments.mockResolvedValue(ASSIGNMENTS)
    })

    it('lists the assignments set for the child', async () => {
        renderWithRouter(<ParentAssignments />)

        await waitFor(() => expect(screen.getByText('Chapter 6 Homework')).toBeInTheDocument())
        expect(screen.getByText('Lab Report')).toBeInTheDocument()
    })

    it('asks for the first child by default', async () => {
        renderWithRouter(<ParentAssignments />)
        await waitFor(() => expect(getChildAssignments).toHaveBeenCalledWith('c1'))
    })

    it('shows a mark where one has been entered', async () => {
        renderWithRouter(<ParentAssignments />)
        await waitFor(() => expect(screen.getByText('27/30')).toBeInTheDocument())
    })

    it('shows a dash, never a zero, for work not yet marked', async () => {
        /* An unmarked assignment scoring 0 would read as a fail to a parent. */
        renderWithRouter(<ParentAssignments />)
        await waitFor(() => expect(screen.getByText('Lab Report')).toBeInTheDocument())

        const row = screen.getByText('Lab Report').closest('tr')
        expect(within(row).queryByText('0/20')).not.toBeInTheDocument()
        expect(within(row).getByText('—')).toBeInTheDocument()
    })

    it('averages only the marked work', async () => {
        // One graded assignment at 90%, so the average is 90 - the unmarked
        // ones must not drag it towards zero.
        renderWithRouter(<ParentAssignments />)
        await waitFor(() => expect(screen.getByText('90%')).toBeInTheDocument())
    })

    it('counts what is still outstanding', async () => {
        renderWithRouter(<ParentAssignments />)
        await waitFor(() => expect(screen.getByText('Chapter 6 Homework')).toBeInTheDocument())

        // a2 pending + a3 overdue
        const tile = screen.getByText('Still to hand in').closest('.portal-stat-card')
        expect(within(tile).getByText('2')).toBeInTheDocument()
    })

    it('filters to a single status', async () => {
        renderWithRouter(<ParentAssignments />)
        await waitFor(() => expect(screen.getByText('Chapter 6 Homework')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Overdue/ }))

        expect(screen.getByText('Lab Report')).toBeInTheDocument()
        expect(screen.queryByText('Chapter 6 Homework')).not.toBeInTheDocument()
    })

    it('marks an online quiz as one', async () => {
        renderWithRouter(<ParentAssignments />)
        await waitFor(() => expect(screen.getByText('Poetry Quiz')).toBeInTheDocument())

        const row = screen.getByText('Poetry Quiz').closest('tr')
        expect(within(row).getByText('Online quiz')).toBeInTheDocument()
    })

    it('switches to the other child', async () => {
        renderWithRouter(<ParentAssignments />)
        await waitFor(() => expect(getChildAssignments).toHaveBeenCalledWith('c1'))

        fireEvent.change(screen.getByLabelText('Child'), { target: { value: '1' } })

        await waitFor(() => expect(getChildAssignments).toHaveBeenCalledWith('c2'))
    })

    it('offers no child picker to a parent with one child', async () => {
        getMyChildren.mockResolvedValue([CHILDREN[0]])
        renderWithRouter(<ParentAssignments />)

        await waitFor(() => expect(screen.getByText('Chapter 6 Homework')).toBeInTheDocument())
        expect(screen.queryByLabelText('Child')).not.toBeInTheDocument()
    })

    it('says so when no children are linked', async () => {
        getMyChildren.mockResolvedValue([])
        renderWithRouter(<ParentAssignments />)

        await waitFor(() =>
            expect(screen.getByText(/No children linked/)).toBeInTheDocument())
    })

    it('reports a failure rather than showing an empty table', async () => {
        getChildAssignments.mockRejectedValue(new Error('network down'))
        renderWithRouter(<ParentAssignments />)

        await waitFor(() =>
            expect(screen.getByText(/Could not load assignments/)).toBeInTheDocument())
    })
})
