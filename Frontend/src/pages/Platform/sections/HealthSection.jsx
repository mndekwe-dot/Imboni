import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getPlatformHealth } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

function Component({ c }) {
    const { t } = useTranslation()
    return (
        <div className="card pf-health-comp">
            <div className="card-content">
                <span className={`material-symbols-rounded pf-health-icon ${c.ok ? 'ok' : 'bad'}`} aria-hidden="true">
                    {c.ok ? 'check_circle' : 'error'}
                </span>
                <div>
                    <div className="platform-strong">{c.name}</div>
                    <div className="platform-muted pf-subtle">{c.detail}</div>
                </div>
                <span className={`platform-chip platform-chip-${c.ok ? 'ok' : 'bad'} pf-right`}>
                    {c.ok ? t('platform.health.operational') : t('platform.health.down')}
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
    const { t } = useTranslation()
    const toast = useToast()
    const [h, setH] = useState(null)
    const [loading, setLoading] = useState(true)
    const m = key => t(`platform.health.${key}`)

    const load = useCallback(async () => {
        setLoading(true)
        try { setH(await getPlatformHealth()) }
        catch (e) { toast.error(errorMessage(e, t('platform.health.loadFailed'))) }
        finally { setLoading(false) }
    }, [toast, t])
    useEffect(() => { load() }, [load])

    if (loading) return <p className="platform-muted">{m('checking')}</p>
    if (!h) return null

    const a = h.attention

    return (
        <>
            <div className="platform-panel-head">
                <p className="platform-section-title">{m('infrastructure')}</p>
                <button className="btn btn-outline btn-sm" onClick={load}>{t('platform.common.refresh')}</button>
            </div>
            <div className="platform-cards">
                {h.components.map(c => <Component key={c.name} c={c} />)}
            </div>

            <p className="platform-section-title">{m('schools')}</p>
            <div className="platform-cards">
                <Metric label={m('total')} value={h.schools.total} />
                <Metric label={m('active')} value={h.schools.active} />
                <Metric label={m('trial')} value={h.schools.trial} />
                <Metric label={m('suspended')} value={h.schools.suspended} tone={h.schools.suspended ? 'warn' : ''} />
                <Metric label={m('pastDue')} value={h.schools.past_due} tone={h.schools.past_due ? 'warn' : ''} />
            </div>

            <p className="platform-section-title">{m('queue')}</p>
            <div className="platform-cards">
                <Metric label={m('pending')} value={h.provisioning.pending} tone={h.provisioning.pending ? 'warn' : ''} />
                <Metric label={m('failed')} value={h.provisioning.failed} tone={h.provisioning.failed ? 'bad' : ''} />
            </div>

            <p className="platform-section-title">{m('attention')}</p>
            <div className="platform-cards">
                <Metric label={m('applicationsPending')} value={a.applications_pending} tone={a.applications_pending ? 'warn' : ''} />
                <Metric label={m('expiring30')} value={a.contracts_expiring_30d} tone={a.contracts_expiring_30d ? 'warn' : ''} />
                <Metric label={m('inGrace')} value={a.contracts_in_grace} tone={a.contracts_in_grace ? 'bad' : ''} />
                <Metric label={m('billsOverdue')} value={a.bills_overdue} tone={a.bills_overdue ? 'bad' : ''} />
                <Metric label={m('ticketsUnresolved')} value={a.tickets_unresolved} tone={a.tickets_unresolved ? 'warn' : ''} />
            </div>
        </>
    )
}
