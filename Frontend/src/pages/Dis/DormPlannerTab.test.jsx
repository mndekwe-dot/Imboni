import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor, fireEvent } from '../../test/test-utils'
import { DormPlannerTab } from './DormPlannerTab'
import {
    getDormitories, createDormitory, deleteDormitory,
    getDormRooms, createDormRoom,
    generateHousing, commitHousing,
} from '../../api/discipline'

vi.mock('../../api/discipline', () => ({
    getDormitories: vi.fn(),
    createDormitory: vi.fn(),
    patchDormitory: vi.fn(),
    deleteDormitory: vi.fn(),
    getDormRooms: vi.fn(),
    createDormRoom: vi.fn(),
    patchDormRoom: vi.fn(),
    deleteDormRoom: vi.fn(),
    generateHousing: vi.fn(),
    commitHousing: vi.fn(),
}))

const DORM = { id: 'd1', name: 'Bisoke', gender: 'male', is_active: true, room_count: 2, bed_count: 8 }
const ROOMS = [
    { id: 'r1', dormitory: 'd1', dormitory_name: 'Bisoke', room_number: '101', bed_capacity: 4, is_active: true },
    { id: 'r2', dormitory: 'd1', dormitory_name: 'Bisoke', room_number: '102', bed_capacity: 4, is_active: true },
]

const PLAN = {
    assignments: [],
    rooms: [
        { room_id: 'r1', dormitory: 'Bisoke', room_number: '101', gender: 'male', capacity: 4, occupied: 4, free: 0, groups: ['1A'] },
        { room_id: 'r2', dormitory: 'Bisoke', room_number: '102', gender: 'male', capacity: 4, occupied: 3, free: 1, groups: ['2B'] },
    ],
    unplaced: [
        { boarding_id: 'b9', student_name: 'Iris N.', group: '3C', reason: 'All matching rooms are full — no free beds left.' },
    ],
    summary: { students: 8, placed: 7, unplaced: 1, rooms: 2, rooms_used: 2, free_beds: 1, capacity: 8 },
    warnings: [],
}

describe('DormPlannerTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getDormitories.mockResolvedValue([DORM])
        getDormRooms.mockResolvedValue(ROOMS)
    })

    it('lists dormitories and their rooms once loaded', async () => {
        renderWithRouter(<DormPlannerTab />)
        await waitFor(() => expect(screen.getByText(/101 · 4 beds/)).toBeInTheDocument())
        expect(screen.getAllByText('Bisoke').length).toBeGreaterThan(0)
        expect(screen.getByText(/102 · 4 beds/)).toBeInTheDocument()
        expect(screen.getByText(/8 bed\(s\) across 2 active room\(s\)/)).toBeInTheDocument()
    })

    it('prompts to add rooms when none exist', async () => {
        getDormitories.mockResolvedValue([])
        getDormRooms.mockResolvedValue([])
        renderWithRouter(<DormPlannerTab />)
        await waitFor(() => expect(screen.getByText(/No dormitories yet/)).toBeInTheDocument())
        expect(screen.getByRole('button', { name: /Generate/i })).toBeDisabled()
    })

    it('creates a dormitory', async () => {
        createDormitory.mockResolvedValue({})
        renderWithRouter(<DormPlannerTab />)
        await waitFor(() => expect(screen.getByText(/101 · 4 beds/)).toBeInTheDocument())

        fireEvent.change(screen.getByPlaceholderText(/Dormitory name/i), { target: { value: 'Karisimbi' } })
        fireEvent.change(screen.getByLabelText('Dormitory gender'), { target: { value: 'female' } })
        fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0])

        await waitFor(() => expect(createDormitory).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Karisimbi', gender: 'female' })
        ))
    })

    it('creates a room', async () => {
        createDormRoom.mockResolvedValue({})
        renderWithRouter(<DormPlannerTab />)
        await waitFor(() => expect(screen.getByText(/101 · 4 beds/)).toBeInTheDocument())

        fireEvent.change(screen.getByLabelText('Room dormitory'), { target: { value: 'd1' } })
        fireEvent.change(screen.getByPlaceholderText('Room no.'), { target: { value: '103' } })
        fireEvent.change(screen.getByLabelText('Bed capacity'), { target: { value: '6' } })
        fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[1])

        await waitFor(() => expect(createDormRoom).toHaveBeenCalledWith(
            expect.objectContaining({ dormitory: 'd1', room_number: '103', bed_capacity: 6 })
        ))
    })

    it('deletes a dormitory', async () => {
        deleteDormitory.mockResolvedValue({})
        renderWithRouter(<DormPlannerTab />)
        await waitFor(() => expect(screen.getByText(/101 · 4 beds/)).toBeInTheDocument())

        fireEvent.click(screen.getByTitle('Delete Bisoke'))
        await waitFor(() => expect(deleteDormitory).toHaveBeenCalledWith('d1'))
    })

    it('previews a plan with occupancy, unplaced students and a summary', async () => {
        generateHousing.mockResolvedValue(PLAN)
        renderWithRouter(<DormPlannerTab />)
        await waitFor(() => expect(screen.getByText(/101 · 4 beds/)).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Generate/i }))
        fireEvent.click(screen.getByRole('button', { name: /Preview/i }))

        await waitFor(() => expect(screen.getByText('7 placed')).toBeInTheDocument())
        expect(screen.getByText('1 unplaced')).toBeInTheDocument()
        expect(screen.getByText('4/4')).toBeInTheDocument()
        expect(screen.getByText('3/4')).toBeInTheDocument()
        expect(screen.getByText('1A')).toBeInTheDocument()
        expect(screen.getByText('Iris N.')).toBeInTheDocument()
        expect(screen.getByText(/no free beds left/)).toBeInTheDocument()
        // Preview must not have written anything.
        expect(commitHousing).not.toHaveBeenCalled()
    })

    it('commits the previewed plan', async () => {
        generateHousing.mockResolvedValue(PLAN)
        commitHousing.mockResolvedValue({ updated: 7, cleared: 1, summary: PLAN.summary })
        renderWithRouter(<DormPlannerTab />)
        await waitFor(() => expect(screen.getByText(/101 · 4 beds/)).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Generate/i }))
        fireEvent.click(screen.getByRole('button', { name: /Preview/i }))
        await waitFor(() => expect(screen.getByText('7 placed')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Save 7 assignment/i }))
        await waitFor(() => expect(commitHousing).toHaveBeenCalledWith({}))
    })

    it('limits generation to the selected dormitories', async () => {
        generateHousing.mockResolvedValue(PLAN)
        renderWithRouter(<DormPlannerTab />)
        await waitFor(() => expect(screen.getByText(/101 · 4 beds/)).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Generate/i }))
        // The dormitory toggle inside the modal.
        fireEvent.click(screen.getAllByRole('button', { name: 'Bisoke' })[0])
        fireEvent.click(screen.getByRole('button', { name: /Preview/i }))

        await waitFor(() => expect(generateHousing).toHaveBeenCalledWith({ dormitory_ids: ['d1'] }))
    })

    it('surfaces a generator error instead of failing silently', async () => {
        generateHousing.mockRejectedValue({ response: { data: { detail: 'No active dormitory rooms configured' } } })
        renderWithRouter(<DormPlannerTab />)
        await waitFor(() => expect(screen.getByText(/101 · 4 beds/)).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: /Generate/i }))
        fireEvent.click(screen.getByRole('button', { name: /Preview/i }))

        await waitFor(() => expect(screen.getByText(/No active dormitory rooms configured/)).toBeInTheDocument())
    })
})
