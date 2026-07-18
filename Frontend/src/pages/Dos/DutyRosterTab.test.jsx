import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
import { DutyRosterTab } from './DutyRosterTab'
import {
    getDutyPosts, getDutyRoster, createDutyPost, deleteDutyPost,
    getTerms, generateDutyRoster, commitDutyRoster,
} from '../../api/dos'

vi.mock('../../api/dos', () => ({
    getDutyPosts: vi.fn(),
    createDutyPost: vi.fn(),
    updateDutyPost: vi.fn(),
    deleteDutyPost: vi.fn(),
    getDutyRoster: vi.fn(),
    generateDutyRoster: vi.fn(),
    commitDutyRoster: vi.fn(),
    getTerms: vi.fn(),
}))

const POSTS = [
    { id: 'p1', name: 'Morning Assembly', start_time: '07:30:00', end_time: '08:00:00', staff_required: 1, is_active: true },
]
const ROSTER = [
    { id: 'r1', day: 'monday', post_id: 'p1', post_name: 'Morning Assembly',
      start_time: '07:30', end_time: '08:00', staff_id: 's1', staff_name: 'Alice Uwera', staff_role: 'teacher' },
]

describe('DutyRosterTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getDutyPosts.mockResolvedValue(POSTS)
        getDutyRoster.mockResolvedValue(ROSTER)
        getTerms.mockResolvedValue([{ id: 't1', name: 'Term 1', year: 2026, is_current: true }])
    })

    it('renders configured duty posts and the saved roster', async () => {
        renderWithRouter(<DutyRosterTab />)

        await waitFor(() => expect(screen.getAllByText('Morning Assembly').length).toBeGreaterThan(0))
        expect(screen.getByText('Alice Uwera')).toBeInTheDocument()
        expect(screen.getByText('Mon')).toBeInTheDocument()
    })

    it('shows an empty state when no roster is saved', async () => {
        getDutyRoster.mockResolvedValue([])
        renderWithRouter(<DutyRosterTab />)

        await waitFor(() => expect(screen.getByText(/No roster saved yet/i)).toBeInTheDocument())
    })

    it('adds a duty post', async () => {
        createDutyPost.mockResolvedValue({})
        renderWithRouter(<DutyRosterTab />)
        await waitFor(() => expect(getDutyPosts).toHaveBeenCalled())

        fireEvent.change(screen.getByPlaceholderText(/Duty name/i), { target: { value: 'Evening Prep' } })
        fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '18:00' } })
        fireEvent.change(screen.getByLabelText('End time'), { target: { value: '19:30' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))

        await waitFor(() => expect(createDutyPost).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Evening Prep', start_time: '18:00', end_time: '19:30' }),
        ))
    })

    it('validates required fields before adding a post', async () => {
        renderWithRouter(<DutyRosterTab />)
        await waitFor(() => expect(getDutyPosts).toHaveBeenCalled())

        fireEvent.click(screen.getByRole('button', { name: 'Add' }))

        await waitFor(() => expect(screen.getByText(/are required/i)).toBeInTheDocument())
        expect(createDutyPost).not.toHaveBeenCalled()
    })

    it('deletes a duty post', async () => {
        deleteDutyPost.mockResolvedValue({})
        renderWithRouter(<DutyRosterTab />)
        await waitFor(() => expect(getDutyPosts).toHaveBeenCalled())

        fireEvent.click(screen.getByTitle('Delete duty post'))
        await waitFor(() => expect(deleteDutyPost).toHaveBeenCalledWith('p1'))
    })

    it('previews a generated roster then commits it', async () => {
        generateDutyRoster.mockResolvedValue({
            assignments: [{
                day: 'monday', post_id: 'p1', post_name: 'Morning Assembly',
                start_time: '07:30', end_time: '08:00', seat: 0,
                staff_id: 's2', staff_name: 'Bob Ntare', staff_role: 'teacher',
            }],
            unfilled: [],
            load: [{ staff_id: 's2', staff_name: 'Bob Ntare', duties: 1 }],
            summary: { days: 1, posts: 1, seats: 1, filled: 1, unfilled: 0, staff: 2, spread: 0 },
            warnings: [],
        })
        commitDutyRoster.mockResolvedValue({ created: 1, unfilled: [], load: [], summary: {}, warnings: [] })

        renderWithRouter(<DutyRosterTab />)
        await waitFor(() => expect(getDutyPosts).toHaveBeenCalled())

        fireEvent.click(screen.getByRole('button', { name: /Generate/i }))
        await waitFor(() => expect(getTerms).toHaveBeenCalled())

        fireEvent.click(screen.getByRole('button', { name: /Preview/i }))
        await waitFor(() => expect(generateDutyRoster).toHaveBeenCalled())
        // Appears twice: once in the assignments table, once in the workload table.
        await waitFor(() => expect(screen.getAllByText('Bob Ntare').length).toBe(2))

        fireEvent.click(screen.getByRole('button', { name: /Save 1 assignment/i }))
        await waitFor(() => expect(commitDutyRoster).toHaveBeenCalled())
    })
})
