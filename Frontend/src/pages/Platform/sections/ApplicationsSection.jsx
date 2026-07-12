import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../../../components/ui/Modal'
import {
    getApplications, approveApplication, rejectApplication, provisionApplication,
} from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

const STATUS_CLS = { pending: 'warn', approved: 'info', rejected: 'bad', provisioned: 'ok' }
const FILTERS = [['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['provisioned', 'Provisioned'], ['rejected', 'Rejected']]
const label = s => s.charAt(0).toUpperCase() + s.slice(1)

function Field({ label, value }) {
    return value ? (
        <div className="pf-field">
            <span className="pf-field-label">{label}</span>
            <span className="pf-field-value">{value}</span>
        </div>
    ) : null
}

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

    let footer = null
    if (!creds) {
        if (app.status === 'pending') {
            footer = (
                <>
                    <button className="btn btn-outline platform-danger" disabled={busy} onClick={() => run(() => rejectApplication(app.id, notes), 'Application rejected.')}>Reject</button>
                    <button className="btn btn-primary" disabled={busy} onClick={() => run(() => approveApplication(app.id, notes), 'Application approved.')}>Approve</button>
                </>
            )
        } else if (app.status === 'approved') {
            footer = (
                <button className="btn btn-primary" disabled={busy} onClick={() => run(() => provisionApplication(app.id), 'School provisioned.')}>
                    {busy ? 'Provisioning…' : 'Provision school'}
                </button>
            )
        }
    }

    return (
        <Modal title={app.school_name} icon="domain_add" onClose={onClose} footer={footer}>
            <span className={`platform-chip platform-chip-${STATUS_CLS[app.status]}`}>{label(app.status)}</span>

            <div className="pf-grid pf-mt pf-mb">
                <Field label="Desired address" value={app.desired_subdomain} />
                <Field label="Contact" value={app.contact_name} />
                <Field label="Email" value={app.contact_email} />
                <Field label="Phone" value={app.contact_phone} />
                <Field label="Location" value={[app.city, app.country].filter(Boolean).join(', ')} />
                <Field label="Est. students" value={app.student_estimate} />
                <Field label="Plan interest" value={app.plan_interest && label(app.plan_interest)} />
            </div>
            {app.message && <p className="pf-pre">{app.message}</p>}

            {creds ? (
                <div className="pf-callout pf-mt">
                    <p className="pf-field-value pf-mb">School provisioned ✓ — share these credentials:</p>
                    <Field label="Login URL" value={creds.login_url} />
                    <Field label="Admin email" value={creds.admin_email} />
                    <Field label="Temporary password" value={creds.temp_password} />
                    <p className="pf-hint">The school should change this password on first sign-in.</p>
                </div>
            ) : app.status === 'pending' || app.status === 'approved' ? (
                <label className="pf-field pf-mt">
                    <span className="pf-field-label">Review notes</span>
                    <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
                </label>
            ) : app.status === 'rejected' ? (
                <p className="platform-muted pf-mt">This application was rejected.</p>
            ) : null}
        </Modal>
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
                                        <td>{a.contact_name}<div className="platform-muted pf-subtle">{a.contact_email}</div></td>
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
