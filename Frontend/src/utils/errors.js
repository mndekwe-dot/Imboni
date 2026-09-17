// One place that turns any thrown/rejected value into a human-readable message.
// Keeps error text consistent everywhere: prefer the backend's own message, then
// the JS error message, then a caller-supplied fallback.
//
// Backend errors come back in a few shapes:
//   { detail: "..." }            (DRF default / APIException)
//   { error: "..." }             (custom views)
//   { field: ["msg", ...] }      (serializer validation)
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
    const data = err?.response?.data

    // A plain-text reason is shown; an HTML error page (a proxy's 502, Django's
    // debug 500) is not a message, and printing it put a stack trace on screen.
    if (typeof data === 'string' && data.trim() && !/^\s*</.test(data) && data.length <= 300) return data.trim()
    if (data?.detail) return data.detail
    if (data?.error) return data.error

    // Serializer-style { field: [messages] } — surface the first concrete message.
    if (data && typeof data === 'object') {
        for (const value of Object.values(data)) {
            if (Array.isArray(value) && value.length && typeof value[0] === 'string') return value[0]
            if (typeof value === 'string' && value.trim()) return value
        }
    }

    // The server answered but gave no reason: axios's 'Request failed with status
    // code 500' means nothing to a bursar, so the caller's own words are better.
    if (err?.response) return fallback
    if (err?.message && err.message !== 'Network Error') return err.message
    if (err?.message === 'Network Error') return 'Cannot reach the server. Check your connection and try again.'

    return fallback
}

// A page that loads several things at once keeps whatever did arrive, but must
// still say that something did not. One toast covers a burst of failures, so a
// dashboard whose six requests all fail does not stack six identical messages.
let lastPartialFailure = 0
export function partialLoad(toast, fallbackValue, message = 'Some of this page could not be loaded.') {
    return err => {
        const now = Date.now()
        if (now - lastPartialFailure > 2000) {
            lastPartialFailure = now
            toast.error(errorMessage(err, message))
        }
        return fallbackValue
    }
}
