import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { DashboardHeader } from './DashboardHeader'
import { DashboardContent } from './DashboardContent'

/**
 * PageLoading — the dashboard shell with a spinner where the data goes.
 *
 * Pages used to do `if (loading) return <Skeleton… />`, which returned INSTEAD
 * of the page: the sidebar and header disappeared, then the whole thing
 * reappeared at once. This keeps the chrome on screen so nothing moves when the
 * data lands and you can navigate away while it loads.
 *
 * It exists as a shell rather than as a `{loading ? … }` inside each page
 * because the guard is doing double duty: several pages derive values from the
 * response between the guard and the render (`dashboard.stats.dormitory`,
 * `data.stats.calls_this_month`). Those run on null and throw if the early
 * return is simply removed. Returning early — but returning the shell — keeps
 * them skipped.
 *
 * This was PageSkeleton, which took skeleton children shaped like the page
 * underneath. Keeping thirteen of those in step with the layouts they imitated
 * was its own maintenance job, and a skeleton that no longer matches reads as a
 * broken page rather than a loading one. One spinner cannot fall out of date.
 * `Skeleton` itself is still there for the panels that use it directly.
 */
export function PageLoading({ navItems, secondaryItems, title, subtitle, user = {} }) {
    const { t } = useTranslation()
    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={navItems} secondaryItems={secondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title={title} subtitle={subtitle} {...user} notifications={[]} />
                    <DashboardContent>
                        {/* role="status" so a screen reader announces the wait
                            instead of reading an empty page. */}
                        <div className="route-fallback" role="status" aria-live="polite">
                            <div className="route-fallback-spinner" />
                            <span className="sr-only">{t('common.loading')}</span>
                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
