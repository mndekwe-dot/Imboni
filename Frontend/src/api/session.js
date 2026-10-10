/**
 * What the page knows about being signed in.
 *
 * There are two credentials and the page is only trusted with one of them:
 *
 *   The refresh token is long-lived. It lives in an HttpOnly cookie that no
 *   script can read, this one included. The page can ask the server to use
 *   it; it can never see it or send it anywhere.
 *
 *   The access token is short-lived (minutes). The page holds it here, in
 *   memory, and nowhere else. It is gone on reload and is fetched again by
 *   spending the cookie.
 *
 * Both used to sit in localStorage, where one injected script could copy a
 * week-long credential off the device. Neither is there now.
 *
 * `imboni_user` stays in localStorage. It is the signed-in person's profile,
 * not a credential: it tells the app which portal to draw and lets it open
 * with no connection. The server decides what anyone may actually do.
 */
import axios from 'axios'

// See client.js: undefined -> dev default; empty string -> same-origin (container).
const BASE = import.meta.env.VITE_API_BASE === undefined
    ? 'http://localhost:8000'
    : import.meta.env.VITE_API_BASE

const USER_KEY = 'imboni_user'
// A support session is an access token with no refresh behind it (see
// pages/SupportSession.jsx). sessionStorage, so it survives a reload inside the
// operator's tab and ends when the tab closes; it expires on its own regardless.
const SUPPORT_TOKEN_KEY = 'imboni_support_token'
// Where older versions of this page kept the tokens.
const LEGACY_ACCESS = 'imboni_access'
const LEGACY_REFRESH = 'imboni_refresh'

// The header only our own pages send. The server refuses to spend the cookie
// without it, so a form on another site cannot (see authentication/session.py).
const OURS = { 'X-Requested-With': 'XMLHttpRequest' }
export const SESSION_REQUEST = { withCredentials: true, headers: OURS }

const read = (store, key) => { try { return store.getItem(key) } catch { return null } }
const drop = (store, key) => { try { store.removeItem(key) } catch { /* private mode */ } }

let accessToken = typeof sessionStorage === 'undefined' ? null : read(sessionStorage, SUPPORT_TOKEN_KEY)

export const getAccessToken = () => accessToken

export function setAccessToken(token) {
    accessToken = token || null
}

/** Is somebody signed in on this browser, as far as the page can tell? */
export function hasSession() {
    return Boolean(read(localStorage, USER_KEY))
}

export const isSupportSession = () => Boolean(read(sessionStorage, SUPPORT_TOKEN_KEY))

/** A platform operator's read-only look at a school: an access token and nothing else. */
export function startSupportSession(token) {
    accessToken = token
    try { sessionStorage.setItem(SUPPORT_TOKEN_KEY, token) } catch { /* private mode: lasts until reload */ }
}

/** Forget the session on this browser. Does not talk to the server. */
export function clearSession() {
    accessToken = null
    drop(sessionStorage, SUPPORT_TOKEN_KEY)
    for (const key of [USER_KEY, LEGACY_ACCESS, LEGACY_REFRESH]) drop(localStorage, key)
}

// Several tabs share one cookie. Each refresh replaces it and revokes the one
// before, so two tabs refreshing at the same moment would have the slower one
// present a token the faster one had just retired, and be signed out. A lock
// shared across tabs makes them take turns; the second then sends the cookie
// the first one left.
function oneTabAtATime(task) {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : null
    return locks?.request ? locks.request('imboni-session-refresh', task) : task()
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

async function spendCookie() {
    // A browser that signed in before the cookie existed still holds its
    // refresh token in localStorage. Hand it over once: the server answers
    // with the cookie, and the stored copy is deleted whatever happens.
    const legacy = read(localStorage, LEGACY_REFRESH)
    const settle = () => { drop(localStorage, LEGACY_REFRESH); drop(localStorage, LEGACY_ACCESS) }
    try {
        const res = await axios.post(`${BASE}/imboni/auth/token/refresh/`, legacy ? { refresh: legacy } : {}, SESSION_REQUEST)
        settle()
        return res.data.access
    } catch (err) {
        // Only once the server has answered. Offline, the stored token is the
        // person's only way back in, so it waits for a connection.
        if (err.response) settle()
        throw err
    }
}

async function renew() {
    try {
        return await spendCookie()
    } catch (err) {
        // Without the Web Locks API (older browsers) two tabs can still collide.
        // One retry, a moment later, presents the cookie the other tab left.
        if (err.response?.status !== 401) throw err
        await pause(400)
        return spendCookie()
    }
}

let inFlight = null

/**
 * A fresh access token, bought with the cookie.
 *
 * However many requests ask at once, one refresh is made and they all share
 * it. Rejects with the axios error: `err.response` set means the server said
 * the session is over; unset means it could not be reached (offline).
 */
export function refreshAccessToken() {
    inFlight ??= oneTabAtATime(renew)
        .then(token => { accessToken = token; return token })
        .finally(() => { inFlight = null })
    return inFlight
}

/** The access token, fetching one first if this page has not got it yet. */
export function ensureAccessToken() {
    return accessToken ? Promise.resolve(accessToken) : refreshAccessToken()
}

/* Tests only: module state would otherwise leak between cases. */
export function __resetSession() {
    accessToken = null
    inFlight = null
}
