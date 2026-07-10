import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, waitFor } from '../../test/test-utils'
import { DisStudentLeaders } from './DisStudentLeaders'
import { getDisStudentLeaders } from '../../api/discipline'

vi.mock('../../api/discipline', () => ({
  getDisStudentLeaders: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const LEADERS = [
  { id: 1, student_name: 'Alice M.', student_id: 'STU001', grade: '5', section: 'A', role: 'head_girl',    appointed_date: '2026-01-10', notes: null },
  { id: 2, student_name: 'Bob K.',   student_id: 'STU002', grade: '4', section: 'B', role: 'prefect',      appointed_date: '2026-01-12', notes: null },
  { id: 3, student_name: 'Carol N.', student_id: 'STU003', grade: '3', section: 'A', role: 'house_captain', appointed_date: '2026-01-15', notes: 'Bisoke' },
]

describe('DisStudentLeaders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state while data is in flight', () => {
    getDisStudentLeaders.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DisStudentLeaders />)
    expect(screen.getByText('Loading leaders…')).toBeInTheDocument()
  })

  it('shows empty-state messages when no leaders are assigned', async () => {
    getDisStudentLeaders.mockResolvedValue([])
    renderWithRouter(<DisStudentLeaders />)
    await waitFor(() => expect(screen.getByText('No prefects appointed this term.')).toBeInTheDocument())
    expect(screen.getByText('No house captains appointed this term.')).toBeInTheDocument()
  })

  it('renders stat counts once leaders load', async () => {
    getDisStudentLeaders.mockResolvedValue(LEADERS)
    renderWithRouter(<DisStudentLeaders />)
    await waitFor(() => expect(screen.getByText('Alice M.')).toBeInTheDocument())
    expect(screen.getByText('Total Prefects')).toBeInTheDocument()
    expect(screen.getAllByText('House Captains').length).toBeGreaterThan(0)
    expect(screen.getByText('Total Leaders')).toBeInTheDocument()
  })

  it('renders prefect cards for head and regular prefects', async () => {
    getDisStudentLeaders.mockResolvedValue(LEADERS)
    renderWithRouter(<DisStudentLeaders />)
    await waitFor(() => expect(screen.getByText('Alice M.')).toBeInTheDocument())
    expect(screen.getByText('Bob K.')).toBeInTheDocument()
    expect(screen.getByText('Head Girl')).toBeInTheDocument()
    expect(screen.getAllByText('Head Prefect').length).toBeGreaterThan(0)
  })

  it('renders house captains in the table', async () => {
    getDisStudentLeaders.mockResolvedValue(LEADERS)
    renderWithRouter(<DisStudentLeaders />)
    await waitFor(() => expect(screen.getByText('Carol N.')).toBeInTheDocument())
    expect(screen.getByText('STU003')).toBeInTheDocument()
    expect(screen.getByText('House Captain')).toBeInTheDocument()
    expect(screen.getByText('Bisoke')).toBeInTheDocument()
  })
})
