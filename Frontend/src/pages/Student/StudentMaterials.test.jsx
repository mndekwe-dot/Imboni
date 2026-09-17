import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { StudentMaterials } from './StudentMaterials'
import { getStudentMaterials } from '../../api/student'

vi.mock('../../api/student', () => ({ getStudentMaterials: vi.fn() }))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const material = (id, title, subject, extra = {}) => ({
  id, title, subject_name: subject, kind: 'link', url: `https://example.com/${id}`, file: null,
  description: '', teacher_name: 'Claire Umutoni', class_name: 'S4A', created_at: '2026-09-10T08:00:00Z', ...extra,
})

describe('StudentMaterials', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the empty state when nothing has been shared', async () => {
    getStudentMaterials.mockResolvedValue([])
    renderWithRouter(<StudentMaterials />)
    expect(await screen.findByText('No materials yet')).toBeInTheDocument()
  })

  it('groups materials by subject, with the teacher who shared each one', async () => {
    getStudentMaterials.mockResolvedValue([
      material('a', 'Fractions notes', 'Mathematics', { description: 'Read before Monday' }),
      material('b', 'Cells video', 'Biology', { kind: 'video' }),
    ])
    renderWithRouter(<StudentMaterials />)

    expect(await screen.findByRole('heading', { name: 'Mathematics' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Biology' })).toBeInTheDocument()
    expect(screen.getByText('Read before Monday')).toBeInTheDocument()
    expect(screen.getAllByText(/Claire Umutoni/).length).toBe(2)
    expect(screen.getByRole('link', { name: 'Cells video: Watch' })).toHaveAttribute('href', 'https://example.com/b')
  })

  it('narrows the list to one subject', async () => {
    getStudentMaterials.mockResolvedValue([
      material('a', 'Fractions notes', 'Mathematics'),
      material('b', 'Cells video', 'Biology'),
    ])
    renderWithRouter(<StudentMaterials />)
    await screen.findByRole('link', { name: 'Fractions notes' })

    fireEvent.click(screen.getByRole('button', { name: /^Biology/ }))

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Fractions notes' })).not.toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Cells video' })).toBeInTheDocument()
  })

  it('says so when the list cannot be loaded', async () => {
    getStudentMaterials.mockRejectedValue({ response: { data: { detail: 'Server down' } } })
    renderWithRouter(<StudentMaterials />)
    expect((await screen.findAllByText('Server down')).length).toBeGreaterThan(0)
  })
})
