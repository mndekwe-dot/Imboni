import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../../components/ui/Modal'
import { getSchoolOverview, suspendSchool, reactivateSchool, setSchoolModules, openSupportSession } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { StatusChip } from './SchoolsSection'
import { SkeletonList } from '../../../components/ui/Skeleton'

const money = (v, c) => `${c || 'USD'} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const num = v => (v === null || v === undefined ? '-' : v)

// The parts of the product an operator can switch off for one school.
const MODULE_KEYS = ['boarding', 'matron', 'library']

function Field({ label, value, capitalize }) {
    return (
        <div className="pf-field">
            <span className="pf-field-label">{label}</span>
            <span className={`pf-field-value${capitalize ? ' pf-capitalize' : ''}`}>{value}</span>
        </div>
    )
}

export function SchoolOverviewModal({ schoolId, onClose, onStatusChange }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [data, setData]   = useState(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy]   = useState(false)
    const m = key => t(`platform.schoolModal.${key}`)
    const moduleLabel = key => t(`platform.schoolModal.modules.${key}.label`)

    useEffect(() => {
        let alive = true
        getSchoolOverview(schoolId)
            .then(d => { if (alive) setData(d) })
            .catch(e => { if (alive) toast.error(errorMessage(e, t('platform.schoolModal.loadFailed'))) })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [schoolId, toast, t])

    async function toggleStatus() {
        const s = data.school
        const suspend = s.status !== 'suspended'
        setBusy(true)
        try {
            const updated = await (suspend ? suspendSchool(s.id) : reactivateSchool(s.id))
            setData(d => ({ ...d, school: { ...d.school, ...updated } }))
            onStatusChange?.(updated)
            toast.success(t(`platform.schoolModal.${suspend ? 'suspended' : 'reactivated'}`, { name: s.name }))
        } catch (e) { toast.error(errorMessage(e, m('updateFailed'))) }
        finally { setBusy(false) }
    }

    async function toggleModule(key, on) {
        const s = data.school
        const off = new Set(s.disabled_modules || [])
        if (on) off.delete(key); else off.add(key)
        setBusy(true)
        try {
            const updated = await setSchoolModules(s.id, MODULE_KEYS.filter(k => off.has(k)))
            setData(d => ({ ...d, school: { ...d.school, ...updated } }))
            toast.success(t(`platform.schoolModal.${on ? 'moduleOn' : 'moduleOff'}`, { module: moduleLabel(key), name: s.name }))
        } catch (e) { toast.error(errorMessage(e, m('moduleFailed'))) }
        finally { setBusy(false) }
    }

    const [support, setSupport] = useState(null)   // null = closed; otherwise {reason, minutes}

    async function startSupport(e) {
        e.preventDefault()
        setBusy(true)
        try {
            const out = await openSupportSession(data.school.id, support.reason, Number(support.minutes))
            // The token is in the fragment of this URL; it never goes to a server in transit.
            window.open(out.url, '_blank', 'noopener')
            toast.success(t('platform.schoolModal.supportOpened', { minutes: out.minutes, as: out.as }))
            setSupport(null)
        } catch (err) { toast.error(errorMessage(err, m('supportFailed'))) }
        finally { setBusy(false) }
    }

    const s = data?.school
    const statusWord = x => String(x).replace('_', ' ')

    return (
        <Modal title={s?.name || m('fallbackTitle')} icon="apartment" onClose={onClose} size="lg">
            {loading || !s ? (
                <SkeletonList items={3} />
            ) : (
                <>
                    <div className="pf-row pf-mb">
                        <StatusChip status={s.status} />
                        <button
                            className={`btn btn-sm pf-right ${s.status === 'suspended' ? 'btn-primary' : 'btn-outline platform-danger'}`}
                            disabled={busy} onClick={toggleStatus}
                        >
                            {busy ? '…' : s.status === 'suspended' ? m('reactivate') : m('suspend')}
                        </button>
                    </div>

                    <div className="pf-grid pf-mb">
                        <Field label={m('domain')} value={s.primary_domain || s.schema_name} />
                        <Field label={m('plan')} value={t(`platform.common.plan.${s.plan}`, { defaultValue: s.plan })} capitalize />
                        <Field label={m('created')} value={s.created_on} />
                        <Field label={m('students')} value={num(s.usage?.students)} />
                        <Field label={m('staff')} value={num(s.usage?.staff)} />
                    </div>

                    <p className="platform-section-title">{m('supportTitle')}</p>
                    {!support ? (
                        <button className="btn btn-outline btn-sm pf-mb" onClick={() => setSupport({ reason: '', minutes: 20 })}>
                            {m('supportOpen')}
                        </button>
                    ) : (
                        <form className="pf-mb" onSubmit={startSupport}>
                            <p className="platform-muted">{m('supportNote')}</p>
                            <label className="form-group">
                                <span className="form-label">{m('why')}</span>
                                <textarea className="form-input form-textarea" rows="2" required minLength={10} value={support.reason}
                                    onChange={e => setSupport(x => ({ ...x, reason: e.target.value }))} />
                            </label>
                            <label className="form-group">
                                <span className="form-label">{m('minutes')}</span>
                                <input className="form-input" type="number" min="5" max="30" value={support.minutes}
                                    onChange={e => setSupport(x => ({ ...x, minutes: e.target.value }))} />
                            </label>
                            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || support.reason.trim().length < 10}>{m('openSession')}</button>
                            {' '}
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSupport(null)}>{m('cancel')}</button>
                        </form>
                    )}

                    <p className="platform-section-title">{m('modulesTitle')}</p>
                    <p className="platform-muted pf-mb">{m('modulesNote')}</p>
                    {MODULE_KEYS.map(key => {
                        const on = !(s.disabled_modules || []).includes(key)
                        return (
                            <label key={key} className="pf-list-row">
                                <span>{moduleLabel(key)} <span className="platform-muted">{t(`platform.schoolModal.modules.${key}.note`)}</span></span>
                                <input type="checkbox" checked={on} disabled={busy}
                                    aria-label={moduleLabel(key)} onChange={e => toggleModule(key, e.target.checked)} />
                            </label>
                        )
                    })}

                    <p className="platform-section-title">{m('contracts')}</p>
                    {data.contracts.length === 0 ? <p className="platform-muted">{m('noContracts')}</p> : data.contracts.map(c => (
                        <div key={c.id} className="pf-list-row">
                            <span>{c.title} <span className="platform-muted">({c.start_date} → {c.end_date})</span></span>
                            <span className="platform-chip platform-chip-info pf-capitalize">{t(`platform.contracts.chip.${c.status}`, { defaultValue: statusWord(c.status) })}</span>
                        </div>
                    ))}

                    <p className="platform-section-title">{m('payments')}</p>
                    {data.payments.length === 0 ? <p className="platform-muted">{m('noPayments')}</p> : data.payments.map(p => (
                        <div key={p.id} className="pf-list-row">
                            <span className="platform-muted">{(p.received_at || '').slice(0, 10)}</span>
                            <span>{money(p.amount, p.currency)} <span className="platform-muted pf-capitalize">· {t(`platform.revenue.status.${p.status}`, { defaultValue: p.status })}</span></span>
                        </div>
                    ))}

                    <p className="platform-section-title">{m('tickets')}</p>
                    {data.tickets.length === 0 ? <p className="platform-muted">{m('noTickets')}</p> : data.tickets.map(tk => (
                        <div key={tk.id} className="pf-list-row">
                            <span>{tk.subject}</span>
                            <span className="platform-muted pf-capitalize">{t(`platform.tickets.status.${tk.status}`, { defaultValue: statusWord(tk.status) })}</span>
                        </div>
                    ))}
                </>
            )}
        </Modal>
    )
}
