import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { DisClearance } from './DisClearance'
import { getClearance, getClearanceDetail } from '../../api/discipline'

vi.mock('../../api/discipline', () => ({
  getClearance: vi.fn(),
  getClearanceDetail: vi.fn(),
}))
vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const ok = { cleared: true }
const row = (over = {}) => ({
  student_id: 'u1', student_code: 'STU-001', full_name: 'Amina Uwase', grade: 'S4', grade_label: 'S4',
  section: 'A', status: 'active', cleared: true, away: false,
  finance: { ...ok, owed: 0 }, library: { ...ok, books_out: 0, owed: 0 },
  medical: { ...ok, in_sick_bay: false, medication: [] },
  ...over,
})

const OWES = row({
  student_id: 'u2', student_code: 'STU-002', full_name: 'Bosco Habimana', cleared: false,
  finance: { cleared: false, owed: 60000 },
})
const BOOKS = row({
  student_id: 'u3', student_code: 'STU-003', full_name: 'Chantal Mukamana', cleared: false,
  library: { cleared: false, books_out: 2, owed: 0 },
})
const BAY = row({
  student_id: 'u4', student_code: 'STU-004', full_name: 'David Nkusi', cleared: false,
  medical: { cleared: false, in_sick_bay: true, medication: [] },
})
const MEDS = row({
  student_id: 'u5', student_code: 'STU-005', full_name: 'Esther Ineza', cleared: false,
  medical: { cleared: false, in_sick_bay: false, medication: ['Amoxicillin'] },
})

const PAGE = { count: 5, results: [row(), OWES, BOOKS, BAY, MEDS], summary: { cleared: 1, blocked: 4 } }

const rowOf = name => screen.getByText(name).closest('tr')

describe('DisClearance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getClearance.mockResolvedValue(PAGE)
  })

  it('shows skeleton rows under the real headers while it loads', () => {
    getClearance.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DisClearance />)
    expect(screen.getByRole('columnheader', { name: 'Fees' })).toBeInTheDocument()
    expect(document.querySelectorAll('tbody tr.skel-tr').length).toBe(10)
    expect(screen.getByText('Loading the clearance list…')).toBeInTheDocument()
  })

  it('says how many can leave and how many cannot, for the whole filter', async () => {
    renderWithRouter(<DisClearance />)
    await screen.findByText('Amina Uwase')
    const tiles = [...document.querySelectorAll('.portal-stat-card')]
    expect(tiles[0]).toHaveTextContent('1')
    expect(tiles[0]).toHaveTextContent('Cleared to leave')
    expect(tiles[1]).toHaveTextContent('4')
    expect(tiles[1]).toHaveTextContent('Not yet cleared')
  })

  it('shows the one fact that blocks each student, not just a no', async () => {
    renderWithRouter(<DisClearance />)
    await screen.findByText('Amina Uwase')
    expect(within(rowOf('Bosco Habimana')).getByText(/Owes 60,000 RWF/)).toBeInTheDocument()
    expect(within(rowOf('Chantal Mukamana')).getByText('2 books still out')).toBeInTheDocument()
    expect(within(rowOf('David Nkusi')).getByText('In the sick bay')).toBeInTheDocument()
    expect(within(rowOf('Esther Ineza')).getByText('Medicine still held')).toBeInTheDocument()
  })

  it('gives a student who owes nothing a clear yes', async () => {
    renderWithRouter(<DisClearance />)
    await screen.findByText('Amina Uwase')
    expect(within(rowOf('Amina Uwase')).getByText('Can leave')).toBeInTheDocument()
    expect(within(rowOf('Bosco Habimana')).getByText('Not yet')).toBeInTheDocument()
  })

  it('says a student is away on an exéat', async () => {
    getClearance.mockResolvedValue({ ...PAGE, results: [row({ away: true })] })
    renderWithRouter(<DisClearance />)
    expect(await screen.findByText('Away on exéat')).toBeInTheDocument()
  })

  it('asks the server for one page, not the whole school', async () => {
    renderWithRouter(<DisClearance />)
    await screen.findByText('Amina Uwase')
    expect(getClearance).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 10 }))
  })

  it('searches on the server once typing pauses, from page 1', async () => {
    renderWithRouter(<DisClearance />)
    await screen.findByText('Amina Uwase')
    fireEvent.change(screen.getByPlaceholderText('Search students…'), { target: { value: 'bosco' } })
    await waitFor(() => expect(getClearance).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'bosco', page: 1 })))
  })

  it('pages through the server\'s total', async () => {
    getClearance.mockResolvedValue({ ...PAGE, count: 23 })
    renderWithRouter(<DisClearance />)
    await screen.findByText('Amina Uwase')
    expect(screen.getByText('1-10 of 23')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Next'))
    await waitFor(() => expect(getClearance).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
  })

  it('opens a student\'s card with the books to bring back', async () => {
    getClearanceDetail.mockResolvedValue({
      ...BOOKS,
      library: { cleared: false, books_out: 2, owed: 0, books: [
        { title: 'Physics Form 4', copy_code: 'PH-12', due_on: '2026-03-01', overdue: true },
        { title: 'Atlas', copy_code: 'AT-02', due_on: '2026-04-01', overdue: false },
      ] },
    })
    renderWithRouter(<DisClearance />)
    await screen.findByText('Amina Uwase')
    fireEvent.click(within(rowOf('Chantal Mukamana')).getByRole('button', { name: 'View' }))

    expect(await screen.findByText('Physics Form 4')).toBeInTheDocument()
    expect(screen.getByText('(PH-12)')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Atlas')).toBeInTheDocument()
    expect(getClearanceDetail).toHaveBeenCalledWith('u3')
    expect(screen.getByText(/Not cleared yet/)).toBeInTheDocument()
  })

  it('names the medicine still held', async () => {
    getClearanceDetail.mockResolvedValue(MEDS)
    renderWithRouter(<DisClearance />)
    await screen.findByText('Amina Uwase')
    fireEvent.click(within(rowOf('Esther Ineza')).getByRole('button', { name: 'View' }))
    expect(await screen.findByText(/Amoxicillin/)).toBeInTheDocument()
  })

  it('tells a cleared student they can leave', async () => {
    getClearanceDetail.mockResolvedValue(row())
    renderWithRouter(<DisClearance />)
    await screen.findByText('Amina Uwase')
    fireEvent.click(within(rowOf('Amina Uwase')).getByRole('button', { name: 'View' }))
    expect(await screen.findByText(/Cleared to leave: nothing is owed/)).toBeInTheDocument()
  })

  it('shows an empty state when no student matches', async () => {
    getClearance.mockResolvedValue({ count: 0, results: [], summary: { cleared: 0, blocked: 0 } })
    renderWithRouter(<DisClearance />)
    expect(await screen.findByText('No students found')).toBeInTheDocument()
  })

  it('reports a failed load instead of failing silently', async () => {
    getClearance.mockRejectedValue(new Error('server down'))
    renderWithRouter(<DisClearance />)
    expect(await screen.findByText(/server down|Could not load the clearance list/)).toBeInTheDocument()
  })
})
