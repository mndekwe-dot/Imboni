import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { getChildExeats, requestChildExeat } from '../../api/parent'

const REASONS = ['weekend', 'medical', 'family', 'event', 'other']
const TONE = { requested: 'badge-soft-warning', approved: 'badge-soft-info', declined: 'badge-soft-danger',
    out: 'badge-soft-info', returned: 'badge-soft-success' }

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function localInput(date) {
    const pad = n => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function RequestModal({ child, onClose, onSent }) {
    const { t } = useTranslation()
    const toast = useToast()
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
    const [form, setForm] = useState({
        reason_type: 'weekend', reason: '',
        departure_at: localInput(tomorrow),
        expected_return_at: localInput(new Date(tomorrow.getTime() + 48 * 3600 * 1000)),
    })
    const [busy, setBusy] = useState(false)
    const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

    async function send(e) {
        e.preventDefault()
        setBusy(true)
        try {
            await requestChildExeat(child.id, {
                ...form,
                departure_at: new Date(form.departure_at).toISOString(),
                expected_return_at: new Date(form.expected_return_at).toISOString(),
            })
            toast.success(t('parent.exeat.sent'))
            onSent(); onClose()
        } catch (err) {
            toast.error(errorMessage(err, t('parent.exeat.sendFailed')))
        } finally { setBusy(false) }
    }

    return (
        <Modal title={t('parent.exeat.title')} icon="badge" onClose={onClose}>
            <form onSubmit={send}>
                <label className="form-group">
                    <span className="form-label">{t('dis.exeat.reasonType')}</span>
                    <select className="form-input" value={form.reason_type} onChange={e => set('reason_type', e.target.value)}>
                        {REASONS.map(r => <option key={r} value={r}>{t(`dis.exeat.reasons.${r}`)}</option>)}
                    </select>
                </label>
                <label className="form-group">
                    <span className="form-label">{t('parent.exeat.reason', { name: child.student_name })}</span>
                    <textarea className="form-input form-textarea" rows="3" required value={form.reason}
                        onChange={e => set('reason', e.target.value)} />
                </label>
                <div className="form-row-2">
                    <label className="form-group">
                        <span className="form-label">{t('parent.exeat.leaves')}</span>
                        <input type="datetime-local" className="form-input" required value={form.departure_at}
                            onChange={e => set('departure_at', e.target.value)} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('parent.exeat.back')}</span>
                        <input type="datetime-local" className="form-input" required value={form.expected_return_at}
                            onChange={e => set('expected_return_at', e.target.value)} />
                    </label>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn btn-outline" onClick={onClose}>{t('parent.exeat.cancel')}</button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>{t('parent.exeat.send')}</button>
                </div>
            </form>
        </Modal>
    )
}

/**
 * Ask for a boarder to be let out, and follow the request.
 *
 * Hidden when the school has no boarding (the server answers 404): a day school
 * has no use for the button, and a button that always fails is worse than none.
 */
export function ExeatRequestPanel({ child }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [rows, setRows] = useState(null)
    const [available, setAvailable] = useState(true)
    const [open, setOpen] = useState(false)

    const load = useCallback(() => {
        getChildExeats(child.id)
            .then(d => setRows(Array.isArray(d) ? d : []))
            .catch(e => {
                if (e?.response?.status === 404 || e?.status === 404) { setAvailable(false); return }
                toast.error(errorMessage(e, t('parent.exeat.sendFailed')))
            })
    }, [child.id, toast, t])

    useEffect(() => { load() }, [load])

    if (!available) return null

    return (
        <div className="card mt-1-5">
            <div className="card-header">
                <h3 className="card-title">{t('parent.exeat.title')}</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>{t('parent.exeat.request')}</button>
            </div>
            <div className="card-content">
                <p className="u-muted u-sm">{t('parent.exeat.intro')}</p>
                {rows && rows.length === 0 && <p className="u-muted">{t('parent.exeat.none')}</p>}
                <ul className="row-list">
                    {(rows || []).map(r => (
                        <li key={r.id} className="row-item">
                            <span className="row-main">
                                <span className="u-strong u-sm">{t(`dis.exeat.reasons.${r.reason_type}`)}</span>
                                <span className="text-xs-muted">{formatDate(r.departure_at)} → {formatDate(r.expected_return_at)}</span>
                            </span>
                            <span className={`badge ${TONE[r.status] || 'badge-secondary'}`}>{t(`dis.exeat.statuses.${r.status}`)}</span>
                        </li>
                    ))}
                </ul>
            </div>
            {open && <RequestModal child={child} onClose={() => setOpen(false)} onSent={load} />}
        </div>
    )
}
