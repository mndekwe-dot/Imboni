import client from './client'

export const getNotifications = () => client.get('/imboni/notifications/')
export const markNotificationRead = (id) => client.patch(`/imboni/notifications/${id}/read/`)
export const markAllNotificationsRead = () => client.patch('/imboni/notifications/read-all/')

// --- Web Push -------------------------------------------------------------
// The VAPID public key the browser needs before it can subscribe. Answers
// { configured, public_key } — `configured: false` when the server has no
// keypair, so the UI hides the control instead of offering a button that fails.
export const getPushKey = () => client.get('/imboni/notifications/push/key/')

// Register this browser. Body is the raw PushSubscription JSON.
export const subscribeToPush = (subscription) =>
    client.post('/imboni/notifications/push/subscribe/', subscription)

// Unregister this browser. The server scopes the delete to the logged-in user.
export const unsubscribeFromPush = (endpoint) =>
    client.delete('/imboni/notifications/push/subscribe/', { data: { endpoint } })

