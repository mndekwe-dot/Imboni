import client from './client'

// School-side support — staff raise and track their OWN school's tickets. Uses
// the authenticated school session (client). Tickets land in the platform inbox.

export const getMyTickets  = ()          => client.get('/imboni/support/tickets/').then(r => r.data)
export const raiseTicket   = (data)      => client.post('/imboni/support/tickets/', data).then(r => r.data)
export const replyMyTicket = (id, body)  => client.post(`/imboni/support/tickets/${id}/reply/`, { body }).then(r => r.data)
