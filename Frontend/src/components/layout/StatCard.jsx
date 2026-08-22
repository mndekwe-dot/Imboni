/**
 * StatCard — shared across all portals.
 * Colour comes from --portal-accent / --portal-accent-light set per portal CSS.
 *
 * Props:
 *   icon        — Material Symbol name
 *   value       — headline number / text
 *   label       — short description
 *   trend       — optional sub-text
 *   trendClass  — 'positive' | 'negative' | ''
 *   colorClass  — 'success' | 'warning' | 'red' | 'info' | '' (default = portal accent)
 *   className   — one extra modifier for a page that needs a tweak. Reach for
 *                 this before copying the tile; nine copies of this markup is
 *                 how the portals drifted apart in the first place.
 */
export function StatCard({ icon, value, label, trend, trendClass = '', colorClass = '', className = '' }) {
    return (
        <div className={`portal-stat-card${colorClass ? ' ' + colorClass : ''}${className ? ' ' + className : ''}`}>
            <div className={`portal-stat-icon${colorClass ? ' ' + colorClass : ''}`}>
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div>
                <div className="portal-stat-value">{value}</div>
                <div className="portal-stat-label">{label}</div>
                {trend && (
                    <div className={`portal-stat-trend${trendClass ? ' ' + trendClass : ''}`}>{trend}</div>
                )}
            </div>
        </div>
    )
}
