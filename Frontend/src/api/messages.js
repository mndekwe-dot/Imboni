import client from './client'

// Shared messaging API — used by every portal via the LiveMessages container.
// Backend enforces the staff-mediated safeguarding policy; the contacts list
// only offers people the current user is allowed to message.

export const getConversations = () =>
    client.get('/imboni/messages/conversations/')

export const getMessages = (conversationId) =>
    client.get(`/imboni/messages/conversations/${conversationId}/messages/`)

export const sendMessage = (conversationId, content) =>
    client.post(`/imboni/messages/conversations/${conversationId}/messages/`, { content })

export const getMessageContacts = (search = '') =>
    client.get('/imboni/messages/contacts/', { params: search ? { search } : {} })

// Start (or reuse) a 1-to-1 conversation and optionally send a first message.
export const startConversation = (recipient, content = '') =>
    client.post('/imboni/messages/conversations/', { recipient, content })
