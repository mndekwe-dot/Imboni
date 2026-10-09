import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { StatCard } from '../../../components/layout/StatCard'
import { getPlatformSummary } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { asButton } from '../../../utils/a11y'

const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function OverviewSection() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const toast = useToast()
    const [sum, setSum] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let alive = true
        getPlatformSummary()
            .then(d => { if (alive) setSum(d) })
            .catch(e => { if (alive) toast.error(errorMessage(e, t('platform.overview.loadFailed'))) })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [toast, t])

    if (loading) return <p className="platform-muted">{t('platform.overview.loading')}</p>
    if (!sum) return null

    const go = (to) => () => navigate(to)

    return (
        <>
            <p className="platform-section-title">{t('platform.overview.moneyIn')}</p>
            <div className="platform-cards">
                <div {...asButton(go('/platform/revenue'))} className="pf-clickable">
                    <StatCard icon="account_balance" value={money(sum.revenue.total)} label={t('platform.overview.totalRevenue')}
                              trend={t('platform.overview.payments', { count: sum.revenue.payments_count })} colorClass="success" />
                </div>
                <StatCard icon="trending_up" value={money(sum.revenue.this_month)} label={t('platform.overview.receivedMonth')} colorClass="success" />
            </div>

            <p className="platform-section-title">{t('platform.overview.moneyOut')}</p>
            <div className="platform-cards">
                <div {...asButton(go('/platform/expenses'))} className="pf-clickable">
                    <StatCard icon="request_quote" value={money(sum.expenses.due_total)} label={t('platform.overview.billsDue')} />
                </div>
                <div {...asButton(go('/platform/expenses'))} className="pf-clickable">
                    <StatCard icon="warning" value={sum.expenses.overdue_count} label={t('platform.overview.overdue')}
                              trend={money(sum.expenses.overdue_total)} colorClass={sum.expenses.overdue_count ? 'red' : ''} />
                </div>
                <div {...asButton(go('/platform/expenses'))} className="pf-clickable">
                    <StatCard icon="event_upcoming" value={sum.expenses.upcoming_30d_count} label={t('platform.overview.due30')} colorClass="info" />
                </div>
            </div>

            <p className="platform-section-title">{t('platform.overview.support')}</p>
            <div className="platform-cards">
                <div {...asButton(go('/platform/support'))} className="pf-clickable">
                    <StatCard icon="support_agent" value={sum.tickets.unresolved} label={t('platform.overview.openTickets')}
                              trend={t('platform.overview.ticketTrend', { open: sum.tickets.open, progress: sum.tickets.in_progress })}
                              colorClass={sum.tickets.unresolved ? 'warning' : ''} />
                </div>
            </div>
        </>
    )
}
