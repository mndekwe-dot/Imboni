/**
 * ErrorFallback — shown by the top-level Sentry.ErrorBoundary when a render
 * crashes, instead of a blank white screen. The error itself has already been
 * reported to Sentry (when configured); this is purely the user-facing recovery
 * UI. `resetError` is provided by Sentry.ErrorBoundary.
 *
 * The styles here are INTENTIONALLY inline and every custom property carries a
 * literal fallback (`var(--foreground, #1e293b)`). This is the screen of last
 * resort: it has to render correctly even when a stylesheet chunk failed to
 * load, which is one of the ways we end up here in the first place. Do not
 * migrate it onto classes in an inline-style sweep.
 */
import i18n from 'i18next'

export function ErrorFallback({ error, resetError }) {
    const t = (key) => i18n.t(key)
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
                fontFamily: 'var(--font-family, system-ui, sans-serif)',
                color: 'var(--foreground, #1e293b)',
                background: 'var(--background, #f8fafc)',
            }}
        >
            <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: '#ef4444' }} aria-hidden="true">
                error
            </span>
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>{t('common.somethingWentWrong')}</h1>
            <p style={{ maxWidth: '28rem', color: 'var(--muted-foreground, #64748b)', margin: 0 }}>
                {t('common.copy.unexpectedError')}
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
                    {t('common.copy.tryAgain')}
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
                    {t('common.copy.goHome')}
                </button>
            </div>
        </div>
    )
}
