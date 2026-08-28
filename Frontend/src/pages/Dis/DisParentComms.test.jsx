import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
import { DisParentComms } from './DisParentComms'
import { getDisParentComms, sendDisParentComm, searchDisStudents } from '../../api/discipline'
import { getNotifications } from '../../api/notifications'

/**
 * The parent-communication log, now in the portal that owns the decision.
 *
 * It used to sit in the Matron portal: a matron could decide a family should be
 * telephoned and record having done it. Reporting an incident upward and
 * deciding what a family is told are different powers, and the second belongs
 * to the Discipline Office.
 */

vi.mock('../../api/discipline', () => ({
    getDisParentComms: vi.fn(),
    sendDisParentComm: vi.fn(),
    searchDisStudents: vi.fn(),
    getDisStudents: vi.fn(),
}))
vi.mock('../../api/notifications', () => ({
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
}))

const payload = {
    stats: { calls_this_month: 4, sms_sent: 2, emails_sent: 1, awaiting_reply: 3 },
    log: [{
        id: 'c1',
        comm_type: 'call',
        student_name: 'Aline Mukamana',
        parent_contact: 'Mrs Mukamana (mother)',
        subject: 'Absence on Monday',
        notes: 'Explained the absence policy.',
        contacted_at: '2026-08-20T09:30:00Z',
        outcome: 'completed',
        follow_up_required: false,
    }],
}

describe('DisParentComms', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getNotifications.mockResolvedValue([])
        getDisParentComms.mockResolvedValue(payload)
        searchDisStudents.mockResolvedValue([
            { id: 's1', name: 'Aline Mukamana', grade: 3, section: 'A' },
        ])
    })

    it('reads the log from the discipline endpoint, not the matron one', async () => {
        renderWithRouter(<DisParentComms />)
        await waitFor(() => expect(getDisParentComms).toHaveBeenCalled())
    })

    it('shows the log entries once loaded', async () => {
        renderWithRouter(<DisParentComms />)
        await waitFor(() => expect(screen.getByText('Aline Mukamana')).toBeInTheDocument())
        expect(screen.getByText('Absence on Monday')).toBeInTheDocument()
        expect(screen.getByText(/Mrs Mukamana/)).toBeInTheDocument()
    })

    it('shows the month\'s counts', async () => {
        renderWithRouter(<DisParentComms />)
        await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
        expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('sits in the discipline portal, so it carries the discipline navigation', async () => {
        renderWithRouter(<DisParentComms />)
        await waitFor(() => expect(screen.getByText('Aline Mukamana')).toBeInTheDocument())
        // The matron nav has "My Students"; the discipline nav does not.
        expect(screen.queryByText('My Students')).not.toBeInTheDocument()
    })

    it('says so when nobody has been contacted yet', async () => {
        getDisParentComms.mockResolvedValue({ ...payload, log: [] })
        renderWithRouter(<DisParentComms />)
        await waitFor(() => expect(screen.getByText(/no.*communication|nothing/i)).toBeInTheDocument())
    })

    it('surfaces a failure instead of rendering an empty page', async () => {
        getDisParentComms.mockRejectedValue(new Error('Service unavailable'))
        renderWithRouter(<DisParentComms />)
        await waitFor(() => expect(screen.getByText(/Service unavailable/)).toBeInTheDocument())
    })

    /* The student is typed, not scrolled: the office covers the whole school. */
    it('finds a student by typing rather than listing every one', async () => {
        renderWithRouter(<DisParentComms />)
        await waitFor(() => expect(screen.getByText('Aline Mukamana')).toBeInTheDocument())

        const boxes = screen.getAllByRole('combobox')
        fireEvent.change(boxes[0], { target: { value: 'Mukamana' } })

        await waitFor(
            () => expect(searchDisStudents).toHaveBeenCalledWith('Mukamana'),
            { timeout: 2000 },
        )
    })

    it('will not save until a student, a contact and a reason are all present', async () => {
        renderWithRouter(<DisParentComms />)
        await waitFor(() => expect(screen.getByText('Aline Mukamana')).toBeInTheDocument())

        const save = screen.getByRole('button', { name: /save/i })
        expect(save).toBeDisabled()
        fireEvent.click(save)
        expect(sendDisParentComm).not.toHaveBeenCalled()
    })
})
