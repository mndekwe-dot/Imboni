import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { getBedLayout } from '../../api/discipline'

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function Room({ room }) {
    const { t } = useTranslation()
    return (
        <div className={`bed-room${room.closed ? ' closed' : ''}`}>
            <div className="bed-room-head">
                <strong>{t('dis.beds.room', { number: room.room_number })}</strong>
                <span className="u-muted u-sm">
                    {room.closed ? t('dis.beds.closed') : `${room.free} ${t('dis.beds.free')}`}
                </span>
            </div>
            <ul className="bed-grid">
                {room.beds.map(b => {
                    const label = room.closed
                        ? t('dis.beds.bed', { number: b.bed })
                        : b.occupant
                            ? t('dis.beds.bedTaken', { number: b.bed, name: b.occupant })
                            : t('dis.beds.bedFree', { number: b.bed })
                    return (
                        <li key={b.bed} className={`bed ${room.closed ? 'closed' : b.occupant ? 'taken' : 'free'}`}
                            title={label} aria-label={label}>
                            <span className="bed-no" aria-hidden="true">{b.bed}</span>
                            <span aria-hidden="true">{b.occupant ? initials(b.occupant) : ''}</span>
                        </li>
                    )
                })}
            </ul>
            {room.overflow.length > 0 && (
                <p className="form-error">{t('dis.beds.overflow', { names: room.overflow.join(', ') })}</p>
            )}
        </div>
    )
}

/** Every dormitory room by room, with each bed shown as taken, free or closed. */
export function BedGridTab() {
    const { t } = useTranslation()
    const toast = useToast()
    const [dorms, setDorms] = useState(null)

    useEffect(() => {
        getBedLayout()
            .then(setDorms)
            .catch(e => { toast.error(errorMessage(e, t('dis.beds.loadFailed'))); setDorms([]) })
    }, [toast, t])

    if (dorms === null) return <p className="u-pad u-muted">{t('common.loading')}</p>
    if (dorms.length === 0) return <EmptyState icon="bed" title={t('dis.beds.loadFailed')} description={t('dis.beds.empty')} />

    return (
        <>
            <ul className="u-row u-wrap bed-legend">
                <li className="bed taken">{t('dis.beds.legendTaken')}</li>
                <li className="bed free">{t('dis.beds.legendFree')}</li>
                <li className="bed closed">{t('dis.beds.legendClosed')}</li>
            </ul>
            {dorms.map(d => (
                <section key={d.id} className="card">
                    <div className="card-header">
                        <h3 className="card-title">{d.name}</h3>
                        <span className="u-muted u-sm">{t('dis.beds.occupancy', { occupied: d.occupied, capacity: d.capacity })}</span>
                    </div>
                    <div className="card-content bed-rooms">
                        {d.rooms.map(r => <Room key={r.room_number} room={r} />)}
                    </div>
                </section>
            ))}
        </>
    )
}
