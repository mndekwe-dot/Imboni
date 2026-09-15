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
 *
 * A value that is a word ("Excellent", "Needs Improvement") rather than a
 * figure takes the title size: at the 32px/800 of a headline number it filled
 * the tile, clipped, and outweighed every figure beside it. A long figure -
 * "1,490,000 RWF" - steps down to the display size for the same reason: four
 * of them in a row were cut off mid-currency on the finance dashboard.
 */
import { isValidElement } from 'react'

const FIGURE = /^[\s\d.,%+\-−–/:()]*[A-Z]{0,3}[+-]?[\s\d.,%]*$/

/*
 * The text a value will put on screen. Pages often pass an element - the
 * finance tiles pass <Money value="1490000" /> - and sizing only strings left
 * exactly those tiles at the full headline size, clipped at "1,490,000 RWI".
 * A component whose text is not in its children (Money formats a prop) says
 * what it renders through a static `statText(props)`.
 */
function textOf(node) {
    if (node == null || typeof node === 'boolean') return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(textOf).join('')
    if (isValidElement(node)) {
        return typeof node.type?.statText === 'function'
            ? node.type.statText(node.props)
            : textOf(node.props.children)
    }
    return ''
}

function sizeClass(node) {
    const value = textOf(node)
    if (value.length > 3 && !FIGURE.test(value)) return ' is-word'
    return value.length >= 10 ? ' is-long' : ''
}

export function StatCard({ icon, value, label, trend, trendClass = '', colorClass = '', className = '' }) {
    return (
        <div className={`portal-stat-card${colorClass ? ' ' + colorClass : ''}${className ? ' ' + className : ''}`}>
            <div className={`portal-stat-icon${colorClass ? ' ' + colorClass : ''}`}>
                <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>
            </div>
            <div className="portal-stat-body">
                <div className={`portal-stat-value${sizeClass(value)}`}>{value}</div>
                <div className="portal-stat-label">{label}</div>
                {trend && (
                    <div className={`portal-stat-trend${trendClass ? ' ' + trendClass : ''}`}>{trend}</div>
                )}
            </div>
        </div>
    )
}
