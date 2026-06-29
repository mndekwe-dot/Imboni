import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { DosStudentLeaders } from './DosStudentLeaders'
import { getDosStudentLeaders, getDosActivities, patchDosActivity, deleteDosActivity, getSchoolConfig, getSchoolSettings } from '../../api/dos'

vi.mock('../../api/dos', () => ({
  getDosStudentLeaders: vi.fn(),
  getDosActivities: vi.fn(),
  patchDosActivity: vi.fn(),
  deleteDosActivity: vi.fn(),
  getSchoolConfig: vi.fn(),
  getSchoolSettings: vi.fn(),
}))

const LEADERS = [
  { full_name: 'Eric N.', role: 'Head Boy', grade: '5', section: 'A', appointed_date: '2026-01-15' },
  { full_name: 'Alice M.', role: 'House Captain', grade: '4', section: 'B', appointed_date: '2026-01-10' },
]

const CLUBS = [
  { id: 1, name: 'Chess Club', category: 'other', is_active: true, max_members: 20, enrolled_count: 10 },
]

describe('DosStudentLeaders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSchoolConfig.mockResolvedValue([])
    getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali' })
  })

  it('renders prefects and captains in their respective sections once loaded', async () => {
    getDosStudentLeaders.mockResolvedValue(LEADERS)
    renderWithRouter(<DosStudentLeaders />)

    await waitFor(() => expect(screen.getByText('Eric N.')).toBeInTheDocument())
    expect(screen.getByText('Alice M.')).toBeInTheDocument()
    expect(screen.getByText('Head Boy')).toBeInTheDocument()
  })

  it('shows empty-state messages when there are no leaders yet', async () => {
    getDosStudentLeaders.mockResolvedValue([])
    renderWithRouter(<DosStudentLeaders />)
    await waitFor(() => expect(screen.getByText('No prefects appointed this term.')).toBeInTheDocument())
    expect(screen.getByText('No captains assigned this term.')).toBeInTheDocument()
  })

  it('appoints a new prefect via the modal', async () => {
    getDosStudentLeaders.mockResolvedValue([])
    renderWithRouter(<DosStudentLeaders />)
    await waitFor(() => expect(screen.getByText('No prefects appointed this term.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Appoint Leader/ }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Uwase Amina'), { target: { value: 'New Prefect' } })
    fireEvent.click(screen.getByRole('button', { name: 'Appoint' }))

    expect(screen.getByText('New Prefect')).toBeInTheDocument()
  })

  it('requires a name before appointing', async () => {
    getDosStudentLeaders.mockResolvedValue([])
    renderWithRouter(<DosStudentLeaders />)
    await waitFor(() => expect(screen.getByText('No prefects appointed this term.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Appoint Leader/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Appoint' }))

    expect(screen.getByText('Full name is required')).toBeInTheDocument()
  })

  it('switches to the Clubs tab and loads activities only once', async () => {
    getDosStudentLeaders.mockResolvedValue([])
    getDosActivities.mockResolvedValue(CLUBS)
    renderWithRouter(<DosStudentLeaders />)
    await waitFor(() => expect(screen.getByText('No prefects appointed this term.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Clubs & Activities/ }))
    await waitFor(() => expect(screen.getByText('Chess Club')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Student Leaders/ }))
    fireEvent.click(screen.getByRole('button', { name: /Clubs & Activities/ }))

    expect(getDosActivities).toHaveBeenCalledTimes(1)
  })

  it('toggles a club between active and inactive', async () => {
    getDosStudentLeaders.mockResolvedValue([])
    getDosActivities.mockResolvedValue(CLUBS)
    patchDosActivity.mockResolvedValue({ ...CLUBS[0], is_active: false })
    renderWithRouter(<DosStudentLeaders />)
    await waitFor(() => expect(screen.getByText('No prefects appointed this term.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Clubs & Activities/ }))
    await waitFor(() => expect(screen.getByText('Chess Club')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Deactivate/ }))

    await waitFor(() => expect(patchDosActivity).toHaveBeenCalledWith(1, { is_active: false }))
  })

  it('deletes a club after confirming', async () => {
    getDosStudentLeaders.mockResolvedValue([])
    getDosActivities.mockResolvedValue(CLUBS)
    deleteDosActivity.mockResolvedValue({})
    renderWithRouter(<DosStudentLeaders />)
    await waitFor(() => expect(screen.getByText('No prefects appointed this term.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Clubs & Activities/ }))
    await waitFor(() => expect(screen.getByText('Chess Club')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /delete/ }))
    fireEvent.click(screen.getByText('Yes, delete'))

    await waitFor(() => expect(deleteDosActivity).toHaveBeenCalledWith(1))
  })
})
