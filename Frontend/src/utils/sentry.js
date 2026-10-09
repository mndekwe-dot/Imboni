/**
 * Error monitoring, loaded only when it is switched on.
 *
 * @sentry/react is about 60 KB of source on the critical path, and it used to be
 * imported statically by main.jsx - so every visitor downloaded it on first
 * paint even in a build with no VITE_SENTRY_DSN, where it does nothing. It is
 * now fetched on demand, and only when a DSN is set.
 *
 * With no DSN (local dev, the test suite, any build without the env var) both
 * functions are complete no-ops: nothing is imported, sent, or awaited.
 *
 * Privacy: this app handles minors' data. We disable sendDefaultPii and scrub
 * the URL query string / any request body from events so grades, medical notes,
 * or auth tokens never leave the browser inside an error report.
 */

const dsn = () => import.meta.env.VITE_SENTRY_DSN

export async function initSentry() {
    if (!dsn()) return
    const Sentry = await import('@sentry/react')

    Sentry.init({
        dsn: dsn(),
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
        release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
        // Keep tracing volume low in production; raise while investigating.
        tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
        // Never attach cookies, IPs, or user identity to events (children's data).
        sendDefaultPii: false,
        beforeSend(event) {
            // Strip query strings - they can carry reset tokens / ids.
            if (event.request?.url) {
                event.request.url = event.request.url.split('?')[0]
            }
            if (event.request) {
                delete event.request.cookies
                delete event.request.data
            }
            return event
        },
    })
}

/** Report a caught render error. Safe to call always; does nothing without a DSN. */
export async function reportError(error, info) {
    if (!dsn()) return
    try {
        const Sentry = await import('@sentry/react')
        Sentry.captureException(error, {
            contexts: { react: { componentStack: info?.componentStack } },
        })
    } catch {
        // Reporting must never be the thing that breaks the error screen.
    }
}
