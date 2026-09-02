import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { EmptyState } from '../../components/ui/EmptyState'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useFinanceFeature } from '../../hooks/useFinanceFeature'
import { bursarNavItems, bursarSecondaryItems } from './bursarNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/tables.css'
import '../../styles/finance.css'

/**
 * The frame every finance page sits in: rail, header, content — and the plan
 * gate.
 *
 * The gate lives here rather than in each page so a page cannot be added
 * without it, and `enabled` being null (still asking) is deliberately not
 * treated as "no".
 */
export function FinanceShell({ title, subtitle, actions, children }) {
    const { t } = useTranslation()
    const { notifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const { enabled, loading } = useFinanceFeature()

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={bursarNavItems} secondaryItems={bursarSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={title}
                        subtitle={subtitle}
                        actions={actions}
                        {...sessionUser}
                        notifications={notifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {enabled === false
                            ? <FinanceNotInPlan />
                            : loading ? <p className="u-pad u-muted">{t('common.loading')}</p>
                                : children}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}

export function FinanceNotInPlan() {
    const { t } = useTranslation()
    return (
        <EmptyState
            icon="workspace_premium"
            title={t('finance.upgrade.title')}
            description={t('finance.upgrade.description')}
        >
            <Link to="/admin/settings?tab=billing" className="btn btn-primary">
                <span className="material-symbols-rounded icon-sm" aria-hidden="true">upgrade</span>
                {t('finance.upgrade.action')}
            </Link>
        </EmptyState>
    )
}

/**
 * An amount, with its currency, right-aligned by the caller.
 *
 * One place formats money so a figure reads the same on the dashboard, the
 * receipt and the debtor list. `Intl` groups the thousands, which is the
 * difference between 1250000 and 1,250,000 at a glance.
 */
export function formatAmount(value) {
    const amount = Number(value ?? 0)
    return Number.isFinite(amount)
        ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount)
        : '0'
}

export function Money({ value, currency = 'RWF', className = '' }) {
    return (
        <span className={`fin-money ${className}`.trim()}>
            {formatAmount(value)} {currency}
        </span>
    )
}
