import { useTranslation } from 'react-i18next'
import '../../styles/skeleton.css'

/**
 * Skeleton — placeholders shaped like the content that is loading.
 *
 * Replaces the spinner-and-label the app used to show. A spinner tells you
 * something is happening; a skeleton tells you what is coming and reserves
 * its space, so the page does not jump when the data lands.
 *
 * Accessibility: the shapes are decorative and hidden from assistive tech.
 * Losing the visible "Loading…" would otherwise leave a screen reader with
 * silence, so each block carries a live region announcing the wait instead.
 * Pass `label` where a more specific announcement helps.
 *
 * Pick the variant that matches what is arriving:
 *   <SkeletonText lines={3} />        paragraphs and prose
 *   <SkeletonList items={5} />        avatar + two lines, repeated
 *   <SkeletonTable rows={5} cols={4} />   a whole table, when the page has no table to keep
 *   <SkeletonRows rows={6} cols={5} />    <tr>s for a page's OWN <tbody>: keep the real
 *                                         <thead>, swap only the body. Columns then match by
 *                                         construction and cannot drift from the page.
 *   <SkeletonStats count={4} />       the stat-card strip on dashboards
 *   <SkeletonCard />                  a single panel
 */

function Announce({ label, quiet }) {
    const { t } = useTranslation()
    // `quiet` for a piece drawn inside a larger skeleton that already announces:
    // one live region per page, not one per panel.
    if (quiet) return null
    return <span className="sr-only" role="status" aria-live="polite">{label || t('common.loading')}</span>
}

function Bar({ width = '100%', height, className = '' }) {
    return <div className={`skel ${className}`} style={{ width, height }} aria-hidden="true" />
}

export function SkeletonText({ lines = 3, label }) {
    return (
        <div className="skel-page">
            <Announce label={label} />
            {Array.from({ length: lines }, (_, i) => (
                // The last line stops short, the way a real paragraph does.
                <Bar key={i} className="skel-line" width={i === lines - 1 ? '60%' : '100%'} />
            ))}
        </div>
    )
}

