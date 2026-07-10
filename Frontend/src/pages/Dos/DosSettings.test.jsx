import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { DosSettings } from './DosSettings'
import {
  getSchoolConfig, updateSchoolConfig, getSchoolSettings, updateSchoolSettings,
  getSubjects, createSubject, getDosRooms, createDosRoom, deleteDosRoom,
} from '../../api/dos'

vi.mock('../../api/dos', () => ({
  getSchoolConfig: vi.fn(),
  updateSchoolConfig: vi.fn(),
  getSchoolSettings: vi.fn(),
  updateSchoolSettings: vi.fn(),
  getSubjects: vi.fn(),
  createSubject: vi.fn(),
  updateSubject: vi.fn(),
  deleteSubject: vi.fn(),
  renameSubjectCategory: vi.fn(),
  deleteSubjectCategory: vi.fn(),
  getDosRooms: vi.fn(),
  createDosRoom: vi.fn(),
  deleteDosRoom: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

describe('DosSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSchoolSettings.mockResolvedValue({ timezone: 'Africa/Kigali', school_name: 'Imboni' })
    getSubjects.mockResolvedValue([])
    getDosRooms.mockResolvedValue([])
  })

  it('shows a loading state before the school config resolves', () => {
    getSchoolConfig.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<DosSettings />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows the getting-started notice for an empty config', async () => {
    getSchoolConfig.mockResolvedValue([])
    renderWithRouter(<DosSettings />)
    await waitFor(() => expect(screen.getByText('Getting started')).toBeInTheDocument())
  })

  it('adds a new section', async () => {
    getSchoolConfig.mockResolvedValue([])
    updateSchoolConfig.mockResolvedValue([{ name: 'O-Level', years: [] }])
    renderWithRouter(<DosSettings />)
    await waitFor(() => expect(screen.getByText('Getting started')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('e.g. O-Level'), { target: { value: 'O-Level' } })
    const sectionsCard = screen.getByText('Sections, Years & Classes').closest('.card')
    fireEvent.click(within(sectionsCard).getByRole('button', { name: /Add/ }))

    await waitFor(() => expect(updateSchoolConfig).toHaveBeenCalledWith([{ name: 'O-Level', years: [] }]))
  })

  it('shows stat cards once sections exist', async () => {
    getSchoolConfig.mockResolvedValue([{ name: 'O-Level', years: [{ name: 'S1', streams: ['A', 'B'] }] }])
    renderWithRouter(<DosSettings />)
    await waitFor(() => expect(screen.getByText('Sections')).toBeInTheDocument())
    expect(screen.getAllByText('Year Groups').length).toBeGreaterThan(0)
    expect(screen.getByText('Stream Classes')).toBeInTheDocument()
  })

  it('adds a subject type and a new room', async () => {
    getSchoolConfig.mockResolvedValue([])
    createDosRoom.mockResolvedValue({ id: 1, name: 'Lab 1' })
    renderWithRouter(<DosSettings />)
    await waitFor(() => expect(screen.getByText('No subject types yet — add one above')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('e.g. Sciences'), { target: { value: 'Sciences' } })
    fireEvent.click(screen.getByRole('button', { name: /Add Type/ }))
    expect(screen.getByText('Sciences')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('e.g. Lab 1, Room 12, Hall A'), { target: { value: 'Lab 1' } })
    const roomsCard = screen.getByText('Rooms & Venues').closest('.card')
    fireEvent.click(within(roomsCard).getByRole('button', { name: /Add/ }))

    await waitFor(() => expect(createDosRoom).toHaveBeenCalledWith('Lab 1'))
    expect(await screen.findByText('Lab 1')).toBeInTheDocument()
  })

  it('saves the timezone setting', async () => {
    getSchoolConfig.mockResolvedValue([])
    updateSchoolSettings.mockResolvedValue({})
    renderWithRouter(<DosSettings />)
    await waitFor(() => expect(screen.getByDisplayValue(/Africa\/Kigali/)).toBeInTheDocument())

    fireEvent.change(screen.getByDisplayValue(/Africa\/Kigali/), { target: { value: 'Africa/Nairobi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateSchoolSettings).toHaveBeenCalledWith({ timezone: 'Africa/Nairobi' }))
  })
})
