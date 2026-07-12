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

    const dismiss = useCallback((id) => {
        setToasts(list => list.filter(t => t.id !== id))
    }, [])

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
                    <div key={t.id} className={`toast toast-${t.type}`} role="alert">
                        <span className="material-symbols-rounded toast-icon">{ICONS[t.type] || 'info'}</span>
                        <span className="toast-message">{t.message}</span>
                        <button
                            className="toast-close"
                            aria-label="Dismiss notification"
                            onClick={() => dismiss(t.id)}
                        >
                            <span className="material-symbols-rounded">close</span>
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