export function SkeletonList({ items = 4, label }) {
    return (
        <div className="skel-stack skel-page">
            <Announce label={label} />
            {Array.from({ length: items }, (_, i) => (
                <div className="skel-row" key={i}>
                    <Bar className="skel-avatar" />
                    <div className="skel-grow">
                        <Bar className="skel-line" width="45%" />
                        <Bar className="skel-line" width="75%" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export function SkeletonTable({ rows = 5, cols = 4, label }) {
    return (
        <div className="skel-page">
            <Announce label={label} />
            <table className="skel-table">
                <tbody>
                    {Array.from({ length: rows }, (_, r) => (
                        <tr key={r}>
                            {Array.from({ length: cols }, (_, c) => (
                                <td key={c}><Bar className="skel-line" width={c === 0 ? '80%' : '60%'} /></td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export function SkeletonStats({ count = 4, label }) {
    return (
        <div className="skel-stat-grid">
            <Announce label={label} />
            {Array.from({ length: count }, (_, i) => (
                <div className="skel-stat" key={i}>
                    <Bar className="skel-stat-icon" />
                    <div className="skel-grow">
                        <Bar className="skel-line" width="50%" />
                        <Bar className="skel-line" width="80%" />
                    </div>
                </div>
            ))}
        </div>
    )
}

export function SkeletonCard({ lines = 4, label, quiet = false }) {
    return (
        <div className="skel-card">
            <Announce label={label} quiet={quiet} />
            <Bar className="skel-line" width="35%" />
            {Array.from({ length: lines }, (_, i) => (
                <Bar key={i} className="skel-line" width={i === lines - 1 ? '55%' : '100%'} />
            ))}
        </div>
    )
}

/**
 * Rows for a table the page already renders. The caller keeps its own <table>
 * and <thead>, and puts this where the data rows go:
 *
 *   <tbody>{loading ? <SkeletonRows rows={6} cols={5} avatarFirst /> : rows}</tbody>
 *
 * `avatarFirst` gives the first cell the round avatar + name shape that people
 * tables use. The announcement lives in the first cell so there is one live
 * region per table, not one per row.
 */
export function SkeletonRows({ rows = 5, cols = 4, avatarFirst = false, label, quiet = false }) {
    const { t } = useTranslation()
    return Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="skel-tr">
            {Array.from({ length: cols }, (_, c) => (
                <td key={c}>
                    {r === 0 && c === 0 && !quiet && (
                        <span className="sr-only" role="status" aria-live="polite">{label || t('common.loading')}</span>
                    )}
                    {c === 0 && avatarFirst ? (
                        <div className="skel-cell-avatar" aria-hidden="true">
                            <div className="skel skel-avatar" />
                            <div className="skel skel-cell" style={{ width: '60%' }} />
                        </div>
                    ) : (
                        <div className="skel skel-cell" style={{ width: c === 0 ? '70%' : `${45 + ((r + c) % 3) * 15}%` }} aria-hidden="true" />
                    )}
                </td>
            ))}
        </tr>
    ))
}

/** A search box and a couple of filter pills: the bar above most tables. */
export function SkeletonToolbar() {
    return (
        <div className="skel-toolbar" aria-hidden="true">
            <div className="skel skel-search" />
            <div className="skel skel-pill" />
            <div className="skel skel-pill" />
        </div>
    )
}

/**
 * The real stat strip with bars where its figures will be: the same grid and the
 * same tile as StatCard, so it is the right size at every breakpoint without
 * keeping a second set of dimensions in step.
 */
export function SkeletonStatStrip({ count = 4, label }) {
    const { t } = useTranslation()
    return (
        <>
            <span className="sr-only" role="status" aria-live="polite">{label || t('common.loading')}</span>
            <div className="portal-stat-grid" aria-hidden="true">
                {Array.from({ length: count }, (_, i) => (
                    <div className="portal-stat-card is-loading" key={i}>
                        <div className="portal-stat-icon"><span className="skel skel-fill" /></div>
                        <div className="portal-stat-body">
                            <div className="skel skel-stat-value" />
                            <div className="skel skel-line skel-stat-label" />
                            <div className="skel skel-stat-trend" />
                        </div>
                    </div>
                ))}
            </div>
        </>
    )
}

/**
 * A table drawn inside the real DataTable frame (header bar, body, footer), with
 * a header row and skeleton rows. For page-level loading, where the page's own
 * column labels are not known yet; a page that has them passes `loading` to
 * DataTable itself and keeps its real headers.
 */
export function SkeletonDataTable({ rows = 8, cols = 5, avatarFirst = true }) {
    return (
        <div className="dt-container" aria-hidden="true">
            <div className="dt-header">
                <span className="dt-title"><span className="skel skel-title" /></span>
            </div>
            <div className="dt-body">
                <table className="dt-table">
                    <thead>
                        <tr>
                            {Array.from({ length: cols }, (_, c) => (
                                <th key={c}><span className="skel skel-th" /></th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <SkeletonRows rows={rows} cols={cols} avatarFirst={avatarFirst} quiet />
                    </tbody>
                </table>
            </div>
            <div className="dt-footer"><span className="skel skel-th" /></div>
        </div>
    )
}

/**
 * What a whole page looks like while its data loads, drawn from the same
 * containers the real page uses. Pick the one nearest the page:
 *
 *   dashboard   a stat strip, then two panels side by side
 *   table       a stat strip, a search/filter bar, then a table
 *   settings    a stack of panels
 */
export function SkeletonPage({ variant = 'table', stats = 4, label }) {
    const { t } = useTranslation()
    const announce = label || t('common.loading')
    return (
        <>
            {variant !== 'settings' && stats > 0 && <SkeletonStatStrip count={stats} label={announce} />}
            {variant === 'dashboard' && (
                <div className="cards-grid" aria-hidden="true">
                    <SkeletonCard lines={7} quiet />
                    <SkeletonCard lines={7} quiet />
                </div>
            )}
            {variant === 'table' && (
                <>
                    <div className="toolbar-card" aria-hidden="true"><SkeletonToolbar /></div>
                    <SkeletonDataTable />
                </>
            )}
            {variant === 'settings' && (
                <div className="skel-stack-lg" aria-hidden="true">
                    <span className="sr-only" role="status" aria-live="polite">{announce}</span>
                    <SkeletonCard lines={4} quiet />
                    <SkeletonCard lines={5} quiet />
                    <SkeletonCard lines={3} quiet />
                </div>
            )}
        </>
    )
}

/**
 * A bar chart's worth of loading: bars of uneven height on a baseline, in the
 * space the chart will take (200px) so the card does not change height when the
 * real one arrives.
 */
const CHART_HEIGHTS = [55, 80, 45, 90, 65, 75, 50, 85]
export function SkeletonChart({ bars = 7, label, quiet = false }) {
    return (
        <div className="skel-chart">
            <Announce label={label} quiet={quiet} />
            <div className="skel-chart-bars" aria-hidden="true">
                {Array.from({ length: bars }, (_, i) => (
                    <div key={i} className="skel skel-chart-bar" style={{ height: `${CHART_HEIGHTS[i % CHART_HEIGHTS.length]}%` }} />
                ))}
            </div>
        </div>
    )
}

/**
 * The Admin dashboard's "Recent activity" rows while they load: the same row,
 * icon square and text block as the real list (.adm-activity-*), so it is the
 * right size by construction.
 */
export function SkeletonActivity({ items = 5, label }) {
    return (
        <div aria-busy="true">
            <Announce label={label} />
            {Array.from({ length: items }, (_, i) => (
                <div className="adm-activity-item" key={i} aria-hidden="true">
                    <span className="skel adm-activity-icon" />
                    <div className="adm-activity-details">
                        <div className="skel skel-line" style={{ width: i % 2 ? '58%' : '74%' }} />
                        <div className="skel skel-line" style={{ width: '28%' }} />
                    </div>
                </div>
            ))}
        </div>
    )
}
