import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { DisTimetable } from './DisTimetable'
import {
  getDisExtracurricular, createDisExtracurricular,
  patchDisExtracurricular, deleteDisExtracurricular,
} from '../../api/discipline'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

vi.mock('../../api/discipline', () => ({
  getDisExtracurricular: vi.fn(),
  createDisExtracurricular: vi.fn(),
  patchDisExtracurricular: vi.fn(),
  deleteDisExtracurricular: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const ENTRY = { id: 1, slot_id: 'slot1', day: 'Mon', activity_type: 'club', subject: 'Chess Club', teacher: 'Mr. X', room: 'Hall', week: null }

describe('DisTimetable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state before the schedule resolves', () => {
    getDisExtracurricular.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DisTimetable />)
    expect(screen.getByText('Loading schedule…')).toBeInTheDocument()
  })

  it('renders stat cards once the schedule loads', async () => {
    getDisExtracurricular.mockResolvedValue([ENTRY])
    renderWithRouter(<DisTimetable />)
    await waitFor(() => expect(screen.getByText('Active Clubs')).toBeInTheDocument())
    expect(screen.getByText('Scheduled Slots')).toBeInTheDocument()
  })

  it('opens the Add Slot form', async () => {
    getDisExtracurricular.mockResolvedValue([])
    renderWithRouter(<DisTimetable />)
    await waitFor(() => expect(screen.getByText('Weekly Extracurricular Schedule')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Add Slot/ }))

    expect(screen.getByText('Add Slot', { selector: 'h2' })).toBeInTheDocument()
  })

  it('opens the Edit Time Slots manager', async () => {
    getDisExtracurricular.mockResolvedValue([])
    renderWithRouter(<DisTimetable />)
    await waitFor(() => expect(screen.getByText('Weekly Extracurricular Schedule')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Edit Time Slots/ }))

    expect(screen.getByText('Manage Time Slots')).toBeInTheDocument()
  })
})
