import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
import { DiningPlannerTab } from './DiningPlannerTab'
import {
    getDiningSittings, getDiningPlan, createDiningSitting, deleteDiningSitting,
    getTerms, generateDiningPlan, commitDiningPlan,
} from '../../api/dos'

vi.mock('../../api/dos', () => ({
    getDiningSittings: vi.fn(),
    createDiningSitting: vi.fn(),
    updateDiningSitting: vi.fn(),
    deleteDiningSitting: vi.fn(),
    getDiningPlan: vi.fn(),
    generateDiningPlan: vi.fn(),
    commitDiningPlan: vi.fn(),
    getTerms: vi.fn(),
}))

const SITTINGS = [
    { id: 's1', name: 'Lunch 1', meal: 'lunch', start_time: '12:00:00',
      end_time: '12:40:00', capacity: 120, is_active: true },
]
const PLAN = [
    { id: 'a1', meal: 'lunch', sitting_id: 's1', sitting_name: 'Lunch 1',
      start_time: '12:00', end_time: '12:40', class_id: 'c1', class_name: 'S4A' },
]

describe('DiningPlannerTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getDiningSittings.mockResolvedValue(SITTINGS)
        getDiningPlan.mockResolvedValue(PLAN)
        getTerms.mockResolvedValue([{ id: 't1', name: 'Term 1', year: 2026, is_current: true }])
    })

    it('renders sittings and the saved plan', async () => {
        renderWithRouter(<DiningPlannerTab />)

        await waitFor(() => expect(screen.getAllByText('Lunch 1').length).toBeGreaterThan(0))
        expect(screen.getByText('S4A')).toBeInTheDocument()
        expect(screen.getByText('120 seats')).toBeInTheDocument()
    })

    it('shows an empty state when no plan is saved', async () => {
        getDiningPlan.mockResolvedValue([])
        renderWithRouter(<DiningPlannerTab />)

        await waitFor(() => expect(screen.getByText(/No dining plan saved yet/i)).toBeInTheDocument())
    })

    it('adds a sitting', async () => {
        createDiningSitting.mockResolvedValue({})
        renderWithRouter(<DiningPlannerTab />)
        await waitFor(() => expect(getDiningSittings).toHaveBeenCalled())

        fireEvent.change(screen.getByPlaceholderText(/Sitting name/i), { target: { value: 'Supper 1' } })
        fireEvent.change(screen.getByLabelText('Meal'), { target: { value: 'supper' } })
        fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '18:00' } })
        fireEvent.change(screen.getByLabelText('End time'), { target: { value: '18:40' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))

        await waitFor(() => expect(createDiningSitting).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Supper 1', meal: 'supper' }),
        ))
    })

    it('validates required fields before adding', async () => {
        renderWithRouter(<DiningPlannerTab />)
        await waitFor(() => expect(getDiningSittings).toHaveBeenCalled())

        fireEvent.click(screen.getByRole('button', { name: 'Add' }))

        await waitFor(() => expect(screen.getByText(/are required/i)).toBeInTheDocument())
        expect(createDiningSitting).not.toHaveBeenCalled()
    })

    it('deletes a sitting', async () => {
        deleteDiningSitting.mockResolvedValue({})
        renderWithRouter(<DiningPlannerTab />)
        await waitFor(() => expect(getDiningSittings).toHaveBeenCalled())

        fireEvent.click(screen.getByTitle('Delete sitting'))
        await waitFor(() => expect(deleteDiningSitting).toHaveBeenCalledWith('s1'))
    })

    it('previews a generated plan then commits it', async () => {
        generateDiningPlan.mockResolvedValue({
            assignments: [{
                class_id: 'c2', class_name: 'S5B', students: 34, meal: 'lunch',
                sitting_id: 's1', sitting_name: 'Lunch 1',
                start_time: '12:00', end_time: '12:40',
            }],
            unassigned: [],
            occupancy: [{ sitting_id: 's1', sitting_name: 'Lunch 1', meal: 'lunch',
                          seated: 34, capacity: 120, free: 86 }],
            summary: { meals: 1, classes: 1, students: 34, sittings: 1, seated: 1, unassigned: 0 },
            warnings: [],
        })
        commitDiningPlan.mockResolvedValue({ created: 1, unassigned: [], occupancy: [], summary: {}, warnings: [] })

        renderWithRouter(<DiningPlannerTab />)
        await waitFor(() => expect(getDiningSittings).toHaveBeenCalled())

        fireEvent.click(screen.getByRole('button', { name: /Generate/i }))
        await waitFor(() => expect(getTerms).toHaveBeenCalled())

        fireEvent.click(screen.getByRole('button', { name: /Preview/i }))
        await waitFor(() => expect(generateDiningPlan).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('S5B')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Save 1 seating/i }))
        await waitFor(() => expect(commitDiningPlan).toHaveBeenCalled())
    })

    it('surfaces classes that could not be seated', async () => {
        generateDiningPlan.mockResolvedValue({
            assignments: [],
            unassigned: [{ class_name: 'S6A', meal: 'lunch', students: 200,
                           reason: 'group of 200 exceeds every lunch sitting (largest holds 120)' }],
            occupancy: [],
            summary: { meals: 1, classes: 1, students: 200, sittings: 1, seated: 0, unassigned: 1 },
            warnings: ['1 class-meal(s) could not be seated — add a sitting or raise capacity.'],
        })

        renderWithRouter(<DiningPlannerTab />)
        await waitFor(() => expect(getDiningSittings).toHaveBeenCalled())

        fireEvent.click(screen.getByRole('button', { name: /Generate/i }))
        await waitFor(() => expect(getTerms).toHaveBeenCalled())
        fireEvent.click(screen.getByRole('button', { name: /Preview/i }))

        await waitFor(() => expect(screen.getByText(/Could not seat/i)).toBeInTheDocument())
        expect(screen.getByText(/exceeds every lunch sitting/i)).toBeInTheDocument()
    })
})
