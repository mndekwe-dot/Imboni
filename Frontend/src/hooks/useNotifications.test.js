import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useNotifications } from './useNotifications'
import { getNotifications, markNotificationRead } from '../api/notifications'

vi.mock('../api/notifications')

describe('useNotifications', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('loads notifications on mount', async () => {
    const list = [{ id: 1, read: false }, { id: 2, read: false }]
    getNotifications.mockResolvedValue(list)

    const { result } = renderHook(() => useNotifications())

    await waitFor(() => expect(result.current.notifications).toEqual(list))
    expect(getNotifications).toHaveBeenCalledTimes(1)
  })

  it('silently swallows fetch errors, leaving notifications empty', async () => {
    getNotifications.mockRejectedValue(new Error('network fail'))

    const { result } = renderHook(() => useNotifications())

    await waitFor(() => expect(getNotifications).toHaveBeenCalled())
    expect(result.current.notifications).toEqual([])
  })

  it('markRead marks only the matching notification as read', async () => {
    const list = [{ id: 1, read: false }, { id: 2, read: false }]
    getNotifications.mockResolvedValue(list)
    markNotificationRead.mockResolvedValue({})

    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.notifications).toEqual(list))

    await act(async () => {
      await result.current.markRead(1)
    })

    expect(markNotificationRead).toHaveBeenCalledWith(1)
    expect(result.current.notifications).toEqual([
      { id: 1, read: true },
      { id: 2, read: false },
    ])
  })

  it('refresh re-fetches notifications', async () => {
    getNotifications.mockResolvedValue([])
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(1))

    act(() => result.current.refresh())

    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2))
  })
})
