import { useState, useEffect, useCallback, useRef } from 'react'
import { getNotifications, markNotificationRead } from '../api/notifications'

// How often to re-poll when the WebSocket is NOT carrying us.
const POLL_INTERVAL_MS = 60_000
// Reconnect backoff: 1s, 2s, 4s, 8s, 16s, then hold at 30s.
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000
// nginx closes an idle proxied connection after proxy_read_timeout (60s by
// default). Ping well inside that window so a quiet bell doesn't drop every
// minute and thrash the reconnect loop.
const HEARTBEAT_MS = 25_000

/**
 * Where the notification socket lives.
 *
 * Derived from the page origin rather than hard-coded, because in the
 * containerized build the SPA is served by nginx on each school's own subdomain
 * and the API is proxied on that same origin — the Host header is what tells the
 * backend which school (schema) this connection belongs to. Deriving the URL any
 * other way would send every school to the same host.
 *
 * The path sits under /imboni/ because that is the location nginx already
 * proxies with the Upgrade/Connection headers a WebSocket handshake needs.
 *
 * Returns null when we cannot build a URL (no token, no WebSocket support), in
 * which case the caller stays on polling.
 */
export function notificationSocketUrl() {
    if (typeof window === 'undefined' || typeof window.WebSocket !== 'function') return null

    const token = window.localStorage?.getItem('imboni_access')
    if (!token) return null

    // Mirror api/client.js: undefined => plain `npm run dev` against :8000;
    // '' => same origin (the proxied container build); anything else => that host.
    const base = import.meta.env?.VITE_API_BASE
    let httpOrigin
    if (base === undefined) httpOrigin = 'http://localhost:8000'
    else if (base === '') httpOrigin = window.location.origin
    else httpOrigin = /^https?:\/\//.test(base) ? base : window.location.origin

    let parsed
    try {
        parsed = new URL(httpOrigin)
    } catch {
        return null
    }
    const scheme = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${scheme}//${parsed.host}/imboni/ws/notifications/?token=${encodeURIComponent(token)}`
}

export function useNotifications() {
    const [notifications, setNotifications] = useState([])

    const socketRef = useRef(null)
    const pollTimerRef = useRef(null)
    const reconnectTimerRef = useRef(null)
    const heartbeatTimerRef = useRef(null)
    const attemptsRef = useRef(0)
    const mountedRef = useRef(true)

    const refresh = useCallback(() => {
        getNotifications().then(setNotifications).catch(() => { })
    }, [])

    useEffect(() => {
        mountedRef.current = true

        const stopPolling = () => {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current)
                pollTimerRef.current = null
            }
        }

        // Fallback path: whenever the socket is not healthy we poll, exactly as
        // this hook did before real-time existed.
        const startPolling = () => {
            if (pollTimerRef.current || !mountedRef.current) return
            pollTimerRef.current = setInterval(refresh, POLL_INTERVAL_MS)
        }

        const stopHeartbeat = () => {
            if (heartbeatTimerRef.current) {
                clearInterval(heartbeatTimerRef.current)
                heartbeatTimerRef.current = null
            }
        }

        const startHeartbeat = (socket) => {
            stopHeartbeat()
            heartbeatTimerRef.current = setInterval(() => {
                if (socket.readyState !== 1) return
                try { socket.send(JSON.stringify({ type: 'ping' })) } catch { /* closing */ }
            }, HEARTBEAT_MS)
        }

        const scheduleReconnect = () => {
            if (reconnectTimerRef.current || !mountedRef.current) return
            const delay = Math.min(
                RECONNECT_BASE_MS * 2 ** attemptsRef.current,
                RECONNECT_MAX_MS,
            )
            attemptsRef.current += 1
            reconnectTimerRef.current = setTimeout(() => {
                reconnectTimerRef.current = null
                connect()
            }, delay)
        }

        const handlePush = (raw) => {
            let payload
            try {
                payload = JSON.parse(raw)
            } catch {
                return
            }
            if (payload?.type !== 'notification' || !payload.notification) return
            const incoming = payload.notification
            setNotifications(prev => {
                // A push can race the poll that already fetched the same row.
                const without = prev.filter(n => String(n.id) !== String(incoming.id))
                return [incoming, ...without]
            })
        }

        function connect() {
            if (!mountedRef.current) return
            const url = notificationSocketUrl()
            if (!url) {
                // No socket possible (logged out, or no WebSocket in this env):
                // polling is the whole story. Don't retry in a loop.
                startPolling()
                return
            }

            let socket
            try {
                socket = new WebSocket(url)
            } catch {
                startPolling()
                scheduleReconnect()
                return
            }
            socketRef.current = socket

            socket.onopen = () => {
                if (!mountedRef.current) return
                attemptsRef.current = 0
                // Live push is authoritative now — stand the poller down, but
                // resync once so we don't miss anything created while offline.
                stopPolling()
                startHeartbeat(socket)
                refresh()
            }

            socket.onmessage = (event) => {
                if (mountedRef.current) handlePush(event.data)
            }

            socket.onerror = () => {
                // 'close' always follows 'error'; let that handler do the work.
                startPolling()
            }

            socket.onclose = () => {
                if (socketRef.current === socket) socketRef.current = null
                stopHeartbeat()
                if (!mountedRef.current) return
                startPolling()
                scheduleReconnect()
            }
        }

        refresh()
        connect()

        return () => {
            mountedRef.current = false
            stopPolling()
            stopHeartbeat()
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = null
            }
            const socket = socketRef.current
            socketRef.current = null
            if (socket) {
                // Drop handlers first so a close during teardown can't re-arm
                // the poller or schedule a reconnect on an unmounted hook.
                socket.onopen = null
                socket.onmessage = null
                socket.onerror = null
                socket.onclose = null
                try { socket.close() } catch { /* already closing */ }
            }
        }
    }, [refresh])

    async function markRead(id) {
        await markNotificationRead(id)
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    }

    return { notifications, markRead, refresh }
}
