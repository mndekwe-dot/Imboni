import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor } from '../../test/test-utils'
import { StudentDiscipline } from './StudentDiscipline'
import { getStudentProfile, getStudentDiscipline } from '../../api/student'
import { getSchoolSettings } from '../../api/dos'

vi.mock('../../api/student', () => ({
    getStudentProfile: vi.fn(),
    getStudentDiscipline: vi.fn(),
}))

vi.mock('../../api/dos', () => ({
    getSchoolSettings: vi.fn(),
}))

const PROFILE = { grade: 'S4', section: 'A' }

const DISCIPLINE = {
    conduct_grade: 'B',
    conduct_label: 'Good Standing',
    reports: [
        { id: 1, report_type: 'positive', description: 'Helped organize event', reported_by: 'Mr. X', date: '2024-03-01' },
        { id: 2, report_type: 'incident', description: 'Late to class', reported_by: 'Ms. Y', date: '2024-03-05' },
        { id: 3, report_type: 'warning', description: 'Uniform violation', reported_by: 'Mr. Z', date: '2024-03-10' },
    ],
}

beforeEach(() => {
    getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali', school_name: 'Imboni' })
})

describe('StudentDiscipline', () => {
    it('shows loading state initially', () => {
        getStudentProfile.mockReturnValue(new Promise(() => {}))
        getStudentDiscipline.mockReturnValue(new Promise(() => {}))

        renderWithRouter(<StudentDiscipline />)

        expect(screen.getByText('Loading records…')).toBeInTheDocument()
    })

    it('renders discipline records and conduct stats once loaded', async () => {
        getStudentProfile.mockResolvedValue(PROFILE)
        getStudentDiscipline.mockResolvedValue(DISCIPLINE)

        renderWithRouter(<StudentDiscipline />)

        await waitFor(() => expect(screen.getByText('Helped organize event')).toBeInTheDocument())

        expect(screen.getByText('Late to class')).toBeInTheDocument()
        expect(screen.getByText('Uniform violation')).toBeInTheDocument()
        expect(screen.getByText('B')).toBeInTheDocument()
        expect(screen.getByText('Good Standing')).toBeInTheDocument()
        expect(screen.getByText('+1')).toBeInTheDocument()
        expect(screen.getByText('-1')).toBeInTheDocument()
    })

    it('filters records by type when a filter tab is clicked', async () => {
        getStudentProfile.mockResolvedValue(PROFILE)
        getStudentDiscipline.mockResolvedValue(DISCIPLINE)

        const { fireEvent } = await import('../../test/test-utils')
        renderWithRouter(<StudentDiscipline />)

        await waitFor(() => expect(screen.getByText('Helped organize event')).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', { name: 'Positive' }))

        expect(screen.getByText('Helped organize event')).toBeInTheDocument()
        expect(screen.queryByText('Late to class')).not.toBeInTheDocument()
        expect(screen.queryByText('Uniform violation')).not.toBeInTheDocument()
    })

    it('shows empty message when there are no discipline records', async () => {
        getStudentProfile.mockResolvedValue(PROFILE)
        getStudentDiscipline.mockResolvedValue({ conduct_grade: 'A', conduct_label: 'Excellent', reports: [] })

        renderWithRouter(<StudentDiscipline />)

        await waitFor(() => expect(screen.getByText('No records found.')).toBeInTheDocument())
    })
})
