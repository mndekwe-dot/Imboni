import { useState, useEffect, useCallback } from 'react'
import { getPlatformHealth } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

function Component({ c }) {
    return (
        <div className="card pf-health-comp">
            <div className="card-content">
                <span className={`material-symbols-rounded pf-health-icon ${c.ok ? 'ok' : 'bad'}`}>
                    {c.ok ? 'check_circle' : 'error'}
                </span>
                <div>
                    <div className="platform-strong">{c.name}</div>
                    <div className="platform-muted pf-subtle">{c.detail}</div>
                </div>
                <span className={`platform-chip platform-chip-${c.ok ? 'ok' : 'bad'} pf-right`}>
                    {c.ok ? 'Operational' : 'Down'}
                </span>
            </div>
        </div>
    )
}

function Metric({ label, value, tone }) {
    return (
        <div className="card">
            <div className="card-content">
                <div className={`pf-metric-value${tone ? ' ' + tone : ''}`}>{value}</div>
                <div className="pf-metric-label">{label}</div>
            </div>
        </div>
    )
}

export function HealthSection() {
    const toast = useToast()
    const [h, setH] = useState(null)
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try { setH(await getPlatformHealth()) }
        catch (e) { toast.error(errorMessage(e, 'Could not load health.')) }
        finally { setLoading(false) }
    }, [toast])
    useEffect(() => { load() }, [load])

    if (loading) return <p className="platform-muted">Checking health…</p>
    if (!h) return null

    const a = h.attention

    return (
        <>
            <div className="platform-panel-head">
                <p className="platform-section-title">Infrastructure</p>
                <button className="btn btn-outline btn-sm" onClick={load}>Refresh</button>
            </div>
            <div className="platform-cards">
                {h.components.map(c => <Component key={c.name} c={c} />)}
            </div>

            <p className="platform-section-title">Schools</p>
            <div className="platform-cards">
                <Metric label="Total" value={h.schools.total} />
                <Metric label="Active" value={h.schools.active} />
                <Metric label="Trial" value={h.schools.trial} />
                <Metric label="Suspended" value={h.schools.suspended} tone={h.schools.suspended ? 'warn' : ''} />
                <Metric label="Past due" value={h.schools.past_due} tone={h.schools.past_due ? 'warn' : ''} />
            </div>

            <p className="platform-section-title">Provisioning queue</p>
            <div className="platform-cards">
                <Metric label="Pending" value={h.provisioning.pending} tone={h.provisioning.pending ? 'warn' : ''} />
                <Metric label="Failed" value={h.provisioning.failed} tone={h.provisioning.failed ? 'bad' : ''} />
            </div>

            <p className="platform-section-title">Needs attention</p>
            <div className="platform-cards">
                <Metric label="Applications pending" value={a.applications_pending} tone={a.applications_pending ? 'warn' : ''} />
                <Metric label="Contracts expiring (30d)" value={a.contracts_expiring_30d} tone={a.contracts_expiring_30d ? 'warn' : ''} />
                <Metric label="Contracts in grace" value={a.contracts_in_grace} tone={a.contracts_in_grace ? 'bad' : ''} />
                <Metric label="Bills overdue" value={a.bills_overdue} tone={a.bills_overdue ? 'bad' : ''} />
                <Metric label="Tickets unresolved" value={a.tickets_unresolved} tone={a.tickets_unresolved ? 'warn' : ''} />
            </div>
        </>
    )
}
