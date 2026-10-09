import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { ProgressBar } from './ProgressBar'
import { subscribeTransfers, getTransfers, dismissTransfer } from '../../utils/transfers'

const ICON = { upload: 'upload', download: 'download' }

function Item({ item }) {
    const { t } = useTranslation()
    const { direction, name, percent, status, leaving } = item

    const title = status === 'done'  ? t(`transfers.${direction}Done`)
                : status === 'error' ? t(`transfers.${direction}Failed`)
                :                      t(`transfers.${direction}Active`)

    return (
        <li className={`xfer-item is-${status}${leaving ? ' is-leaving' : ''}`}>
            <div className="xfer-row">
                <span className="material-symbols-rounded xfer-icon" aria-hidden="true">
                    {status === 'done' ? 'check_circle' : status === 'error' ? 'error' : ICON[direction]}
                </span>
                <div className="xfer-text">
                    <div className="xfer-title">{title}</div>
                    {name && <div className="xfer-name" title={name}>{name}</div>}
                </div>
                {status === 'active' && typeof percent === 'number' && (
                    <span className="xfer-pct">{percent}%</span>
                )}
                {status !== 'active' && (
                    <button type="button" className="btn-icon-clean xfer-close"
                        onClick={() => dismissTransfer(item.id)} aria-label={t('common.close')}>
                        <span className="material-symbols-rounded" aria-hidden="true">close</span>
                    </button>
                )}
            </div>
            <ProgressBar
                size="sm"
                value={status === 'active' ? percent : 100}
                tone={status === 'done' ? 'success' : status === 'error' ? 'error' : 'primary'}
                active={status === 'active'}
                label={`${title}${name ? ` - ${name}` : ''}`}
            />
        </li>
    )
}

/**
 * Every upload and download in flight, bottom-right, whatever page you are on.
 * Mounted once, in App. Renders nothing when there is nothing to show, and its
 * list is a polite live region so a finished or failed transfer is announced.
 */
export function TransferTray() {
    const { t } = useTranslation()
    const items = useSyncExternalStore(subscribeTransfers, getTransfers)
    if (items.length === 0) return null
    return (
        <ul className="xfer-tray" aria-live="polite" aria-label={t('transfers.title')}>
            {items.map(item => <Item key={item.id} item={item} />)}
        </ul>
    )
}
