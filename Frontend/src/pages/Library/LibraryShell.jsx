import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { EmptyState } from '../../components/ui/EmptyState'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useLibraryFeature } from '../../hooks/useLibraryFeature'
import { librarianNavItems, librarianSecondaryItems } from './librarianNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/tables.css'
import '../../styles/library.css'

/**
 * The frame every librarian page sits in: rail, header, content — and the
 * plan gate.
 *
 * The gate lives HERE rather than in each page so a page cannot be added
 * without it. `enabled` is null while the answer is in flight, and null is
 * deliberately not treated as "no": telling a paying school to upgrade because
 * a request had not come back yet is worse than a moment of blank content.
 */
export function LibraryShell({ title, subtitle, actions, children }) {
    const { t } = useTranslation()
    const { notifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const { enabled, loading } = useLibraryFeature()

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={librarianNavItems} secondaryItems={librarianSecondaryItems} />
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
                            ? <LibraryNotInPlan />
                            : loading ? <p className="u-pad u-muted">{t('common.loading')}</p>
                                : children}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}

/**
 * What a school on Free or Basic sees.
 *
 * It names the plan and offers the one action that changes anything, rather
 * than a bare "access denied" — the school is not doing something wrong, they
 * have not bought this part yet.
 */
export function LibraryNotInPlan() {
    const { t } = useTranslation()
    return (
        <EmptyState
            icon="workspace_premium"
            title={t('library.upgrade.title')}
            description={t('library.upgrade.description')}
        >
            <Link to="/admin/settings?tab=billing" className="btn btn-primary">
                <span className="material-symbols-rounded icon-sm" aria-hidden="true">upgrade</span>
                {t('library.upgrade.action')}
            </Link>
        </EmptyState>
    )
}
