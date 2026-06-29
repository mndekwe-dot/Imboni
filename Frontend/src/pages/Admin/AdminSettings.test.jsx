import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { AdminSettings } from './AdminSettings'
import {
  getSchoolSettings, updateSchoolSettings,
  getSchoolConfig, updateSchoolConfig,
  getSubjects, createSubject, updateSubject, deleteSubject,
  renameSubjectCategory, deleteSubjectCategory,
  getDosRooms, createDosRoom, deleteDosRoom,
} from '../../api/dos'

vi.mock('../../api/dos', () => ({
  getSchoolSettings: vi.fn(),
  updateSchoolSettings: vi.fn(),
  getSchoolConfig: vi.fn(),
  updateSchoolConfig: vi.fn(),
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

describe('AdminSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSchoolSettings.mockResolvedValue({ school_name: 'Imboni Academy', timezone: 'Africa/Kigali' })
    getSchoolConfig.mockResolvedValue([])
    getSubjects.mockResolvedValue([])
    getDosRooms.mockResolvedValue([])
  })

  it('defaults to the School Info section, pre-filled from settings', async () => {
    renderWithRouter(<AdminSettings />)
    await waitFor(() => expect(screen.getByDisplayValue('Imboni Academy')).toBeInTheDocument())
  })

  it('saves school info changes', async () => {
    updateSchoolSettings.mockResolvedValue({})
    renderWithRouter(<AdminSettings />)
    await waitFor(() => expect(screen.getByDisplayValue('Imboni Academy')).toBeInTheDocument())

    fireEvent.change(screen.getByDisplayValue('Imboni Academy'), { target: { value: 'New Name Academy' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }))

    await waitFor(() => expect(updateSchoolSettings).toHaveBeenCalledWith({ school_name: 'New Name Academy', timezone: 'Africa/Kigali' }))
    expect(await screen.findByText('Saved!')).toBeInTheDocument()
  })

  it('shows the getting-started message for an empty School Structure', async () => {
    renderWithRouter(<AdminSettings />)
    fireEvent.click(screen.getByRole('button', { name: /School Structure/ }))

    await waitFor(() => expect(screen.getByText('Getting started')).toBeInTheDocument())
  })

  it('adds a section to the school structure', async () => {
    updateSchoolConfig.mockResolvedValue([{ name: 'O-Level', years: [] }])
    renderWithRouter(<AdminSettings />)
    fireEvent.click(screen.getByRole('button', { name: /School Structure/ }))
    await waitFor(() => expect(screen.getByText('Getting started')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('e.g. O-Level'), { target: { value: 'O-Level' } })
    fireEvent.click(screen.getByRole('button', { name: /Add/ }))

    await waitFor(() => expect(updateSchoolConfig).toHaveBeenCalledWith([{ name: 'O-Level', years: [] }]))
  })

  it('shows the empty message for Subjects with no types yet', async () => {
    renderWithRouter(<AdminSettings />)
    fireEvent.click(screen.getByRole('button', { name: /Subjects/ }))

    await waitFor(() => expect(screen.getByText('No subject types yet — add one above.')).toBeInTheDocument())
  })

  it('adds a subject type', async () => {
    renderWithRouter(<AdminSettings />)
    fireEvent.click(screen.getByRole('button', { name: /Subjects/ }))
    await waitFor(() => expect(screen.getByText('No subject types yet — add one above.')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('e.g. Sciences'), { target: { value: 'Sciences' } })
    fireEvent.click(screen.getByRole('button', { name: /Add Type/ }))

    expect(screen.getByText('Sciences')).toBeInTheDocument()
  })

  it('shows the empty rooms message, then adds and removes a room', async () => {
    createDosRoom.mockResolvedValue({ id: 1, name: 'Lab 1' })
    deleteDosRoom.mockResolvedValue({})
    renderWithRouter(<AdminSettings />)
    fireEvent.click(screen.getByRole('button', { name: /Rooms/ }))
    await waitFor(() => expect(screen.getByText('No rooms yet — add one above')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('e.g. Lab 1, Room 12, Hall A'), { target: { value: 'Lab 1' } })
    fireEvent.click(screen.getByRole('button', { name: /Add/ }))

    await waitFor(() => expect(createDosRoom).toHaveBeenCalledWith('Lab 1'))
    expect(await screen.findByText('Lab 1')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Lab 1').closest('.tag-chip').querySelector('.tag-chip-remove'))

    await waitFor(() => expect(deleteDosRoom).toHaveBeenCalledWith(1))
    expect(screen.queryByText('Lab 1')).not.toBeInTheDocument()
  })

  it('shows a "coming soon" placeholder for not-yet-implemented sections', async () => {
    renderWithRouter(<AdminSettings />)
    fireEvent.click(screen.getByRole('button', { name: /Academic Calendar/ }))

    expect(screen.getByText('Configuration options coming soon.')).toBeInTheDocument()
  })
})
