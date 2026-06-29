import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor, within } from '../../test/test-utils'
import { DisSettings } from './DisSettings'
import {
  getDisFacilities, createDisFacility, patchDisFacility, deleteDisFacility,
  getDisFacilitySections, createDisFacilitySection, patchDisFacilitySection, deleteDisFacilitySection,
} from '../../api/discipline'
import { getSchoolConfig, updateSchoolConfig } from '../../api/dos'

vi.mock('../../api/discipline', () => ({
  getDisFacilities: vi.fn(),
  createDisFacility: vi.fn(),
  patchDisFacility: vi.fn(),
  deleteDisFacility: vi.fn(),
  getDisFacilitySections: vi.fn(),
  createDisFacilitySection: vi.fn(),
  patchDisFacilitySection: vi.fn(),
  deleteDisFacilitySection: vi.fn(),
}))

vi.mock('../../api/dos', () => ({
  getSchoolConfig: vi.fn(),
  updateSchoolConfig: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

describe('DisSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSchoolConfig.mockResolvedValue([])
  })

  it('shows empty-state messages on the facilities tab before anything is added', async () => {
    getDisFacilities.mockResolvedValue([])
    getDisFacilitySections.mockResolvedValue([])
    renderWithRouter(<DisSettings />)

    await waitFor(() => expect(screen.getByText('No dormitories configured yet.')).toBeInTheDocument())
    expect(screen.getByText('No dining halls configured yet.')).toBeInTheDocument()
    expect(screen.getByText(/No sections yet\./)).toBeInTheDocument()
  })

  it('adds a dormitory section', async () => {
    getDisFacilities.mockResolvedValue([])
    getDisFacilitySections.mockResolvedValue([])
    createDisFacilitySection.mockResolvedValue({ id: 1, name: 'Boys Section', gender: 'boys' })
    renderWithRouter(<DisSettings />)
    await waitFor(() => expect(screen.getByText(/No sections yet\./)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Add Section/ }))
    const modal = screen.getByPlaceholderText('e.g. Boys Section, Girls Wing').closest('.modal-box')
    fireEvent.change(screen.getByPlaceholderText('e.g. Boys Section, Girls Wing'), { target: { value: 'Boys Section' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Boys' }))
    fireEvent.click(within(modal).getByRole('button', { name: /Add Section/ }))

    await waitFor(() => expect(createDisFacilitySection).toHaveBeenCalledWith({ name: 'Boys Section', gender: 'boys', description: '' }))
  })

  it('renders dormitory cards once loaded', async () => {
    getDisFacilities.mockResolvedValue([
      { id: 1, name: 'Bisoke', facility_type: 'dormitory', gender: 'boys', capacity: 60 },
    ])
    getDisFacilitySections.mockResolvedValue([])
    renderWithRouter(<DisSettings />)

    await waitFor(() => expect(screen.getByText('Bisoke')).toBeInTheDocument())
    expect(screen.getByText('Capacity: 60')).toBeInTheDocument()
  })

  it('adds a dormitory via the facility modal', async () => {
    getDisFacilities.mockResolvedValue([])
    getDisFacilitySections.mockResolvedValue([])
    createDisFacility.mockResolvedValue({ id: 2, name: 'Karisimbi', facility_type: 'dormitory', gender: 'girls' })
    renderWithRouter(<DisSettings />)
    await waitFor(() => expect(screen.getByText('No dormitories configured yet.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Add Dormitory/ }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Bisoke'), { target: { value: 'Karisimbi' } })
    fireEvent.click(screen.getByRole('button', { name: /Add Facility/ }))

    await waitFor(() => expect(createDisFacility).toHaveBeenCalledWith(expect.objectContaining({ name: 'Karisimbi', facility_type: 'dormitory' })))
  })

  it('switches to the School Structure tab and adds a section', async () => {
    getDisFacilities.mockResolvedValue([])
    getDisFacilitySections.mockResolvedValue([])
    updateSchoolConfig.mockResolvedValue([{ name: 'O-Level', years: [] }])
    renderWithRouter(<DisSettings />)
    await waitFor(() => expect(screen.getByText('No dormitories configured yet.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /School Structure/ }))
    await waitFor(() => expect(screen.getByText('Sections, Years & Classes')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('e.g. O-Level'), { target: { value: 'O-Level' } })
    fireEvent.click(screen.getByRole('button', { name: /Add/ }))

    await waitFor(() => expect(updateSchoolConfig).toHaveBeenCalledWith([{ name: 'O-Level', years: [] }]))
  })
})
