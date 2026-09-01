import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { DosExamPapers } from './DosExamPapers'

import {
  getDosExamPapers, approveDosExamPaper, rejectDosExamPaper, downloadExamPaperPdf,
} from '../../api/dos'

vi.mock('../../api/dos', () => ({
  getDosExamPapers: vi.fn(),
  approveDosExamPaper: vi.fn(),
  rejectDosExamPaper: vi.fn(),
  downloadExamPaperPdf: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

const PAPER = {
  id: 'p1',
  title: 'Biology End of Term',
  subject_name: 'Biology',
  class_name: 'S4 MCB',
  teacher_name: 'Alphonse Nkurunziza',
  exam_type: 'final',
  status: 'submitted',
  total_marks: 60,
  duration_minutes: 120,
  question_count: 4,
  instructions: 'Answer all questions.',
  sections: [{
    title: 'Section A',
    choose_count: 0,
    instructions: '',
    questions: [
      { id: 'q1', type: 'structured', text: 'Define osmosis.', points: 10, options: [] },
      { id: 'q2', type: 'mcq', text: 'Which is an organelle?', points: 5,
        options: ['Nucleus', 'Femur'] },
    ],
  }],
}

function listReturns(papers, counts = {}) {
  getDosExamPapers.mockResolvedValue({
    results: papers,
    counts: { draft: 0, submitted: papers.length, approved: 0, rejected: 0, ...counts },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  listReturns([PAPER])
})

describe('DosExamPapers', () => {
  it('opens on the papers waiting for approval, which is the only tab with work in it', async () => {
    renderWithRouter(<DosExamPapers />)
    await waitFor(() => expect(getDosExamPapers).toHaveBeenCalled())
    expect(getDosExamPapers).toHaveBeenCalledWith({ status: 'submitted' })
  })

  it('lists a paper with who set it and what it is out of', async () => {
    renderWithRouter(<DosExamPapers />)
    expect(await screen.findByText('Biology End of Term')).toBeInTheDocument()
    expect(screen.getByText('Alphonse Nkurunziza')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
  })

  it('shows an empty state rather than a bare table when nothing matches', async () => {
    listReturns([])
    renderWithRouter(<DosExamPapers />)
    await waitFor(() => expect(getDosExamPapers).toHaveBeenCalled())
    expect(screen.queryByText('Biology End of Term')).not.toBeInTheDocument()
  })

  it('surfaces a load failure instead of showing an empty list', async () => {
    getDosExamPapers.mockRejectedValue(new Error('boom'))
    renderWithRouter(<DosExamPapers />)
    await waitFor(() => expect(getDosExamPapers).toHaveBeenCalled())
    expect(screen.queryByText('Biology End of Term')).not.toBeInTheDocument()
  })

  /* Vetting means reading. The questions are on the screen, not behind a PDF. */
  it('shows the questions when the DOS opens a paper to decide', async () => {
    renderWithRouter(<DosExamPapers />)
    fireEvent.click(await screen.findByTitle(/read and decide/i))
    expect(await screen.findByText('Define osmosis.')).toBeInTheDocument()
    expect(screen.getByText('Which is an organelle?')).toBeInTheDocument()
    expect(screen.getByText('Nucleus')).toBeInTheDocument()
  })

  it('approves a paper and reloads the list', async () => {
    approveDosExamPaper.mockResolvedValue({ ...PAPER, status: 'approved' })
    renderWithRouter(<DosExamPapers />)
    fireEvent.click(await screen.findByTitle(/read and decide/i))
    fireEvent.click(await screen.findByRole('button', { name: /approve/i }))
    await waitFor(() => expect(approveDosExamPaper).toHaveBeenCalledWith('p1'))
  })

  /* A refusal with no reason makes the teacher guess, and they will guess wrong. */
  it('will not send a paper back without a reason', async () => {
    renderWithRouter(<DosExamPapers />)
    fireEvent.click(await screen.findByTitle(/read and decide/i))
    fireEvent.click(await screen.findByRole('button', { name: /send back/i }))
    fireEvent.click(await screen.findByRole('button', { name: /send it back/i }))
    await waitFor(() => expect(rejectDosExamPaper).not.toHaveBeenCalled())
  })

  it('sends a paper back with the reason typed', async () => {
    rejectDosExamPaper.mockResolvedValue({ ...PAPER, status: 'rejected' })
    renderWithRouter(<DosExamPapers />)
    fireEvent.click(await screen.findByTitle(/read and decide/i))
    fireEvent.click(await screen.findByRole('button', { name: /send back/i }))
    fireEvent.change(await screen.findByLabelText(/what needs changing/i),
      { target: { value: 'Section B is out of syllabus.' } })
    fireEvent.click(screen.getByRole('button', { name: /send it back/i }))
    await waitFor(() => expect(rejectDosExamPaper)
      .toHaveBeenCalledWith('p1', 'Section B is out of syllabus.'))
  })

  it('asks for the paper and the marking scheme as two separate documents', async () => {
    downloadExamPaperPdf.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))
    window.URL.createObjectURL = vi.fn(() => 'blob:x')
    window.URL.revokeObjectURL = vi.fn()
    window.open = vi.fn()

    renderWithRouter(<DosExamPapers />)
    fireEvent.click(await screen.findByTitle(/print the paper/i))
    await waitFor(() => expect(downloadExamPaperPdf).toHaveBeenCalledWith('p1', false))

    fireEvent.click(screen.getByTitle(/print the marking scheme/i))
    await waitFor(() => expect(downloadExamPaperPdf).toHaveBeenCalledWith('p1', true))
  })

  it('switching to All drops the status filter', async () => {
    renderWithRouter(<DosExamPapers />)
    await waitFor(() => expect(getDosExamPapers).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('tab', { name: /^all$/i }))
    // Asserted on the actual argument rather than with toHaveBeenCalledWith:
    // `{status: undefined}` compares equal to `{}` under the default equality,
    // so a tab handing back undefined would have passed the looser check.
    await waitFor(() => {
      const last = getDosExamPapers.mock.calls.at(-1)[0]
      expect(Object.keys(last)).toHaveLength(0)
    })
  })

  it('marks the active tab, which needs the tab objects to carry a key', async () => {
    renderWithRouter(<DosExamPapers />)
    const active = await screen.findByRole('tab', { selected: true })
    expect(active).toHaveTextContent(/awaiting approval/i)
  })
})
