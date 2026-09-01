import { useCallback, useEffect, useState } from 'react'
import { getAuditLog } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

// The verbs worth filtering by, in the order an operator would look for them.
const FILTERS = [
    { key: '',            label: 'Everything' },
    { key: 'school',      label: 'Schools' },
    { key: 'application', label: 'Applications' },
    { key: 'contract',    label: 'Contracts' },
    { key: 'payment',     label: 'Payments' },
    { key: 'ticket',      label: 'Support' },
    { key: 'operator',    label: 'Operators' },
]

// A verb reads better than a dotted key in a table an operator scans.
const ACTION_LABELS = {
    'school.suspend': 'Suspended a school',
    'school.restrict': 'Made a school read-only',
    'school.reactivate': 'Reactivated a school',
    'school.auto_suspend': 'Suspended automatically (contract expired)',
    'school.auto_restrict': 'Made read-only automatically (contract in grace)',
    'school.demo_expired': 'Demo expired',
    'school.invitation_accepted': 'A school accepted its invitation',
    'application.approved': 'Approved an application',
    'application.rejected': 'Rejected an application',
    'application.provision': 'Provisioned a school',
    'application.resend_invitation': 'Re-sent an invitation',
    'contract.sign': 'Signed a contract',
    'contract.terminate': 'Terminated a contract',
    'contract.renew': 'Renewed a contract',
    'contract.create': 'Drafted a contract',
    'payment.create': 'Recorded a payment',
    'payment.delete': 'Removed a payment',
    'expense.create': 'Recorded a bill',
    'ticket.reply': 'Replied to a ticket',
    'ticket.set_status': 'Changed a ticket status',
    'operator.login': 'Signed in',
    'operator.create': 'Added an operator',
    'operator.update': 'Changed an operator',
    'operator.mfa_enabled': 'Turned on two-factor',
    'operator.mfa_failed': 'Failed a two-factor code',
    'operator.reset_mfa': 'Reset an operator two-factor',
}

function describeChanges(changes) {
    if (!changes || !Object.keys(changes).length) return ''
    return Object.entries(changes)
        .map(([field, value]) => (Array.isArray(value)
            ? `${field}: ${value[0]} → ${value[1]}`
            : `${field}: ${value}`))
        .join(' · ')
}

/**
 * Who did what, above the schools.
 *
 * Read-only, and open to every operator including support: an audit trail only
 * the powerful can inspect is not accountability. Entries with no actor were
 * written by the nightly job rather than a person, and say so.
 */
export function ActivitySection() {
    const toast = useToast()
    const [entries, setEntries] = useState([])
    const [filter, setFilter] = useState('')
    const [loading, setLoading] = useState(true)

    const load = useCallback(async (action) => {
        setLoading(true)
        try {
            setEntries(await getAuditLog(action ? { action } : null))
        } catch (e) {
            toast.error(errorMessage(e, 'Could not load the activity log.'))
        } finally {
            setLoading(false)
        }
    }, [toast])

    useEffect(() => { load(filter) }, [load, filter])

    return (
        <div className="card">
            <div className="card-content">
                <div className="platform-panel-head">
                    <h2>Activity</h2>
                    <span className="platform-muted">{entries.length} recent</span>
                </div>

                <div className="filter-tabs-bar filter-tabs-bar--spaced">
                    {FILTERS.map(f => (
                        <button key={f.key || 'all'}
                                className={`filter-tab ${filter === f.key ? 'active' : ''}`}
                                onClick={() => setFilter(f.key)}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <p className="platform-muted">Loading…</p>
                ) : entries.length === 0 ? (
                    <p className="platform-muted">
                        Nothing recorded yet. Operator actions appear here as they happen.
                    </p>
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr><th>When</th><th>Who</th><th>What</th><th>School</th><th>Detail</th></tr>
                            </thead>
                            <tbody>
                                {entries.map(entry => (
                                    <tr key={entry.id}>
                                        <td>{new Date(entry.created_at).toLocaleString()}</td>
                                        <td>
                                            {entry.actor_email
                                                ? <span className="platform-strong">{entry.actor_email}</span>
                                                : <span className="platform-muted">Imboni (automatic)</span>}
                                            {entry.actor_role && (
                                                <span className="platform-chip platform-chip-info pf-ml">
                                                    {entry.actor_role}
                                                </span>
                                            )}
                                        </td>
                                        <td>{ACTION_LABELS[entry.action] || entry.action}</td>
                                        <td>{entry.school_name || entry.target_label || '-'}</td>
                                        <td className="platform-muted">{describeChanges(entry.changes)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
