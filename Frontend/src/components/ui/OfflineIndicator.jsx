import { useOfflineStatus } from '../../hooks/useOfflineStatus'

/**
 * Small status pill for offline-capable pages. Hidden while online with an
 * empty sync queue; otherwise shows connectivity and how many changes are
 * waiting to sync.
 */
export function OfflineIndicator() {
    const { online, pending } = useOfflineStatus()

    if (online && pending === 0) return null

    return (
        <span
            role="status"
            className={`offline-pill offline-pill--${online ? 'syncing' : 'offline'}`}
        >
            <span className="material-symbols-rounded">
                {online ? 'cloud_sync' : 'cloud_off'}
            </span>
            {!online && pending === 0 && 'Offline: changes will be saved locally'}
            {!online && pending > 0 && `Offline: ${pending} change${pending !== 1 ? 's' : ''} waiting to sync`}
            {online && pending > 0 && `Syncing ${pending} change${pending !== 1 ? 's' : ''}…`}
        </span>
    )
}
