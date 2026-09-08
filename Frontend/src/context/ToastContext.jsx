import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import '../styles/toast.css'

/**
 * App-wide toast notifications — the single, consistent way to tell the user
 * something happened (especially something that FAILED). Nothing in the app
 * should swallow an error silently; call `toast.error(...)` instead.
 *
 * Usage:
 *   const toast = useToast()
 *   try { await save() ; toast.success('Saved') }
 *   catch (e) { toast.error(errorMessage(e, 'Could not save')) }
 */
const ToastContext = createContext(null)

let seq = 0

const ICONS = { error: 'error', success: 'check_circle', info: 'info', warning: 'warning' }

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    // Two steps, because a toast that is removed from the array is gone from
    // the DOM in the same frame and there is nothing left to animate out.
    // Mark it leaving, let CSS fade it, then drop it. LEAVE_MS must outlast
    // --duration-press in toast.css; a little slack is harmless, a shortfall
    // clips the fade.
    const LEAVE_MS = 180

    const remove = useCallback((id) => {
        setToasts(list => list.filter(t => t.id !== id))
    }, [])

    const dismiss = useCallback((id) => {
        setToasts(list => list.map(t => (t.id === id ? { ...t, leaving: true } : t)))
        setTimeout(() => remove(id), LEAVE_MS)
    }, [remove])

    const push = useCallback((message, type, duration) => {
        if (!message) return
        const id = ++seq
        setToasts(list => [...list, { id, message: String(message), type }])
        if (duration > 0) setTimeout(() => dismiss(id), duration)
        return id
    }, [dismiss])

    // Errors linger longer than confirmations, and never auto-dismiss too fast.
    const toast = useMemo(() => ({
        error:   (m, d = 6000) => push(m, 'error', d),
        success: (m, d = 4000) => push(m, 'success', d),
        info:    (m, d = 4000) => push(m, 'info', d),
        warning: (m, d = 5000) => push(m, 'warning', d),
    }), [push])

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`toast toast-${t.type}${t.leaving ? ' toast-leaving' : ''}`}
                        role="alert"
                    >
                        <span className="material-symbols-rounded toast-icon" aria-hidden="true">{ICONS[t.type] || 'info'}</span>
                        <span className="toast-message">{t.message}</span>
                        <button
                            className="toast-close"
                            aria-label="Dismiss notification"
                            onClick={() => dismiss(t.id)}
                        >
                            <span className="material-symbols-rounded" aria-hidden="true">close</span>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) {
        // Fail loud in dev if a component forgot the provider, but never crash
        // the app in production over a missing toast — degrade to the console.
        if (import.meta.env.DEV) {
            throw new Error('useToast must be used within a <ToastProvider>')
        }
        return { error: console.error, success: () => {}, info: () => {}, warning: console.warn }
    }
    return ctx
}
