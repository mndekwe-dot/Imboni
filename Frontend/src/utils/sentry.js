import * as Sentry from '@sentry/react'

/**
 * Initialise Sentry error monitoring — only when VITE_SENTRY_DSN is set.
 *
 * With no DSN (local dev, the test suite, any build without the env var) this
 * is a complete no-op, so nothing is sent and no network calls happen.
 *
 * Privacy: this app handles minors' data. We disable sendDefaultPii and scrub
 * the URL query string / any request body from events so grades, medical notes,
 * or auth tokens never leave the browser inside an error report.
 */
export function initSentry() {
    const dsn = import.meta.env.VITE_SENTRY_DSN
    if (!dsn) return

    Sentry.init({
        dsn,
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
        release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
        // Keep tracing volume low in production; raise while investigating.
        tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
        // Never attach cookies, IPs, or user identity to events (children's data).
        sendDefaultPii: false,
        beforeSend(event) {
            // Strip query strings — they can carry reset tokens / ids.
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

export { Sentry }
