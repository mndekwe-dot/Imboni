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
import { formatAmount } from '../../utils/money'

export { formatAmount }

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

/** An amount with its currency. The digits come from `formatAmount` in utils/money. */
export function Money({ value, currency = 'RWF', className = '' }) {
    return (
        <span className={`fin-money ${className}`.trim()}>
            {formatAmount(value)} {currency}
        </span>
    )
}

/**
 * A fee category as people read it. The built-in ones are translated; one the
 * school added itself shows the name the school gave it.
 */
export function categoryName(t, code, name) {
    return t(`finance.categories.${code}`, { defaultValue: name || code })
}

/* What Money puts on screen, so a StatCard can size a tile holding one. */
Money.statText = ({ value, currency = 'RWF' }) => `${formatAmount(value)} ${currency}`
