import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, waitFor } from '../../test/test-utils'
import { StudentMessages } from './StudentMessages'
import { getConversations } from '../../api/messages'

// Behaviour is covered by LiveMessages.test.jsx; these are thin-wrapper smoke tests.
vi.mock('../../api/messages', () => ({
  getConversations: vi.fn().mockResolvedValue([]),
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  getMessageContacts: vi.fn(),
  startConversation: vi.fn(),
}))

describe('StudentMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getConversations.mockResolvedValue([])
    setSessionUser({ first_name: 'Amina', last_name: 'Uwase', role: 'student' })
  })

  it('mounts the live messaging page and loads conversations', async () => {
    renderWithRouter(<StudentMessages />)
    expect(screen.getByText('Amina Uwase')).toBeInTheDocument()
    await waitFor(() => expect(getConversations).toHaveBeenCalled())
    expect(screen.getByText(/No conversations yet/)).toBeInTheDocument()
  })
})
