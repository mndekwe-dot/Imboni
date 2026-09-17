import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { ParentMaterials } from './ParentMaterials'
import { getMyChildren, getChildMaterials } from '../../api/parent'

vi.mock('../../api/parent', () => ({
  getMyChildren: vi.fn(),
  getChildMaterials: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const CHILDREN = [
  { id: 1, student_name: 'Eric N.', grade: 'S4', section: 'A' },
  { id: 2, student_name: 'Alice M.', grade: 'S5', section: 'B' },
]
const material = title => ({
  id: title, title, subject_name: 'Mathematics', kind: 'link', url: 'https://example.com', file: null,
  description: '', teacher_name: 'Claire Umutoni', created_at: '2026-09-10T08:00:00Z',
})

describe('ParentMaterials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getChildMaterials.mockImplementation(id => Promise.resolve([material(id === 1 ? 'Eric notes' : 'Alice notes')]))
  })

  it('shows the no-children message when none are linked', async () => {
    getMyChildren.mockResolvedValue([])
    renderWithRouter(<ParentMaterials />)
    expect(await screen.findByText('No children linked to your account yet.')).toBeInTheDocument()
  })

  it("lists the first child's materials, with no switcher for a single child", async () => {
    getMyChildren.mockResolvedValue([CHILDREN[0]])
    renderWithRouter(<ParentMaterials />)

    expect(await screen.findByRole('link', { name: 'Eric notes' })).toBeInTheDocument()
    expect(getChildMaterials).toHaveBeenCalledWith(1)
    expect(screen.queryByLabelText('Child:')).not.toBeInTheDocument()
  })

  it("switching child loads that child's materials", async () => {
    getMyChildren.mockResolvedValue(CHILDREN)
    renderWithRouter(<ParentMaterials />)
    await screen.findByRole('link', { name: 'Eric notes' })

    fireEvent.change(screen.getByLabelText('Child:'), { target: { value: '1' } })

    await waitFor(() => expect(screen.getByRole('link', { name: 'Alice notes' })).toBeInTheDocument())
    expect(getChildMaterials).toHaveBeenLastCalledWith(2)
  })
})
