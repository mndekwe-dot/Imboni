import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, waitFor } from '../../test/test-utils'
import { TeacherMessages } from './TeacherMessages'
import { getConversations } from '../../api/messages'

// Behaviour is covered by LiveMessages.test.jsx; this is a thin-wrapper smoke test.
vi.mock('../../api/messages', () => ({
  getConversations: vi.fn().mockResolvedValue([]),
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  getMessageContacts: vi.fn(),
  startConversation: vi.fn(),
}))

describe('TeacherMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getConversations.mockResolvedValue([])
    setSessionUser({ first_name: 'Grace', last_name: 'Uwase', role: 'teacher' })
  })

  it('mounts the live messaging page and loads conversations', async () => {
    renderWithRouter(<TeacherMessages />)
    expect(screen.getByText('Grace Uwase')).toBeInTheDocument()
    await waitFor(() => expect(getConversations).toHaveBeenCalled())
    expect(screen.getByText(/No conversations yet/)).toBeInTheDocument()
  })
})
