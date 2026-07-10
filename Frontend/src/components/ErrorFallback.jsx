/**
 * ErrorFallback — shown by the top-level Sentry.ErrorBoundary when a render
 * crashes, instead of a blank white screen. The error itself has already been
 * reported to Sentry (when configured); this is purely the user-facing recovery
 * UI. `resetError` is provided by Sentry.ErrorBoundary.
 */
export function ErrorFallback({ error, resetError }) {
    return (
        <div
            role="alert"
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                padding: '2rem',
                textAlign: 'center',
                fontFamily: 'system-ui, sans-serif',
                color: 'var(--foreground, #1e293b)',
                background: 'var(--background, #f8fafc)',
            }}
        >
            <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#ef4444' }}>
                error
            </span>
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Something went wrong</h1>
            <p style={{ maxWidth: '28rem', color: 'var(--muted-foreground, #64748b)', margin: 0 }}>
                An unexpected error occurred and the page couldn't be displayed. Our team has been
                notified. You can try again, or reload the page.
            </p>
            {import.meta.env.DEV && error?.message && (
                <pre
                    style={{
                        maxWidth: '90vw',
                        overflow: 'auto',
                        padding: '0.75rem 1rem',
                        background: '#0f172a',
                        color: '#f87171',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        textAlign: 'left',
                    }}
                >
                    {String(error.message)}
                </pre>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                    onClick={resetError}
                    style={{
                        padding: '0.6rem 1.4rem',
                        border: 'none',
                        borderRadius: '8px',
                        background: 'var(--primary, #2563eb)',
                        color: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Try again
                </button>
                <button
                    onClick={() => window.location.assign('/')}
                    style={{
                        padding: '0.6rem 1.4rem',
                        border: '1px solid var(--border, #cbd5e1)',
                        borderRadius: '8px',
                        background: 'transparent',
                        color: 'inherit',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    Go home
                </button>
            </div>
        </div>
    )
}
