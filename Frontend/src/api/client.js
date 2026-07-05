import axios from 'axios'
import {
    cachePut, cacheGet, isQueueable, enqueue, initOfflineSync,
} from '../offline'

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const client = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' },
})

// REQUEST — attach access token
client.interceptors.request.use(config => {
    const token = localStorage.getItem('imboni_access')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// Track whether a refresh is already in-flight so we don't fire multiple
let _refreshing = false
let _queue = []   // { resolve, reject } pairs waiting for the new token

function _processQueue(error, token) {
    _queue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token))
    _queue = []
}

// Auth endpoints must never be served from cache
const NEVER_CACHE = /\/auth\//

function _markFromCache(data, savedAt) {
    // Non-enumerable so spreads/JSON of cached data stay clean
    if (data && typeof data === 'object') {
        try {
            Object.defineProperty(data, '__fromCache', { value: true })
            Object.defineProperty(data, '__cachedAt', { value: savedAt })
        } catch { /* frozen data — markers are optional */ }
    }
    return data
}

// RESPONSE — unwrap data on success; silently refresh the access token on 401
client.interceptors.response.use(
    response => {
        // Keep the last good copy of every GET so reads work offline
        const cfg = response.config
        if (cfg?.method === 'get' && cfg.url && !NEVER_CACHE.test(cfg.url)) {
            cachePut(cfg.url, cfg.params, response.data)
        }
        return response.data
    },
    async error => {
        const original = error.config

        // ── No response at all → we're offline (or the server is down) ──
        if (!error.response && original) {
            if (original.method === 'get' && !NEVER_CACHE.test(original.url || '')) {
                const cached = await cacheGet(original.url, original.params)
                if (cached) return _markFromCache(cached.data, cached.savedAt)
            }
            const queueable = !original._skipOfflineQueue && isQueueable(original.method, original.url || '')
            if (queueable) {
                try {
                    const body = typeof original.data === 'string'
                        ? JSON.parse(original.data)
                        : original.data
                    await enqueue(original.method, original.url, body,
                                  queueable.dedupeKey(original.url, body))
                    return { queued: true, offline: true }
                } catch { /* no offline storage — fall through to a normal error */ }
            }
        }

        // Only attempt a silent refresh on 401 and only once per request
        if (error.response?.status === 401 && !original._retry) {
            const refresh = localStorage.getItem('imboni_refresh')
            if (!refresh) {
                localStorage.clear()
                window.location.href = '/login'
                return Promise.reject(error)
            }

            if (_refreshing) {
                // Queue this request until the in-flight refresh completes
                return new Promise((resolve, reject) => {
                    _queue.push({ resolve, reject })
                }).then(token => {
                    original.headers.Authorization = `Bearer ${token}`
                    return client(original)
                })
            }

            original._retry = true
            _refreshing = true

            try {
                const res = await axios.post(`${BASE}/imboni/auth/token/refresh/`, { refresh })
                const newAccess = res.data.access
                localStorage.setItem('imboni_access', newAccess)
                if (res.data.refresh) localStorage.setItem('imboni_refresh', res.data.refresh)
                client.defaults.headers.common.Authorization = `Bearer ${newAccess}`
                _processQueue(null, newAccess)
                original.headers.Authorization = `Bearer ${newAccess}`
                return client(original)
            } catch (refreshError) {
                _processQueue(refreshError, null)
                localStorage.clear()
                window.location.href = '/login'
                return Promise.reject(refreshError)
            } finally {
                _refreshing = false
            }
        }

        const wrapped = new Error(
            error.response?.data?.error || error.response?.data?.detail || 'Something went wrong'
        )
        // Preserve the original response so callers can branch on status codes
        // (e.g. the timetable 409-conflict dialog) — the plain Error used to
        // drop it, which silently disabled that handling.
        wrapped.response = error.response
        return Promise.reject(wrapped)
    }
)

// Replay any queued offline writes on startup and whenever we come back online
initOfflineSync(client)

export default client
