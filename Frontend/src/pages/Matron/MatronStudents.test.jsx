import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, fireEvent, waitFor } from '../../test/test-utils'
import { MatronStudents } from './MatronStudents'
import { getMatronStudents } from '../../api/matron'
import { getSchoolSettings, getSchoolConfig } from '../../api/dos'

vi.mock('../../api/matron', () => ({
    getMatronStudents: vi.fn(),
}))
vi.mock('../../api/dos', () => ({
    getSchoolSettings: vi.fn(),
    getSchoolConfig: vi.fn(),
}))

const STUDENTS = [
    { full_name: 'Iris Niyomugabo', student_code: 'ADM001', grade: 2, section: 'A', room_number: '12', dormitory: 'Karisimbi', boarding_type: 'full' },
    { full_name: 'Peter N.', student_code: 'ADM002', grade: 3, section: 'B', room_number: '14', dormitory: 'Karisimbi', boarding_type: 'day' },
]

describe('MatronStudents', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setSessionUser({ first_name: 'Gloriose', last_name: 'Hakizimana', role: 'matron' })
        getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali', school_name: 'Imboni' })
        getSchoolConfig.mockResolvedValue([])
    })

    it('renders the loading state initially', () => {
        getMatronStudents.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<MatronStudents />)
        expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders the error state when the load fails', async () => {
        getMatronStudents.mockRejectedValue(new Error('Network down'))
        renderWithRouter(<MatronStudents />)
        await waitFor(() => expect(screen.getByText(/Error: Network down/)).toBeInTheDocument())
    })

    it('renders stats and the student table once loaded', async () => {
        getMatronStudents.mockResolvedValue(STUDENTS)
        renderWithRouter(<MatronStudents />)

        await waitFor(() => expect(screen.getByText('Iris Niyomugabo')).toBeInTheDocument())
        expect(screen.getByText('Peter N.')).toBeInTheDocument()
        expect(screen.getByText('Total Students')).toBeInTheDocument()
        expect(screen.getByText('Full Boarders')).toBeInTheDocument()
        expect(screen.getByText('Day Boarders')).toBeInTheDocument()
    })

    it('shows the empty state when there are no students', async () => {
        getMatronStudents.mockResolvedValue([])
        renderWithRouter(<MatronStudents />)
        await waitFor(() => expect(screen.getByText('No students found')).toBeInTheDocument())
    })

    it('debounce-searches by typed text, calling the API with the search param', async () => {
        getMatronStudents.mockResolvedValue(STUDENTS)
        renderWithRouter(<MatronStudents />)
        await waitFor(() => expect(screen.getByText('Iris Niyomugabo')).toBeInTheDocument())

        getMatronStudents.mockClear()
        fireEvent.change(screen.getByPlaceholderText('Search by name or student ID...'), { target: { value: 'Iris' } })

        await waitFor(() => expect(getMatronStudents).toHaveBeenCalledWith({ search: 'Iris' }), { timeout: 1000 })
    })
})
