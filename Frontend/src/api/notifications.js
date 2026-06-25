import client from './client'

export const getNotifications = () => client.get('/imboni/notifications/')
export const markNotificationRead = (id) => client.patch(`/imboni/notifications/${id}/read/`)
export const markAllNotificationsRead = () => client.patch('/imboni/notifications/read-all/')
