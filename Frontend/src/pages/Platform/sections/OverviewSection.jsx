import { useState, useEffect } from 'react'
import { getPlatformSummary } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Tile({ icon, value, label, hint, tone, onClick }) {
    return (
        <div className={`platform-card ${tone ? `platform-card-${tone}` : ''} ${onClick ? 'platform-card-click' : ''}`}
             onClick={onClick} role={onClick ? 'button' : undefined}>
            <span className="material-symbols-rounded platform-card-icon">{icon}</span>
            <div>
                <div className="platform-card-value">{value}</div>
                <div className="platform-card-label">{label}</div>
                {hint && <div className="platform-card-hint">{hint}</div>}
            </div>
        </div>
    )
}

export function OverviewSection({ onNavigate }) {
    const toast = useToast()
    const [sum, setSum] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let alive = true
        getPlatformSummary()
            .then(d => { if (alive) setSum(d) })
            .catch(e => { if (alive) toast.error(errorMessage(e, 'Could not load the overview.')) })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [toast])

    if (loading) return <p className="platform-muted">Loading overview…</p>
    if (!sum) return null

    return (
        <>
            <h2 className="platform-section-title">Money in</h2>
            <div className="platform-cards">
                <Tile icon="account_balance" value={money(sum.revenue.total)} label="Total revenue"
                      hint={`${sum.revenue.payments_count} payment(s)`} tone="ok" onClick={() => onNavigate('revenue')} />
                <Tile icon="trending_up" value={money(sum.revenue.this_month)} label="This month" tone="ok" />
            </div>

            <h2 className="platform-section-title">Money out</h2>
            <div className="platform-cards">
                <Tile icon="request_quote" value={money(sum.expenses.due_total)} label="Bills due"
                      onClick={() => onNavigate('expenses')} />
                <Tile icon="warning" value={sum.expenses.overdue_count} label="Overdue"
                      hint={money(sum.expenses.overdue_total)} tone={sum.expenses.overdue_count ? 'bad' : undefined}
                      onClick={() => onNavigate('expenses')} />
                <Tile icon="event_upcoming" value={sum.expenses.upcoming_30d_count} label="Due in 30 days"
                      onClick={() => onNavigate('expenses')} />
            </div>

            <h2 className="platform-section-title">Support</h2>
            <div className="platform-cards">
                <Tile icon="support_agent" value={sum.tickets.unresolved} label="Open tickets"
                      hint={`${sum.tickets.open} new · ${sum.tickets.in_progress} in progress`}
                      tone={sum.tickets.unresolved ? 'warn' : undefined} onClick={() => onNavigate('tickets')} />
            </div>
        </>
    )
}
