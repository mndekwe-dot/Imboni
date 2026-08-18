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
 *   <SkeletonTable rows={5} cols={4} />
 *   <SkeletonStats count={4} />       the stat-card strip on dashboards
 *   <SkeletonCard />                  a single panel
 */

function Announce({ label }) {
    const { t } = useTranslation()
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

export function SkeletonCard({ lines = 4, label }) {
    return (
        <div className="skel-card">
            <Announce label={label} />
            <Bar className="skel-line" width="35%" />
            {Array.from({ length: lines }, (_, i) => (
                <Bar key={i} className="skel-line" width={i === lines - 1 ? '55%' : '100%'} />
            ))}
        </div>
    )
}
