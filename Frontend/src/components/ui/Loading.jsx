import '../../styles/loading.css'

/**
 * Loading — shared spinner + label, used in place of the scattered
 * <p>Loading...</p> placeholders throughout the app.
 *
 * Props:
 *   label    — text under the spinner (default: 'Loading...')
 *   fullPage — if true, fills the viewport height (for whole-page loads);
 *              otherwise just centers within its parent (for cards/panels)
 */
export function Loading({ label = 'Loading...', fullPage = false }) {
    return (
        <div className={`loading-wrap${fullPage ? ' loading-wrap--full' : ''}`}>
            <div className="loading-spinner" />
            <p className="loading-label">{label}</p>
        </div>
    )
}
