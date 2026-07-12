import { useState, useEffect, useCallback } from 'react'
import {
    getApplications, approveApplication, rejectApplication, provisionApplication,
} from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

const STATUS_CLS = { pending: 'warn', approved: 'info', rejected: 'bad', provisioned: 'ok' }
const FILTERS = [['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['provisioned', 'Provisioned'], ['rejected', 'Rejected']]
const label = s => s.charAt(0).toUpperCase() + s.slice(1)

function ReviewModal({ app, onClose, onChanged }) {
    const toast = useToast()
    const [notes, setNotes] = useState(app.review_notes || '')
    const [busy, setBusy]   = useState(false)
    const [creds, setCreds] = useState(null)   // set after provisioning

    async function run(fn, okMsg) {
        setBusy(true)
        try {
            const updated = await fn()
            if (updated.provisioned) setCreds(updated.provisioned)
            toast.success(okMsg)
            onChanged(updated)
            if (!updated.provisioned) onClose()
        } catch (e) { toast.error(errorMessage(e, 'Action failed.')) }
        finally { setBusy(false) }
    }

    const row = (k, v) => v ? (
        <div style={{ marginBottom: '0.5rem' }}>
            <span className="platform-muted" style={{ fontSize: '0.75rem' }}>{k}</span>
            <div className="platform-strong">{v}</div>
        </div>
    ) : null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded">domain_add</span>
                        <h2 className="modal-title">{app.school_name}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>

                <div className="modal-body">
                    <span className={`platform-chip platform-chip-${STATUS_CLS[app.status]}`}>{label(app.status)}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', marginTop: '1rem' }}>
                        {row('Desired address', `${app.desired_subdomain}`)}
                        {row('Contact', app.contact_name)}
                        {row('Email', app.contact_email)}
                        {row('Phone', app.contact_phone)}
                        {row('Location', [app.city, app.country].filter(Boolean).join(', '))}
                        {row('Est. students', app.student_estimate)}
                        {row('Plan interest', app.plan_interest && label(app.plan_interest))}
                    </div>
                    {app.message && <p style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{app.message}</p>}

                    {creds ? (
                        <div className="platform-form" style={{ marginTop: '1rem' }}>
                            <p className="platform-strong" style={{ marginBottom: '0.5rem' }}>School provisioned ✓ — share these credentials:</p>
                            {row('Login URL', creds.login_url)}
                            {row('Admin email', creds.admin_email)}
                            {row('Temporary password', creds.temp_password)}
                            <p className="platform-muted" style={{ fontSize: '0.75rem' }}>The school should change this password on first sign-in.</p>
                        </div>
                    ) : app.status !== 'provisioned' && app.status !== 'rejected' && (
                        <label style={{ display: 'block', marginTop: '1rem', fontSize: '0.78rem', fontWeight: 600 }}>
                            Review notes
                            <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
                        </label>
                    )}
                </div>

                {!creds && (
                    <div className="modal-footer" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                        {app.status === 'pending' && (
                            <>
                                <button className="btn btn-outline platform-danger" disabled={busy} onClick={() => run(() => rejectApplication(app.id, notes), 'Application rejected.')}>Reject</button>
                                <button className="btn btn-primary" disabled={busy} onClick={() => run(() => approveApplication(app.id, notes), 'Application approved.')}>Approve</button>
                            </>
                        )}
                        {app.status === 'approved' && (
                            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => provisionApplication(app.id), 'School provisioned.')}>
                                {busy ? 'Provisioning…' : 'Provision school'}
                            </button>
                        )}
                        {app.status === 'rejected' && <p className="platform-muted">This application was rejected.</p>}
                    </div>
                )}
            </div>
        </div>
    )
}

export function ApplicationsSection() {
    const toast = useToast()
    const [apps, setApps]     = useState([])
    const [filter, setFilter] = useState('')
    const [loading, setLoading] = useState(true)
    const [active, setActive] = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        try { setApps(await getApplications(filter)) }
        catch (e) { toast.error(errorMessage(e, 'Could not load applications.')) }
        finally { setLoading(false) }
    }, [toast, filter])
    useEffect(() => { load() }, [load])

    function onChanged(updated) {
        setApps(list => list.map(a => (a.id === updated.id ? { ...a, ...updated } : a)))
        setActive(a => (a && a.id === updated.id ? { ...a, ...updated } : a))
    }

    return (
        <div className="card">
            <div className="card-content">
                <div className="platform-panel-head">
                    <h2>School applications</h2>
                    <select className="form-input platform-input-sm" value={filter} onChange={e => setFilter(e.target.value)}>
                        {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>

                {loading ? (
                    <p className="platform-muted">Loading…</p>
                ) : apps.length === 0 ? (
                    <p className="platform-muted">No applications. Prospective schools apply at <code>/apply</code>.</p>
                ) : (
                    <div className="platform-table-wrap">
                        <table className="platform-table">
                            <thead>
                                <tr><th>School</th><th>Address</th><th>Contact</th><th>Received</th><th>Status</th><th className="platform-col-action">Review</th></tr>
                            </thead>
                            <tbody>
                                {apps.map(a => (
                                    <tr key={a.id}>
                                        <td className="platform-strong">{a.school_name}</td>
                                        <td className="platform-muted">{a.desired_subdomain}</td>
                                        <td>{a.contact_name}<div className="platform-muted" style={{ fontSize: '0.78rem' }}>{a.contact_email}</div></td>
                                        <td className="platform-muted">{new Date(a.created_at).toLocaleDateString()}</td>
                                        <td><span className={`platform-chip platform-chip-${STATUS_CLS[a.status]}`}>{label(a.status)}</span></td>
                                        <td className="platform-col-action">
                                            <button className="btn btn-outline btn-sm" onClick={() => setActive(a)}>Open</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {active && <ReviewModal app={active} onClose={() => setActive(null)} onChanged={onChanged} />}
        </div>
    )
}
