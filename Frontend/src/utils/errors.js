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

    if (typeof data === 'string' && data.trim()) return data
    if (data?.detail) return data.detail
    if (data?.error) return data.error

    // Serializer-style { field: [messages] } — surface the first concrete message.
    if (data && typeof data === 'object') {
        for (const value of Object.values(data)) {
            if (Array.isArray(value) && value.length && typeof value[0] === 'string') return value[0]
            if (typeof value === 'string' && value.trim()) return value
        }
    }

    if (err?.message && err.message !== 'Network Error') return err.message
    if (err?.message === 'Network Error') return 'Cannot reach the server. Check your connection and try again.'

    return fallback
}
