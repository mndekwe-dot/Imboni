// What the server last told us about this school's standing.
//
// `SubscriptionStatusMiddleware` stamps `X-Subscription-Status` on every
// response for a school that is past due or read-only. Nothing read it, so the
// only way a teacher discovered a restricted school was by typing a lesson's
// worth of marks and having the save refused. This module is the read.
//
// A leaf module with no imports on purpose: the test setup resets it without
// pulling the API client (and its mock graph) in behind it.

let current = null
const listeners = new Set()

/** Record what the last response said. Returns true if it changed. */
export function setSubscriptionStatus(status) {
    const next = status || null
    if (next === current) return false
    current = next
    for (const fn of listeners) fn(current)
    return true
}

export function getSubscriptionStatus() {
    return current
}

/** Subscribe to changes; returns an unsubscribe function. */
export function onSubscriptionStatus(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
}

/** Test seam — see test/setup.js. */
export function resetSubscriptionStatus() {
    current = null
    listeners.clear()
}
