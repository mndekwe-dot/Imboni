import axios from 'axios'
import {
    cachePut, cacheGet, isCacheable, isQueueable, enqueue, initOfflineSync, clearOfflineData,
} from '../offline'
import { setSubscriptionStatus } from './subscriptionState'
import {
    clearSession, getAccessToken, hasSession, isSupportSession, refreshAccessToken,
} from './session'

// When VITE_API_BASE is defined (even as an empty string) we honour it verbatim.
// An empty string means "same origin" — used by the containerized multi-tenant
// build, where nginx serves the SPA and proxies the API on each school subdomain,
// so the browser must call /imboni/... relative to the current host. Only when
// the var is entirely undefined (plain `npm run dev`) do we default to :8000.
const BASE = import.meta.env.VITE_API_BASE === undefined
    ? 'http://localhost:8000'
    : import.meta.env.VITE_API_BASE

const client = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' },
})

// REQUEST — attach access token
//
// The token is held in memory only (see session.js), so a page that has just
// loaded has none. If somebody is signed in, fetch one first rather than send
// a request that is certain to come back 401. With no connection that fetch
// fails, and the request goes out bare so the offline layer can answer it.
client.interceptors.request.use(async config => {
    let token = getAccessToken()
    if (!token && hasSession()) {
        try { token = await refreshAccessToken() } catch { /* offline, or the session ended: the response decides */ }
    }
    if (token) config.headers.Authorization = `Bearer ${token}`
    // The instance default is JSON, and axios turns a FormData body into JSON
    // when it sees that header - so every upload (a worksheet, a hand-in, a
    // teaching material) arrived as `{"file": {}}` and was refused. Without the
    // header the browser sends multipart with its own boundary.
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
        if (typeof config.headers.delete === 'function') config.headers.delete('Content-Type')
        else delete config.headers['Content-Type']
    }
    return config
})

// The session is over on this browser: forget it and go to the sign-in page.
// Cached reads go; unsent changes stay, tagged with their owner, for when the
// same person signs back in.
function _forceSignOut() {
    clearOfflineData({ writes: false })
    clearSession()
    localStorage.clear()
    window.location.href = '/login'
}

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
        // The school's standing, as of this response. Set on every reply for a
        // past-due or read-only school, absent otherwise -- so an absent header
        // clears it and a reactivated school stops being nagged without a
        // reload. Read by the banner in DashboardContent.
        setSubscriptionStatus(response.headers?.['x-subscription-status'])

        // Keep the last good copy of the few reads an offline workflow needs.
        // Which ones is an allowlist in offline/index.js; everything else is
        // never written to the device.
        const cfg = response.config
        if (cfg?.method === 'get' && cfg.url && isCacheable(cfg.url)) {
            cachePut(cfg.url, cfg.params, response.data)
        }
        return response.data
    },
    async error => {
        const original = error.config

        // ── No response at all → we're offline (or the server is down) ──
        if (!error.response && original) {
            if (original.method === 'get' && isCacheable(original.url || '')) {
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
            // Nobody signed in, or a support session (an access token with no
            // refresh behind it): there is nothing to renew.
            if (!hasSession() || isSupportSession()) {
                _forceSignOut()
                return Promise.reject(error)
            }

            original._retry = true
            try {
                // Shared: however many requests come back 401 together, one
                // refresh is made and they all wait on it.
                const newAccess = await refreshAccessToken()
                original.headers.Authorization = `Bearer ${newAccess}`
                return client(original)
            } catch (refreshError) {
                // Signed out only when the server says so. A refresh that could
                // not reach the server is a dropped connection, not the end of
                // the session.
                if (refreshError.response) _forceSignOut()
                return Promise.reject(refreshError)
            }
        }

        const wrapped = new Error(
            error.response?.data?.error || error.response?.data?.detail || 'Something went wrong'
        )
        // Preserve the original response so callers can branch on status codes
        // (e.g. the timetable 409-conflict dialog) — the plain Error used to
        // drop it, which silently disabled that handling.
        wrapped.response = error.response
        // And lift the two fields callers actually reach for onto the error
        // itself. Twenty-odd pages were written as `if (e?.status !== 402)` to
        // stay quiet when the plan does not include a portal — and `.status`
        // was never set, so the comparison was always true and every one of
        // them showed "could not load" on top of the upgrade notice it was
        // meant to make room for.
        wrapped.status = error.response?.status
        wrapped.data = error.response?.data
        return Promise.reject(wrapped)
    }
)

// Replay any queued offline writes on startup and whenever we come back online
initOfflineSync(client)

/**
 * Read a list response whichever shape it arrives in.
 *
 * DRF paginates by default in this project (PAGE_SIZE 20), so a list endpoint
 * returns `{count, next, previous, results}` unless its viewset sets
 * `pagination_class = None`. Roughly half of ours do and half don't, and a bare
 * `Array.isArray(data) ? data : []` on a paginated one silently yields an empty
 * list — the row is created, the POST response renders it, and it vanishes on
 * the next load. Use this instead of testing the shape at the call site.
 */
export function toList(data) {
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.results)) return data.results
    return []
}

export default client
