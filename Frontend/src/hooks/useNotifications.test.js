import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useNotifications, notificationSocketUrl } from './useNotifications'
import { getNotifications, markNotificationRead } from '../api/notifications'

vi.mock('../api/notifications')

// ── A controllable fake WebSocket ──────────────────────────────────────────────
// jsdom ships a real WebSocket that would try to open a network connection, so
// every test installs this stub and drives open/message/close by hand.
class FakeWebSocket {
    static instances = []
    constructor(url) {
        this.url = url
        this.readyState = 0
        this.onopen = null
        this.onmessage = null
        this.onerror = null
        this.onclose = null
        this.closed = false
        this.sent = []
        FakeWebSocket.instances.push(this)
    }
    open() { this.readyState = 1; this.onopen?.() }
    emit(data) { this.onmessage?.({ data: JSON.stringify(data) }) }
    emitRaw(data) { this.onmessage?.({ data }) }
    fail() { this.onerror?.({}); this.onclose?.({ code: 1006 }) }
    close() { this.closed = true; this.readyState = 3 }
    send(data) { this.sent.push(data) }
    static last() { return FakeWebSocket.instances.at(-1) }
    static reset() { FakeWebSocket.instances = [] }
}

describe('useNotifications', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        FakeWebSocket.reset()
        vi.stubGlobal('WebSocket', FakeWebSocket)
        window.localStorage.setItem('imboni_access', 'test-token')
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
        window.localStorage.clear()
    })

    // ── existing behaviour that ~49 DashboardHeader call sites depend on ────────

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

    it('exposes exactly the documented public API', async () => {
        getNotifications.mockResolvedValue([])
        const { result } = renderHook(() => useNotifications())
        await waitFor(() => expect(getNotifications).toHaveBeenCalled())

        expect(Object.keys(result.current).sort()).toEqual(['markRead', 'notifications', 'refresh'])
    })

    // ── the WebSocket URL ──────────────────────────────────────────────────────

    it('builds a ws:// url on the current origin with the token attached', () => {
        const url = notificationSocketUrl()
        expect(url).toMatch(/^ws:\/\//)
        // Under /imboni/ so the existing nginx proxy block (which already sets
        // the Upgrade/Connection headers) carries the handshake unchanged.
        expect(url).toContain('/imboni/ws/notifications/')
        expect(url).toContain('token=test-token')
    })

    it('returns no url when there is no access token, so we stay on polling', () => {
        window.localStorage.removeItem('imboni_access')
        expect(notificationSocketUrl()).toBeNull()
    })

    it('opens a socket on mount', async () => {
        getNotifications.mockResolvedValue([])
        renderHook(() => useNotifications())

        await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1))
    })

    // ── push delivery ──────────────────────────────────────────────────────────

    it('prepends a pushed notification to state', async () => {
        getNotifications.mockResolvedValue([{ id: 'old', read: false }])
        const { result } = renderHook(() => useNotifications())
        await waitFor(() => expect(FakeWebSocket.last()).toBeTruthy())

        await act(async () => { FakeWebSocket.last().open() })
        await act(async () => {
            FakeWebSocket.last().emit({
                type: 'notification',
                notification: { id: 'new', title: 'Pushed', read: false },
            })
        })

        expect(result.current.notifications.map(n => n.id)).toEqual(['new', 'old'])
    })

    it('replaces rather than duplicates a push for a notification already held', async () => {
        getNotifications.mockResolvedValue([{ id: 'n1', title: 'stale', read: false }])
        const { result } = renderHook(() => useNotifications())
        await waitFor(() => expect(result.current.notifications).toHaveLength(1))

        await act(async () => { FakeWebSocket.last().open() })
        await act(async () => {
            FakeWebSocket.last().emit({
                type: 'notification',
                notification: { id: 'n1', title: 'fresh', read: false },
            })
        })

        expect(result.current.notifications).toHaveLength(1)
        expect(result.current.notifications[0].title).toBe('fresh')
    })

    it('ignores malformed and non-notification frames', async () => {
        getNotifications.mockResolvedValue([])
        const { result } = renderHook(() => useNotifications())
        await waitFor(() => expect(FakeWebSocket.last()).toBeTruthy())

        await act(async () => { FakeWebSocket.last().open() })
        await act(async () => {
            FakeWebSocket.last().emitRaw('{not json')
            FakeWebSocket.last().emit({ type: 'connected', schema: 'school1' })
            FakeWebSocket.last().emit({ type: 'pong' })
        })

        expect(result.current.notifications).toEqual([])
    })

    it('resyncs via the REST endpoint once the socket opens', async () => {
        getNotifications.mockResolvedValue([])
        renderHook(() => useNotifications())
        await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(1))

        await act(async () => { FakeWebSocket.last().open() })

        await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2))
    })

    // ── the polling fallback ───────────────────────────────────────────────────

    it('falls back to polling when the socket fails', async () => {
        vi.useFakeTimers()
        getNotifications.mockResolvedValue([])
        renderHook(() => useNotifications())

        await vi.waitFor(() => expect(FakeWebSocket.last()).toBeTruthy())
        act(() => { FakeWebSocket.last().fail() })
        expect(getNotifications).toHaveBeenCalledTimes(1)

        await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
        expect(getNotifications.mock.calls.length).toBeGreaterThan(1)
    })

    it('retries the socket with backoff after a failure', async () => {
        vi.useFakeTimers()
        getNotifications.mockResolvedValue([])
        renderHook(() => useNotifications())

        await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1))
        act(() => { FakeWebSocket.last().fail() })

        // First retry is ~1s; nothing should have been attempted before then.
        expect(FakeWebSocket.instances).toHaveLength(1)
        await act(async () => { await vi.advanceTimersByTimeAsync(1_100) })
        expect(FakeWebSocket.instances).toHaveLength(2)

        // Second retry waits longer (~2s), proving the delay grows.
        act(() => { FakeWebSocket.last().fail() })
        await act(async () => { await vi.advanceTimersByTimeAsync(1_100) })
        expect(FakeWebSocket.instances).toHaveLength(2)
        await act(async () => { await vi.advanceTimersByTimeAsync(1_100) })
        expect(FakeWebSocket.instances).toHaveLength(3)
    })

    it('polls without ever opening a socket when there is no token', async () => {
        window.localStorage.removeItem('imboni_access')
        vi.useFakeTimers()
        getNotifications.mockResolvedValue([])
        renderHook(() => useNotifications())

        await vi.waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(1))
        expect(FakeWebSocket.instances).toHaveLength(0)

        await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
        expect(getNotifications.mock.calls.length).toBeGreaterThan(1)
    })

    // ── heartbeat ──────────────────────────────────────────────────────────────

    it('pings periodically so an idle proxy does not drop the socket', async () => {
        vi.useFakeTimers()
        getNotifications.mockResolvedValue([])
        renderHook(() => useNotifications())

        await vi.waitFor(() => expect(FakeWebSocket.last()).toBeTruthy())
        const socket = FakeWebSocket.last()
        act(() => { socket.open() })
        expect(socket.sent).toHaveLength(0)

        // 25s heartbeat — comfortably inside nginx's 60s proxy_read_timeout.
        await act(async () => { await vi.advanceTimersByTimeAsync(26_000) })
        expect(socket.sent).toEqual([JSON.stringify({ type: 'ping' })])
    })

    it('stops pinging once the socket closes', async () => {
        vi.useFakeTimers()
        getNotifications.mockResolvedValue([])
        renderHook(() => useNotifications())

        await vi.waitFor(() => expect(FakeWebSocket.last()).toBeTruthy())
        const socket = FakeWebSocket.last()
        act(() => { socket.open() })
        act(() => { socket.fail() })

        await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
        expect(socket.sent).toHaveLength(0)
    })

    // ── cleanup ────────────────────────────────────────────────────────────────

    it('closes the socket and stops polling on unmount', async () => {
        vi.useFakeTimers()
        getNotifications.mockResolvedValue([])
        const { unmount } = renderHook(() => useNotifications())

        await vi.waitFor(() => expect(FakeWebSocket.last()).toBeTruthy())
        const socket = FakeWebSocket.last()
        act(() => { socket.open() })

        unmount()

        expect(socket.closed).toBe(true)
        const callsAtUnmount = getNotifications.mock.calls.length
        await act(async () => { await vi.advanceTimersByTimeAsync(180_000) })
        expect(getNotifications.mock.calls.length).toBe(callsAtUnmount)
        expect(FakeWebSocket.instances).toHaveLength(1)
    })
})
