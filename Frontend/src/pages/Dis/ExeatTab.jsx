import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/ui/Modal'
import { FilterBar } from '../../components/ui/FilterBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { StudentSearchPicker } from '../../components/ui/StudentSearchPicker'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/date'
import { getExeats, createExeat, actOnExeat, searchDisStudents } from '../../api/discipline'

const REASONS = ['weekend', 'medical', 'family', 'event', 'other']

const STATUS_BADGE = {
    requested: 'badge-soft-warning',
    approved:  'badge-soft-info',
    declined:  'badge-soft-destructive',
    out:       'badge-soft-primary',
    returned:  'badge-soft-success',
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function localInput(date) {
    const pad = n => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function NewPassModal({ onClose, onCreated }) {
    const { t } = useTranslation()
    const toast = useToast()
    const now = new Date()
    const [student, setStudent] = useState(null)
    const [form, setForm] = useState({
        reason_type: 'weekend',
        reason: '',
        departure_at: localInput(now),
        expected_return_at: localInput(new Date(now.getTime() + 48 * 3600 * 1000)),
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)

    async function save() {
        if (!student?.id) return setError(t('dis.exeat.pickStudent'))
        setSaving(true); setError(null)
        try {
            const created = await createExeat({
                student: student.id,
                reason_type: form.reason_type,
                reason: form.reason.trim(),
                departure_at: new Date(form.departure_at).toISOString(),
                expected_return_at: new Date(form.expected_return_at).toISOString(),
            })
            onCreated(created)
            toast.success(t('dis.exeat.created'))
            onClose()
        } catch (e) {
            setError(errorMessage(e, t('dis.exeat.createFailed')))
        } finally { setSaving(false) }
    }

    return (
        <Modal title={t('dis.exeat.newPass')} icon="badge" onClose={onClose}
            footer={
                <div className="modal-confirm-actions">
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={save} disabled={saving}>{t('dis.exeat.request')}</button>
                </div>
            }
        >
            <StudentSearchPicker value={student} onChange={setStudent} fetchStudents={searchDisStudents} required />
            <div className="form-group">
                <label className="form-label" htmlFor="exeat-reason-type">{t('dis.exeat.reasonType')}</label>
                <select id="exeat-reason-type" className="form-control" value={form.reason_type}
                    onChange={e => setForm(f => ({ ...f, reason_type: e.target.value }))}>
                    {REASONS.map(r => <option key={r} value={r}>{t(`dis.exeat.reasons.${r}`)}</option>)}
                </select>
            </div>
            <div className="form-row-2">
                <div className="form-group">
                    <label className="form-label" htmlFor="exeat-out">{t('dis.exeat.departure')}</label>
                    <input id="exeat-out" type="datetime-local" className="form-control" value={form.departure_at}
                        onChange={e => setForm(f => ({ ...f, departure_at: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="exeat-back">{t('dis.exeat.expectedReturn')}</label>
                    <input id="exeat-back" type="datetime-local" className="form-control" value={form.expected_return_at}
                        onChange={e => setForm(f => ({ ...f, expected_return_at: e.target.value }))} />
                </div>
            </div>
            <div className="form-group">
                <label className="form-label" htmlFor="exeat-notes">{t('dis.exeat.details')}</label>
                <textarea id="exeat-notes" className="form-control" rows={3} value={form.reason}
                    onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
            {error && <p className="form-error">{error}</p>}
        </Modal>
    )
}

/** What can be done to a pass next, in the order the lifecycle allows. */
function nextActions(p) {
    const acts = []
    if (p.status === 'requested' && p.parent_approval === 'pending') {
        acts.push({ action: 'parent_approved', label: 'parentApproved', primary: true })
        acts.push({ action: 'parent_declined', label: 'parentDeclined' })
    }
    if (p.status === 'requested' && p.parent_approval === 'approved') acts.push({ action: 'approve', label: 'approve', primary: true })
    if (p.status === 'approved') acts.push({ action: 'depart', label: 'signOut', primary: true })
    if (p.status === 'out') acts.push({ action: 'return', label: 'markReturned', primary: true })
    return acts
}

export function ExeatTab() {
    const { t } = useTranslation()
    const toast = useToast()
    const [passes, setPasses] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('open')
    const [showNew, setShowNew] = useState(false)

    const load = useCallback(() => (
        getExeats()
            .then(data => setPasses(Array.isArray(data) ? data : []))
            .catch(e => toast.error(errorMessage(e, t('dis.exeat.loadFailed'))))
            .finally(() => setLoading(false))
    ), [toast, t])

    useEffect(() => { load() }, [load])

    async function act(pass, action) {
        try {
            const updated = await actOnExeat(pass.id, { action })
            setPasses(prev => prev.map(p => p.id === pass.id ? updated : p))
        } catch (e) {
            toast.error(errorMessage(e, t('dis.exeat.actionFailed')))
        }
    }

    const overdue = passes.filter(p => p.is_overdue)
    const FILTERS = {
        open:     p => ['requested', 'approved'].includes(p.status),
        out:      p => p.status === 'out',
        overdue:  p => p.is_overdue,
        returned: p => p.status === 'returned' || p.status === 'declined',
        all:      () => true,
    }
    const options = ['open', 'out', 'overdue', 'returned', 'all'].map(key => ({
        key, label: t(`dis.exeat.filters.${key}`), count: passes.filter(FILTERS[key]).length,
    }))
    const shown = passes.filter(FILTERS[filter])

    return (
        <>
            {overdue.length > 0 && (
                <div className="card" role="alert">
                    <div className="card-content">
                        <strong>{t('dis.exeat.overdueBanner', { count: overdue.length })}</strong>{' '}
                        {overdue.map(p => p.student_name).join(', ')}
                    </div>
                </div>
            )}

            <div className="toolbar-card">
                <FilterBar options={options} active={filter} onChange={setFilter} />
                <div className="toolbar-spacer" />
                <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                    {t('dis.exeat.newPass')}
                </button>
            </div>

            {loading ? (
                <p className="u-pad u-muted">{t('common.loading')}</p>
            ) : shown.length === 0 ? (
                <EmptyState icon="badge" title={t('dis.exeat.emptyTitle')} description={t('dis.exeat.emptyDesc')} />
            ) : (
                <div className="card">
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('common.student')}</th>
                                    <th>{t('dis.exeat.reasonType')}</th>
                                    <th>{t('dis.exeat.departure')}</th>
                                    <th>{t('dis.exeat.expectedReturn')}</th>
                                    <th>{t('dis.exeat.parent')}</th>
                                    <th>{t('common.status')}</th>
                                    <th><span className="sr-only">{t('common.actions')}</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map(p => (
                                    <tr key={p.id}>
                                        <td><strong>{p.student_name}</strong><div className="cell-sub">{p.class_name}</div></td>
                                        <td>{t(`dis.exeat.reasons.${p.reason_type}`)}{p.reason ? <div className="cell-sub">{p.reason}</div> : null}</td>
                                        <td>{formatDateTime(p.departure_at)}</td>
                                        <td>
                                            {formatDateTime(p.expected_return_at)}
                                            {p.actual_return_at && <div className="cell-sub">{t('dis.exeat.backAt', { when: formatDateTime(p.actual_return_at) })}</div>}
                                        </td>
                                        <td>{t(`dis.exeat.parentStates.${p.parent_approval}`)}</td>
                                        <td>
                                            <span className={`badge ${p.is_overdue ? 'badge-soft-destructive' : STATUS_BADGE[p.status]}`}>
                                                {p.is_overdue ? t('dis.exeat.overdue') : t(`dis.exeat.statuses.${p.status}`)}
                                            </span>
                                            {p.gate_verified_by_name && <div className="cell-sub">{t('dis.exeat.gateBy', { name: p.gate_verified_by_name })}</div>}
                                        </td>
                                        <td>
                                            <div className="u-row-sm u-wrap">
                                                {nextActions(p).map(a => (
                                                    <button key={a.action} className={`btn btn-sm ${a.primary ? 'btn-primary' : 'btn-outline'}`}
                                                        onClick={() => act(p, a.action)}>
                                                        {t(`dis.exeat.actions.${a.label}`)}
                                                    </button>
                                                ))}
                                                {['requested', 'approved'].includes(p.status) && p.parent_approval !== 'pending' && (
                                                    <button className="btn btn-sm btn-outline btn-destructive-outline" onClick={() => act(p, 'decline')}>
                                                        {t('dis.exeat.actions.decline')}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showNew && <NewPassModal onClose={() => setShowNew(false)} onCreated={p => setPasses(prev => [p, ...prev])} />}
        </>
    )
}
