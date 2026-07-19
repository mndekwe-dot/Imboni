import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../../test/test-utils'
import { AdminAuditLog } from './AdminAuditLog'
import { getAuditLog } from '../../api/admin'

vi.mock('../../api/admin', () => ({
  getAuditLog: vi.fn(),
}))

vi.mock('../../api/notifications', () => ({
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn(),
}))

const ENTRIES = {
  total: 2,
  page: 1,
  page_size: 50,
  results: [
    {
      id: '1', actor_name: 'Grace M', actor_role: 'admin',
      action: 'invitation.sent', target: 'new.teacher@school.rw',
      detail: { role: 'teacher' }, created_at: '2026-07-01T09:00:00Z',
    },
    {
      id: '2', actor_name: 'Dan K', actor_role: 'dos',
      action: 'result.approved', target: 'John Doe (Maths)',
      detail: {}, created_at: '2026-07-01T08:00:00Z',
    },
  ],
}

describe('AdminAuditLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a loading state while entries are in flight', () => {
    getAuditLog.mockReturnValue(new Promise(() => {}))
    renderWithRouter(<AdminAuditLog />)
    expect(screen.getByText('Loading audit log…')).toBeInTheDocument()
  })

  it('shows an empty state when there are no entries', async () => {
    getAuditLog.mockResolvedValue({ total: 0, page: 1, page_size: 50, results: [] })
    renderWithRouter(<AdminAuditLog />)
    await waitFor(() => expect(screen.getByText(/No audit entries yet/)).toBeInTheDocument())
  })

  it('renders entries with actor, action badge and target', async () => {
    getAuditLog.mockResolvedValue(ENTRIES)
    renderWithRouter(<AdminAuditLog />)
    await waitFor(() => expect(screen.getByText('Grace M')).toBeInTheDocument())
    expect(screen.getByText('Invite Sent')).toBeInTheDocument()
    expect(screen.getByText('new.teacher@school.rw')).toBeInTheDocument()
    expect(screen.getByText('Result Approved')).toBeInTheDocument()
  })

  it('re-queries with the action filter when a chip is clicked', async () => {
    getAuditLog.mockResolvedValue(ENTRIES)
    renderWithRouter(<AdminAuditLog />)
    await waitFor(() => expect(screen.getByText('Grace M')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Invitations' }))

    await waitFor(() =>
      expect(getAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'invitation' })))
  })

  it('re-queries with the search term', async () => {
    getAuditLog.mockResolvedValue(ENTRIES)
    renderWithRouter(<AdminAuditLog />)
    await waitFor(() => expect(screen.getByText('Grace M')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText(/Search by person or target/), { target: { value: 'John' } })

    await waitFor(() =>
      expect(getAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'John' })))
  })
})
