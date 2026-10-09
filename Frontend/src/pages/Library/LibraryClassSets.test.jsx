import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { ClassSetsPanel } from './LibraryClassSets'
import { getBooks, getClassClearance, issueClassSet } from '../../api/library'

vi.mock('../../api/library', () => ({
    getBooks: vi.fn(), getClassClearance: vi.fn(), issueClassSet: vi.fn(),
}))

// The class card is the shared one; these cases care about what the panel does with a chosen class.
vi.mock('../../components/ui/ClassFilter', () => ({
    ClassFilter: ({ onChange }) => (
        <button onClick={() => onChange({ grade: 'S3', stream: 'A' })}>pick S3A</button>
    ),
}))

describe('ClassSetsPanel', () => {
    beforeEach(() => vi.clearAllMocks())

    it('issues one copy to every pupil of the chosen class and says who missed out', async () => {
        getBooks.mockResolvedValue([{ id: 'b1', title: 'Mathematics S3', author: 'REB', available_copies: 40 }])
        issueClassSet.mockResolvedValue({ book: 'Mathematics S3', class_size: 45, issued: 40, short: ['Amina Uwase'], skipped: [] })
        renderWithRouter(<ClassSetsPanel />)

        expect(screen.getByRole('button', { name: 'Issue to the class' })).toBeDisabled()
        fireEvent.click(screen.getByText('pick S3A'))
        fireEvent.change(screen.getByPlaceholderText('Find the title…'), { target: { value: 'math' } })
        fireEvent.click(await screen.findByText('Mathematics S3'))
        fireEvent.click(screen.getByRole('button', { name: 'Issue to the class' }))

        await waitFor(() => expect(issueClassSet).toHaveBeenCalledWith({ book: 'b1', grade: 'S3', stream: 'A' }))
        expect(await screen.findByText('No copy left for: Amina Uwase')).toBeInTheDocument()
    })

    it('lists who in the class is not cleared, and what they hold or owe', async () => {
        getClassClearance.mockResolvedValue({
            class_size: 2,
            not_cleared: [{ student: 'Eric Habimana', student_id: 'ADM2', cleared: false, owed: '500.00',
                            books_out: [{ title: 'Physics S6', copy_code: 'P1', overdue: true }] }],
        })
        renderWithRouter(<ClassSetsPanel />)
        fireEvent.click(screen.getByText('pick S3A'))
        fireEvent.click(screen.getByRole('button', { name: 'Check the class' }))

        expect(await screen.findByText('1 of 2 not cleared')).toBeInTheDocument()
        expect(screen.getByText(/has: Physics S6/)).toBeInTheDocument()
    })

    it('says so when everyone is cleared', async () => {
        getClassClearance.mockResolvedValue({ class_size: 2, not_cleared: [] })
        renderWithRouter(<ClassSetsPanel />)
        fireEvent.click(screen.getByText('pick S3A'))
        fireEvent.click(screen.getByRole('button', { name: 'Check the class' }))
        expect(await screen.findByText('Everyone in this class is cleared.')).toBeInTheDocument()
    })
})
