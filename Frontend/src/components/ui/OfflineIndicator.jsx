import { useOfflineStatus } from '../../hooks/useOfflineStatus'

/**
 * Small status pill for offline-capable pages. Hidden while online with an
 * empty sync queue; otherwise shows connectivity and how many changes are
 * waiting to sync.
 */
export function OfflineIndicator() {
    const { online, pending } = useOfflineStatus()

    if (online && pending === 0) return null

    const offlineStyle = {
        background: 'rgba(245,158,11,0.12)',
        color: '#b45309',
    }
    const syncingStyle = {
        background: 'rgba(37,99,235,0.1)',
        color: '#2563eb',
    }

    return (
        <span
            role="status"
            style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                fontSize: '0.78rem', fontWeight: 600,
                padding: '0.25rem 0.7rem', borderRadius: 999,
                ...(online ? syncingStyle : offlineStyle),
            }}
        >
            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                {online ? 'cloud_sync' : 'cloud_off'}
            </span>
            {!online && pending === 0 && 'Offline — changes will be saved locally'}
            {!online && pending > 0 && `Offline — ${pending} change${pending !== 1 ? 's' : ''} waiting to sync`}
            {online && pending > 0 && `Syncing ${pending} change${pending !== 1 ? 's' : ''}…`}
        </span>
    )
}
