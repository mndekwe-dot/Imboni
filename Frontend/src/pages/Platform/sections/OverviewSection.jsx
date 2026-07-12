import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { StatCard } from '../../../components/layout/StatCard'
import { getPlatformSummary } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function OverviewSection() {
    const navigate = useNavigate()
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

    const go = (to) => () => navigate(to)

    return (
        <>
            <p className="platform-section-title">Money in</p>
            <div className="platform-cards">
                <div className="clickable-wrap" onClick={go('/platform/revenue')} style={{ cursor: 'pointer' }}>
                    <StatCard icon="account_balance" value={money(sum.revenue.total)} label="Total revenue"
                              trend={`${sum.revenue.payments_count} payment(s)`} colorClass="success" />
                </div>
                <StatCard icon="trending_up" value={money(sum.revenue.this_month)} label="Received this month" colorClass="success" />
            </div>

            <p className="platform-section-title">Money out</p>
            <div className="platform-cards">
                <div onClick={go('/platform/expenses')} style={{ cursor: 'pointer' }}>
                    <StatCard icon="request_quote" value={money(sum.expenses.due_total)} label="Bills due" />
                </div>
                <div onClick={go('/platform/expenses')} style={{ cursor: 'pointer' }}>
                    <StatCard icon="warning" value={sum.expenses.overdue_count} label="Overdue"
                              trend={money(sum.expenses.overdue_total)} colorClass={sum.expenses.overdue_count ? 'red' : ''} />
                </div>
                <div onClick={go('/platform/expenses')} style={{ cursor: 'pointer' }}>
                    <StatCard icon="event_upcoming" value={sum.expenses.upcoming_30d_count} label="Due in 30 days" colorClass="info" />
                </div>
            </div>

            <p className="platform-section-title">Support</p>
            <div className="platform-cards">
                <div onClick={go('/platform/support')} style={{ cursor: 'pointer' }}>
                    <StatCard icon="support_agent" value={sum.tickets.unresolved} label="Open tickets"
                              trend={`${sum.tickets.open} new · ${sum.tickets.in_progress} in progress`}
                              colorClass={sum.tickets.unresolved ? 'warning' : ''} />
                </div>
            </div>
        </>
    )
}
