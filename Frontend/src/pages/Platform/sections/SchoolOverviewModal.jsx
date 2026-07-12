import { useState, useEffect } from 'react'
import { getSchoolOverview, suspendSchool, reactivateSchool } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { StatusChip } from './SchoolsSection'

const money = (v, c) => `${c || 'USD'} ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const num = v => (v === null || v === undefined ? '—' : v)

function Field({ label, value }) {
    return (
        <div>
            <div className="platform-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
            <div className="platform-strong" style={{ textTransform: label === 'Plan' ? 'capitalize' : 'none' }}>{value}</div>
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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '88vh', overflowY: 'auto' }}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded">apartment</span>
                        <h2 className="modal-title">{s?.name || 'School'}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>

                <div className="modal-body">
                    {loading || !s ? (
                        <p className="platform-muted">Loading…</p>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <StatusChip status={s.status} />
                                <button className={`btn btn-sm ${s.status === 'suspended' ? 'btn-primary' : 'btn-outline platform-danger'}`} disabled={busy} onClick={toggleStatus} style={{ marginLeft: 'auto' }}>
                                    {busy ? '…' : s.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
                                <Field label="Domain" value={s.primary_domain || s.schema_name} />
                                <Field label="Plan" value={s.plan} />
                                <Field label="Created" value={s.created_on} />
                                <Field label="Students" value={num(s.usage?.students)} />
                                <Field label="Staff" value={num(s.usage?.staff)} />
                            </div>

                            <p className="platform-section-title">Contracts</p>
                            {data.contracts.length === 0 ? <p className="platform-muted">No contracts.</p> : data.contracts.map(c => (
                                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                                    <span>{c.title} <span className="platform-muted">({c.start_date} → {c.end_date})</span></span>
                                    <span className="platform-chip platform-chip-info" style={{ textTransform: 'capitalize' }}>{c.status}</span>
                                </div>
                            ))}

                            <p className="platform-section-title">Recent payments</p>
                            {data.payments.length === 0 ? <p className="platform-muted">No payments.</p> : data.payments.map(p => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                                    <span className="platform-muted">{(p.received_at || '').slice(0, 10)}</span>
                                    <span>{money(p.amount, p.currency)} <span className="platform-muted" style={{ textTransform: 'capitalize' }}>· {p.status}</span></span>
                                </div>
                            ))}

                            <p className="platform-section-title">Tickets</p>
                            {data.tickets.length === 0 ? <p className="platform-muted">No tickets.</p> : data.tickets.map(t => (
                                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                                    <span>{t.subject}</span>
                                    <span className="platform-muted" style={{ textTransform: 'capitalize' }}>{t.status.replace('_', ' ')}</span>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
