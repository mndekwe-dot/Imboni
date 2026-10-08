/*
 * Where a school lives, and which school this device last used.
 *
 * Imboni serves each school on its own subdomain, and the installed desktop app
 * opens on the bare domain (see pages/Start.jsx). Getting from one to the other
 * is host arithmetic that several places need, so it lives here once.
 */

const REMEMBERED_KEY = 'imboni_school'

/** The URL a school's app opens at, on the same scheme and port as this page. */
export function schoolUrl(domain) {
    const { protocol, port } = window.location
    return `${protocol}//${domain}${port ? `:${port}` : ''}/start`
}

/**
 * The bare domain's start page, for "this is not my school".
 * Derived by dropping the school's label: demo.imboni.tech -> imboni.tech.
 */
export function switchSchoolUrl() {
    const { protocol, port, hostname } = window.location
    const bare = hostname.split('.').slice(1).join('.') || hostname
    return `${protocol}//${bare}${port ? `:${port}` : ''}/start?other=1`
}

/** Leave this page for another host. Isolated so tests can replace it. */
export function goToSchool(url) {
    window.location.replace(url)
}

// localStorage can throw (private windows, blocked site data) or hold junk from
// an older build. Remembering a school is a convenience, never a requirement.
export function readRememberedSchool() {
    try {
        const raw = JSON.parse(localStorage.getItem(REMEMBERED_KEY))
        return raw && typeof raw.code === 'string' && typeof raw.domain === 'string' ? raw : null
    } catch {
        return null
    }
}

export function rememberSchool({ code, name, domain }) {
    try {
        localStorage.setItem(REMEMBERED_KEY, JSON.stringify({ code, name, domain }))
    } catch {
        /* not remembering is fine; the user types the code again next time */
    }
}

export function forgetSchool() {
    try {
        localStorage.removeItem(REMEMBERED_KEY)
    } catch {
        /* nothing stored, or storage blocked: either way there is nothing to clear */
    }
}
