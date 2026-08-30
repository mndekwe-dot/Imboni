import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatCard } from '../../components/layout/StatCard'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { cancelReservation, getReservations } from '../../api/library'
import { LibraryShell } from './LibraryShell'

/**
 * The hold queue: who is waiting, and what is sitting on the hold shelf.
 *
 * Two sections rather than one list, because they need different actions. A
 * copy that is READY has a name on it and a date it stops being held; a
 * WAITING request has neither yet, only a place in the queue.
 */
export function LibraryReservations() {
    const { t } = useTranslation()
    const toast = useToast()

    const [rows, setRows]       = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(() => {
        setLoading(true)
        getReservations({ status: 'open' })
            .then(d => setRows(Array.isArray(d) ? d : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('library.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    useEffect(() => { load() }, [load])

    async function handleCancel(res) {
        try {
            await cancelReservation(res.id)
            load()
            toast.success(t('library.reservations.cancelled'))
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        }
    }

    const ready   = rows.filter(r => r.status === 'ready')
    const waiting = rows.filter(r => r.status === 'waiting')

    return (
        <LibraryShell
            title={t('library.reservations.title')}
            subtitle={t('library.reservations.subtitle')}
        >
            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="inventory" value={loading ? '-' : ready.length}
                    label={t('library.reservations.onHoldShelf')} colorClass="success" />
                <StatCard icon="hourglass_top" value={loading ? '-' : waiting.length}
                    label={t('library.reservations.inQueue')} colorClass="info" />
            </div>

            <ListSection
                className="mb-1-5"
                icon="inventory"
                title={t('library.reservations.onHoldShelf')}
                count={loading ? null : t('library.reservationCount', { count: ready.length })}
            >
                {loading ? (
                    <p className="u-muted">{t('common.loading')}</p>
                ) : ready.length === 0 ? (
                    <EmptyState
                        icon="inventory"
                        title={t('library.reservations.nothingHeld')}
                        description={t('library.reservations.nothingHeldDesc')}
                    />
                ) : (
                    <ul className="lib-loan-list">
                        {ready.map(res => (
                            <li key={res.id} className="lib-loan-row">
                                <span className="lib-loan-icon" aria-hidden="true">
                                    <span className="material-symbols-rounded">bookmark_added</span>
                                </span>
                                <div className="lib-loan-main">
                                    <div className="u-strong u-sm">{res.book_title}</div>
                                    <div className="text-xs-muted">{res.member_detail?.name}</div>
                                </div>
                                <div className="lib-loan-due">
                                    {/* A hold is not forever: this is the date the
                                        copy goes to the next person in the queue. */}
                                    <span className="text-xs-muted">
                                        {t('library.reservations.heldUntil', {
                                            date: formatDate(res.expires_on),
                                        })}
                                    </span>
                                </div>
                                <div className="lib-loan-actions">
                                    <button className="btn btn-outline btn-sm"
                                        onClick={() => handleCancel(res)}>
                                        {t('library.reservations.release')}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </ListSection>

            <ListSection
                icon="hourglass_top"
                title={t('library.reservations.inQueue')}
                count={loading ? null : t('library.reservationCount', { count: waiting.length })}
            >
                {loading ? (
                    <p className="u-muted">{t('common.loading')}</p>
                ) : waiting.length === 0 ? (
                    <EmptyState
                        icon="hourglass_empty"
                        title={t('library.reservations.noQueue')}
                        description={t('library.reservations.noQueueDesc')}
                    />
                ) : (
                    <ul className="lib-loan-list">
                        {waiting.map(res => (
                            <li key={res.id} className="lib-loan-row">
                                <span className="lib-rank">{res.position}</span>
                                <div className="lib-loan-main">
                                    <div className="u-strong u-sm">{res.book_title}</div>
                                    <div className="text-xs-muted">
                                        {res.member_detail?.name}
                                        {res.member_detail?.class_label
                                            ? ` · ${res.member_detail.class_label}` : ''}
                                    </div>
                                </div>
                                <div className="lib-loan-due">
                                    <span className="text-xs-muted">
                                        {t('library.reservations.since', {
                                            date: formatDate(res.created_at),
                                        })}
                                    </span>
                                </div>
                                <div className="lib-loan-actions">
                                    <button className="btn btn-outline btn-sm"
                                        onClick={() => handleCancel(res)}>
                                        {t('common.remove')}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </ListSection>
        </LibraryShell>
    )
}
