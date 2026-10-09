import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { DashboardHeader } from './DashboardHeader'
import { DashboardContent } from './DashboardContent'
import { SkeletonPage } from '../ui/Skeleton'

/**
 * PageLoading - the dashboard shell with a page-shaped skeleton where the data
 * goes.
 *
 * Pages used to do `if (loading) return <Skeleton... />`, which returned INSTEAD
 * of the page: the sidebar and header disappeared, then the whole thing
 * reappeared at once. This keeps the chrome on screen so nothing moves when the
 * data lands and you can navigate away while it loads.
 *
 * It exists as a shell rather than as a `{loading ? ... }` inside each page
 * because the guard is doing double duty: several pages derive values from the
 * response between the guard and the render (`dashboard.stats.dormitory`,
 * `data.stats.calls_this_month`). Those run on null and throw if the early
 * return is simply removed. Returning early - but returning the shell - keeps
 * them skipped.
 *
 * `variant` says what shape the page has ('dashboard' | 'table' | 'settings').
 * The old PageSkeleton imitated each page's markup and drifted out of step with
 * it, and a skeleton that no longer matches reads as a broken page. These are
 * drawn from the same containers the real pages use (the stat grid, the data
 * table frame, the toolbar card), so they follow the real layout rather than
 * copying it. `stats` is how many tiles the page has (0 for none).
 */
export function PageLoading({ navItems, secondaryItems, title, subtitle, user = {}, variant = 'table', stats = 4 }) {
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
                        <SkeletonPage variant={variant} stats={stats} />
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
