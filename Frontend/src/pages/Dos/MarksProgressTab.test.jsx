import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { MarksProgressTab } from './MarksProgressTab'
import { getMarksProgress, remindTeachers } from '../../api/dos'
import { confirmDialog } from '../../utils/confirm'

vi.mock('../../api/dos', () => ({
  getMarksProgress: vi.fn(),
  remindTeachers: vi.fn(),
}))
vi.mock('../../utils/confirm', () => ({ confirmDialog: vi.fn() }))

const cell = (c, s, state, extra = {}) => ({
  class_id: c, subject_id: s, teacher_id: `t-${c}-${s}`, teacher_name: `Teacher ${s}`,
  total: 4, entered: 4, submitted: 0, approved: 0, state, ...extra,
})

const GRID = {
  term: { id: 't1', name: 'Term 1 2025' },
  classes: [{ id: 'c1', name: 'S1A' }, { id: 'c2', name: 'S1B' }],
  subjects: [{ id: 'm', name: 'Maths' }, { id: 'e', name: 'English' }],
  cells: [
    cell('c1', 'm', 'approved', { approved: 4 }),
    cell('c1', 'e', 'partial', { entered: 2 }),
    cell('c2', 'm', 'missing', { entered: 0 }),
    // S1B English: nobody teaches it, so there is no cell at all
  ],
  summary: { approved: 1, submitted: 0, partial: 1, missing: 1, empty: 0 },
}

describe('MarksProgressTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMarksProgress.mockResolvedValue(GRID)
    confirmDialog.mockResolvedValue(true)
  })

  it('shows skeleton rows while the grid loads, announced once', () => {
    getMarksProgress.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<MarksProgressTab />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading how far the marks have got…')
    expect(document.querySelectorAll('.skel').length).toBeGreaterThan(0)
  })

  it('lays the term out as classes down and subjects across', async () => {
    renderWithRouter(<MarksProgressTab />)
    expect(await screen.findByRole('columnheader', { name: 'Maths' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'English' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'S1A' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'S1B' })).toBeInTheDocument()
  })

  it('says in words, not only colour, how far each cell has got', async () => {
    renderWithRouter(<MarksProgressTab />)
    const row = (await screen.findByRole('rowheader', { name: 'S1A' })).closest('tr')
    expect(within(row).getByText(/Approved: Teacher m, 4\/4/)).toBeInTheDocument()
    expect(within(row).getByText(/In progress: Teacher e, 2\/4/)).toBeInTheDocument()
  })

  it('marks a subject nobody teaches in that class as not taught, not as missing', async () => {
    renderWithRouter(<MarksProgressTab />)
    const row = (await screen.findByRole('rowheader', { name: 'S1B' })).closest('tr')
    expect(within(row).getByTitle('Not taught')).toHaveTextContent('–')
  })

  it('totals each state in a legend', async () => {
    renderWithRouter(<MarksProgressTab />)
    await screen.findByRole('rowheader', { name: 'S1A' })
    const legend = screen.getByRole('list')
    expect(within(legend).getByText('Approved').closest('li')).toHaveTextContent('1')
    expect(within(legend).getByText('Not started').closest('li')).toHaveTextContent('1')
  })

  it('asks before reminding teachers, and does nothing if the answer is no', async () => {
    confirmDialog.mockResolvedValue(false)
    renderWithRouter(<MarksProgressTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Remind teachers/ }))
    await waitFor(() => expect(confirmDialog).toHaveBeenCalled())
    expect(remindTeachers).not.toHaveBeenCalled()
  })

  it('sends the reminders and says how many teachers were reminded', async () => {
    remindTeachers.mockResolvedValue({ notified: 2, skipped_recent: 0, open: 2 })
    renderWithRouter(<MarksProgressTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Remind teachers/ }))
    await waitFor(() => expect(remindTeachers).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Reminders sent to 2 teachers.')).toBeInTheDocument()
  })

  it('uses the singular for one teacher', async () => {
    remindTeachers.mockResolvedValue({ notified: 1, skipped_recent: 0, open: 1 })
    renderWithRouter(<MarksProgressTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Remind teachers/ }))
    expect(await screen.findByText('Reminder sent to 1 teacher.')).toBeInTheDocument()
  })

  it('says who was left out because they were reminded recently', async () => {
    remindTeachers.mockResolvedValue({ notified: 1, skipped_recent: 2, open: 3 })
    renderWithRouter(<MarksProgressTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Remind teachers/ }))
    expect(await screen.findByText(/2 reminded recently, so left out\./)).toBeInTheDocument()
  })

  it('shows the failure instead of failing silently', async () => {
    remindTeachers.mockRejectedValue(new Error('down'))
    renderWithRouter(<MarksProgressTab />)
    fireEvent.click(await screen.findByRole('button', { name: /Remind teachers/ }))
    expect(await screen.findByText(/down|Could not send the reminders/)).toBeInTheDocument()
  })

  it('has nothing to remind when everything is in, so the button is off', async () => {
    getMarksProgress.mockResolvedValue({
      ...GRID, cells: [cell('c1', 'm', 'approved', { approved: 4 })],
      summary: { approved: 1, submitted: 0, partial: 0, missing: 0, empty: 0 },
    })
    renderWithRouter(<MarksProgressTab />)
    expect(await screen.findByRole('button', { name: /Remind teachers/ })).toBeDisabled()
  })

  it('shows an empty state when no teaching is assigned yet', async () => {
    getMarksProgress.mockResolvedValue({ ...GRID, cells: [], classes: [], subjects: [] })
    renderWithRouter(<MarksProgressTab />)
    expect(await screen.findByText('No teaching assignments for this term yet.')).toBeInTheDocument()
  })

  it('reports a failed load', async () => {
    getMarksProgress.mockRejectedValue(new Error('boom'))
    renderWithRouter(<MarksProgressTab />)
    expect(await screen.findByText(/boom|Could not load how far/)).toBeInTheDocument()
  })
})
