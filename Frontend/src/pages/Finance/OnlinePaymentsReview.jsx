import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { getOnlinePayments, resolveOnlinePayment } from '../../api/finance'
import { Money } from './FinanceShell'

/**
 * Money that arrived from a parent's phone with nowhere to go.
 *
 * Shown only while there is something to place: it is the one case where the
 * school holds a family's money it has not receipted, and it must not wait to
 * be noticed.
 */
export function OnlinePaymentsReview() {
    const { t } = useTranslation()
    const toast = useToast()
    const [rows, setRows] = useState([])
    const [notes, setNotes] = useState({})

    const load = useCallback(() => {
        getOnlinePayments({ status: 'needs_review' })
            .then(d => setRows(Array.isArray(d) ? d : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.onlineReview.loadFailed'))) })
    }, [toast, t])

    useEffect(() => { load() }, [load])

    async function close(row) {
        try {
            await resolveOnlinePayment(row.id, notes[row.id] || '')
            toast.success(t('finance.onlineReview.closed'))
            load()
        } catch (e) {
            toast.error(errorMessage(e, t('finance.onlineReview.failed')))
        }
    }

    if (rows.length === 0) return null
    return (
        <div className="card mb-1-5" role="region" aria-label={t('finance.onlineReview.title')}>
            <div className="card-header"><h3 className="card-title">{t('finance.onlineReview.title')}</h3></div>
            <div className="card-content">
                <p className="u-muted u-sm">{t('finance.onlineReview.intro')}</p>
                <ul className="row-list">
                    {rows.map(r => (
                        <li key={r.id} className="row-item">
                            <span className="row-main">
                                <span className="u-strong u-sm">{r.student} · <Money value={r.amount} /></span>
                                <span className="text-xs-muted">{r.paid_by} · {r.phone} · {r.transaction_id || r.detail}</span>
                            </span>
                            <input className="form-input" aria-label={`${t('finance.onlineReview.note')}: ${r.student}`}
                                placeholder={t('finance.onlineReview.note')} value={notes[r.id] || ''}
                                onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} />
                            <button className="btn btn-outline btn-sm" disabled={!(notes[r.id] || '').trim()} onClick={() => close(r)}>
                                {t('finance.onlineReview.close')}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
