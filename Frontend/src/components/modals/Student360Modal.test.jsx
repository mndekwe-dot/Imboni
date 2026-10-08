import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor } from '../../test/test-utils'
import { Student360Modal } from './Student360Modal'
import { getStudent360 } from '../../api/student360'

vi.mock('../../api/student360', () => ({ getStudent360: vi.fn() }))

const DATA = {
    id: 's1', student_id: 'ADM001', name: 'Amina Uwase', class_name: 'S4A', term: 'Term 2',
    academics: { average: 60, subjects_failing: 1, subjects: [{ subject: 'Maths', score: 80, grade: 'A' }, { subject: 'Physics', score: 40, grade: 'F' }] },
    attendance: { rate: 75, days_absent: 1, days_recorded: 4 },
    discipline: { marks_deducted: 12, ladder_step: 'detention', conduct_grade: 'C', recent: [{ title: 'Fight', type: 'incident', date: '2026-10-01' }] },
    exeat: null,
}

describe('Student360Modal', () => {
    beforeEach(() => vi.clearAllMocks())

    it('shows marks, attendance and demerits for the one student', async () => {
        getStudent360.mockResolvedValue(DATA)
        renderWithRouter(<Student360Modal studentId="s1" onClose={() => {}} />)

        expect(await screen.findByText('Amina Uwase')).toBeInTheDocument()
        expect(screen.getByText('60%')).toBeInTheDocument()
        expect(screen.getByText('Physics 40%')).toBeInTheDocument()
        expect(screen.getByText('75%')).toBeInTheDocument()
        expect(screen.getByText('Detention')).toBeInTheDocument()
        expect(screen.getByText(/Fight/)).toBeInTheDocument()
    })

    it('loads once even when the parent re-renders with a new onClose', async () => {
        getStudent360.mockResolvedValue(DATA)
        const { rerender } = renderWithRouter(<Student360Modal studentId="s1" onClose={() => {}} />)
        await screen.findByText('Amina Uwase')
        rerender(<Student360Modal studentId="s1" onClose={() => {}} />)
        expect(getStudent360).toHaveBeenCalledTimes(1)
    })

    it('says why and closes when the overview cannot be loaded', async () => {
        getStudent360.mockRejectedValue({ response: { data: { detail: 'Student not found.' } } })
        const onClose = vi.fn()
        renderWithRouter(<Student360Modal studentId="x" onClose={onClose} />)

        expect(await screen.findByText('Student not found.')).toBeInTheDocument()
        await waitFor(() => expect(onClose).toHaveBeenCalled())
    })

    it('flags a student who is currently out on exéat', async () => {
        getStudent360.mockResolvedValue({ ...DATA, exeat: { status: 'out', expected_return_at: '2026-10-12T16:00:00Z' } })
        renderWithRouter(<Student360Modal studentId="s1" onClose={() => {}} />)
        expect(await screen.findByRole('status')).toHaveTextContent(/Out of school on exéat/)
    })
})
