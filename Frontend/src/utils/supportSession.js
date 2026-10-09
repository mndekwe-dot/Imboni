/**
 * A support session is an ordinary school login with an end time, opened by a
 * platform operator (see apps/tenants/support_session.py on the server).
 *
 * The browser keeps `imboni_support` = {exp, operator} beside the usual tokens.
 * That record is only for showing the banner and ending the session early: the
 * server enforces read-only and expiry from the token itself, so nothing here
 * can be edited to gain a power.
 */
const KEY = 'imboni_support'

/** The claims in a JWT, or null. Not a verification: the server does that. */
export function decodeJwtPayload(token) {
    try {
        const body = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
        return JSON.parse(atob(body.padEnd(Math.ceil(body.length / 4) * 4, '=')))
    } catch {
        return null
    }
}

export function readSupportSession() {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
        return raw && raw.exp * 1000 > Date.now() ? raw : null
    } catch {
        return null
    }
}

export function saveSupportSession(session) {
    localStorage.setItem(KEY, JSON.stringify(session))
}

/** Forget the session and the login it carried. */
export function clearSupportSession() {
    for (const key of [KEY, 'imboni_access', 'imboni_refresh', 'imboni_user']) {
        try { localStorage.removeItem(key) } catch { /* private mode */ }
    }
}
