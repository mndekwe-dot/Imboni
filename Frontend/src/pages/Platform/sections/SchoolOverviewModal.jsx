import { useState, useEffect } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { getSchoolOverview, suspendSchool, reactivateSchool } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { StatusChip } from './SchoolsSection'

const money = (v, c) => `${c || 'USD'} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const num = v => (v === null || v === undefined ? '-' : v)

function Field({ label, value, capitalize }) {
    return (
        <div className="pf-field">
            <span className="pf-field-label">{label}</span>
            <span className={`pf-field-value${capitalize ? ' pf-capitalize' : ''}`}>{value}</span>
        </div>
    )
}

export function SchoolOverviewModal({ schoolId, onClose, onStatusChange }) {
    const toast = useToast()
    const [data, setData]   = useState(null)
    const [loading, setLoading] = useState(true)
    const [busy, setBusy]   = useState(false)

    useEffect(() => {
        let alive = true
        getSchoolOverview(schoolId)
            .then(d => { if (alive) setData(d) })
            .catch(e => { if (alive) toast.error(errorMessage(e, 'Could not load the school.')) })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [schoolId, toast])

    async function toggleStatus() {
        const s = data.school
        const suspend = s.status !== 'suspended'
        setBusy(true)
        try {
            const updated = await (suspend ? suspendSchool(s.id) : reactivateSchool(s.id))
            setData(d => ({ ...d, school: { ...d.school, ...updated } }))
            onStatusChange?.(updated)
            toast.success(`${s.name} ${suspend ? 'suspended' : 'reactivated'}.`)
        } catch (e) { toast.error(errorMessage(e, 'Could not update the school.')) }
        finally { setBusy(false) }
    }

    const s = data?.school

    return (
        <Modal title={s?.name || 'School'} icon="apartment" onClose={onClose} size="lg">
            {loading || !s ? (
                <p className="platform-muted">Loading…</p>
            ) : (
                <>
                    <div className="pf-row pf-mb">
                        <StatusChip status={s.status} />
                        <button
                            className={`btn btn-sm pf-right ${s.status === 'suspended' ? 'btn-primary' : 'btn-outline platform-danger'}`}
                            disabled={busy} onClick={toggleStatus}
                        >
                            {busy ? '…' : s.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                        </button>
                    </div>

                    <div className="pf-grid pf-mb">
                        <Field label="Domain" value={s.primary_domain || s.schema_name} />
                        <Field label="Plan" value={s.plan} capitalize />
                        <Field label="Created" value={s.created_on} />
                        <Field label="Students" value={num(s.usage?.students)} />
                        <Field label="Staff" value={num(s.usage?.staff)} />
                    </div>

                    <p className="platform-section-title">Contracts</p>
                    {data.contracts.length === 0 ? <p className="platform-muted">No contracts.</p> : data.contracts.map(c => (
                        <div key={c.id} className="pf-list-row">
                            <span>{c.title} <span className="platform-muted">({c.start_date} → {c.end_date})</span></span>
                            <span className="platform-chip platform-chip-info pf-capitalize">{c.status}</span>
                        </div>
                    ))}

                    <p className="platform-section-title">Recent payments</p>
                    {data.payments.length === 0 ? <p className="platform-muted">No payments.</p> : data.payments.map(p => (
                        <div key={p.id} className="pf-list-row">
                            <span className="platform-muted">{(p.received_at || '').slice(0, 10)}</span>
                            <span>{money(p.amount, p.currency)} <span className="platform-muted pf-capitalize">· {p.status}</span></span>
                        </div>
                    ))}

                    <p className="platform-section-title">Tickets</p>
                    {data.tickets.length === 0 ? <p className="platform-muted">No tickets.</p> : data.tickets.map(t => (
                        <div key={t.id} className="pf-list-row">
                            <span>{t.subject}</span>
                            <span className="platform-muted pf-capitalize">{t.status.replace('_', ' ')}</span>
                        </div>
                    ))}
                </>
            )}
        </Modal>
    )
}
