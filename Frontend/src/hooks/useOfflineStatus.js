import { useState, useEffect } from 'react'
import { pendingCount } from '../offline'

/**
 * Live connectivity + sync-queue state for offline-aware pages.
 * Returns { online, pending } — pending is the number of writes waiting
 * in the outbox to be replayed.
 */
export function useOfflineStatus() {
    const [online, setOnline] = useState(() =>
        typeof navigator === 'undefined' ? true : navigator.onLine)
    const [pending, setPending] = useState(0)

    useEffect(() => {
        const onOnline = () => setOnline(true)
        const onOffline = () => setOnline(false)
        const onPending = e => setPending(e.detail?.count ?? 0)

        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        window.addEventListener('imboni:offline-pending', onPending)
        pendingCount().then(setPending).catch(() => {})

        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
            window.removeEventListener('imboni:offline-pending', onPending)
        }
    }, [])

    return { online, pending }
}
