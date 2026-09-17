import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { ParentTimetable } from './ParentTimetable'
import { getMyChildren, getChildTimetable } from '../../api/parent'

vi.mock('../../api/parent', () => ({
  getMyChildren: vi.fn(),
  getChildTimetable: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const CHILDREN = [
  { id: 1, student_name: 'Eric N.', grade: 'S4', section: 'A' },
  { id: 2, student_name: 'Alice M.', grade: 'S5', section: 'B' },
]
const lesson = subject => ({ day: 'monday', start_time: '08:00', end_time: '08:40', subject_name: subject, teacher_name: 'Pacifique Rurangwa', room_number: '12', class_name: 'S4A' })

describe('ParentTimetable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getChildTimetable.mockImplementation(id => Promise.resolve([lesson(id === 1 ? 'Mathematics' : 'Biology')]))
  })

  it('shows a loading state before children resolve', () => {
    getMyChildren.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<ParentTimetable />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the no-children message when none are linked', async () => {
    getMyChildren.mockResolvedValue([])
    renderWithRouter(<ParentTimetable />)
    await waitFor(() => expect(screen.getByText('No children linked to your account yet.')).toBeInTheDocument())
  })

  it("renders the first child's real lessons, with no switcher for a single child", async () => {
    getMyChildren.mockResolvedValue([CHILDREN[0]])
    renderWithRouter(<ParentTimetable />)

    await waitFor(() => expect(screen.getAllByText('Mathematics').length).toBeGreaterThan(0))
    expect(getChildTimetable).toHaveBeenCalledWith(1)
    expect(screen.getByText('Eric N. (Class S4A)')).toBeInTheDocument()
    expect(screen.getAllByText('Pacifique Rurangwa').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Child:')).not.toBeInTheDocument()
  })

  it("switching child loads that child's timetable", async () => {
    getMyChildren.mockResolvedValue({ results: CHILDREN })
    renderWithRouter(<ParentTimetable />)
    await waitFor(() => expect(screen.getAllByText('Mathematics').length).toBeGreaterThan(0))

    fireEvent.change(screen.getByLabelText('Child:'), { target: { value: '1' } })

    await waitFor(() => expect(screen.getAllByText('Biology').length).toBeGreaterThan(0))
    expect(getChildTimetable).toHaveBeenLastCalledWith(2)
    expect(screen.getByText('Alice M. (Class S5B)')).toBeInTheDocument()
  })
})
