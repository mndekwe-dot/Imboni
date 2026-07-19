import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { ParentTimetable } from './ParentTimetable'
import { getMyChildren } from '../../api/parent'

vi.mock('../../api/parent', () => ({
  getMyChildren: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const CHILDREN = [
  { id: 1, student_name: 'Eric N.', grade: '4', section: 'A' },
  { id: 2, student_name: 'Alice M.', grade: '5', section: 'B' },
]

describe('ParentTimetable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state before children resolve', () => {
    getMyChildren.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<ParentTimetable />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the no-children message when none are linked', async () => {
    getMyChildren.mockResolvedValue([])
    renderWithRouter(<ParentTimetable />)
    await waitFor(() => expect(screen.getByText('No children linked to your account.')).toBeInTheDocument())
  })

  it('renders the timetable for the first child by default, with no child switcher for a single child', async () => {
    getMyChildren.mockResolvedValue([CHILDREN[0]])
    renderWithRouter(<ParentTimetable />)

    await waitFor(() => expect(screen.getByText('Eric N. (Class 4A)')).toBeInTheDocument())
    expect(screen.queryByLabelText('Child:')).not.toBeInTheDocument()
  })

  it('shows a child switcher and updates the timetable heading when multiple children are linked', async () => {
    getMyChildren.mockResolvedValue(CHILDREN)
    renderWithRouter(<ParentTimetable />)
    await waitFor(() => expect(screen.getByText('Eric N. (Class 4A)')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Child:'), { target: { value: '1' } })

    expect(screen.getByText('Alice M. (Class 5B)')).toBeInTheDocument()
  })

  it('handles a paginated {results:[]} response shape from getMyChildren', async () => {
    getMyChildren.mockResolvedValue({ results: [CHILDREN[0]] })
    renderWithRouter(<ParentTimetable />)
    await waitFor(() => expect(screen.getByText('Eric N. (Class 4A)')).toBeInTheDocument())
  })
})
