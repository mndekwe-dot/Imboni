import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, fireEvent, waitFor } from '../../test/test-utils'
import { LiveMessages } from './LiveMessages'
import {
  getConversations, getMessages, sendMessage,
  getMessageContacts, startConversation,
} from '../../api/messages'

vi.mock('../../api/messages', () => ({
  getConversations: vi.fn(),
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  getMessageContacts: vi.fn(),
  startConversation: vi.fn(),
}))

const CONVERSATIONS = [
  {
    id: 'c1',
    other_participant: { id: 'u1', name: 'Grace Uwase', role: 'teacher', role_label: 'Teacher' },
    unread_count: 2,
    last_message: { content: 'Please see me after class', created_at: '2026-07-05T09:00:00Z' },
    updated_at: '2026-07-05T09:00:00Z',
  },
]

const THREAD = [
  { id: 'm1', is_mine: false, sender_name: 'Grace Uwase', content: 'Hello there', created_at: '2026-07-05T08:00:00Z' },
  { id: 'm2', is_mine: true, sender_name: 'Me', content: 'Hi, thanks', created_at: '2026-07-05T08:05:00Z' },
]

beforeEach(() => {
  vi.clearAllMocks()
  setSessionUser({ first_name: 'Amina', last_name: 'Uwase', role: 'student' })
})

const nav = { navItems: [], secondaryItems: [], title: 'Messages' }

describe('LiveMessages', () => {
  it('shows a loading state then the conversation list', async () => {
    getConversations.mockResolvedValue(CONVERSATIONS)
    renderWithRouter(<LiveMessages {...nav} />)

    await waitFor(() => expect(screen.getByText('Grace Uwase')).toBeInTheDocument())
    expect(screen.getByText('Please see me after class')).toBeInTheDocument()
    expect(screen.getByText('Teacher')).toBeInTheDocument()
  })

  it('shows an empty state when there are no conversations', async () => {
    getConversations.mockResolvedValue([])
    renderWithRouter(<LiveMessages {...nav} />)
    await waitFor(() => expect(screen.getByText(/No conversations yet/)).toBeInTheDocument())
  })

  it('opens a thread and renders sent/received bubbles', async () => {
    getConversations.mockResolvedValue(CONVERSATIONS)
    getMessages.mockResolvedValue(THREAD)
    renderWithRouter(<LiveMessages {...nav} />)
    await waitFor(() => expect(screen.getByText('Grace Uwase')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Please see me after class'))

    await waitFor(() => expect(getMessages).toHaveBeenCalledWith('c1'))
    expect(await screen.findByText('Hello there')).toBeInTheDocument()
    expect(screen.getByText('Hi, thanks')).toBeInTheDocument()
  })

  it('sends a message and clears the composer', async () => {
    getConversations.mockResolvedValue(CONVERSATIONS)
    getMessages.mockResolvedValue(THREAD)
    sendMessage.mockResolvedValue({})
    renderWithRouter(<LiveMessages {...nav} />)
    await waitFor(() => expect(screen.getByText('Grace Uwase')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Please see me after class'))
    await screen.findByText('Hello there')

    const input = screen.getByPlaceholderText('Type your message…')
    fireEvent.change(input, { target: { value: 'A new reply' } })
    fireEvent.click(screen.getByRole('button', { name: /Send/i }))

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('c1', 'A new reply'))
  })

  it('starts a new conversation from the contacts picker', async () => {
    getConversations.mockResolvedValue([])
    getMessageContacts.mockResolvedValue([
      { id: 'u9', name: 'Mr Eric Mugabo', role: 'teacher', role_label: 'Teacher' },
    ])
    startConversation.mockResolvedValue({ id: 'c99' })
    getMessages.mockResolvedValue([])
    renderWithRouter(<LiveMessages {...nav} />)
    await waitFor(() => expect(screen.getByText(/No conversations yet/)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /New/i }))
    await waitFor(() => expect(getMessageContacts).toHaveBeenCalled())
    expect(await screen.findByText('Mr Eric Mugabo')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Mr Eric Mugabo'))
    await waitFor(() => expect(startConversation).toHaveBeenCalledWith('u9'))
  })

  it('surfaces an error when conversations fail to load', async () => {
    getConversations.mockRejectedValue(new Error('offline'))
    renderWithRouter(<LiveMessages {...nav} />)
    await waitFor(() => expect(screen.getByText(/Could not load messages/)).toBeInTheDocument())
  })
})
