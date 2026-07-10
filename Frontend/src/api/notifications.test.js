import { describe, it, expect, vi, beforeEach } from 'vitest'
import client from './client'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from './notifications'

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

describe('notifications api', () => {
  beforeEach(() => vi.resetAllMocks())

  it('getNotifications fetches the notifications list', () => {
    getNotifications()
    expect(client.get).toHaveBeenCalledWith('/imboni/notifications/')
  })

  it('markNotificationRead patches the specific notification', () => {
    markNotificationRead(5)
    expect(client.patch).toHaveBeenCalledWith('/imboni/notifications/5/read/')
  })

  it('markAllNotificationsRead patches the read-all endpoint', () => {
    markAllNotificationsRead()
    expect(client.patch).toHaveBeenCalledWith('/imboni/notifications/read-all/')
  })
})
