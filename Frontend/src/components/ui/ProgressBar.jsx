import '../../styles/progress.css'

/**
 * ProgressBar - work in flight.
 *
 *   <ProgressBar value={42} label="Uploading photo" />     determinate
 *   <ProgressBar value={null} label="Preparing report" />  size unknown
 *
 * `value` is a percentage 0-100. `null`/`undefined` means "working, but I do
 * not know how far", which is also the honest state before the first byte moves
 * and for a download whose server never said how big it is.
 *
 * `tone`: 'primary' (default) | 'success' | 'error'. `size`: 'sm' | 'md' | 'lg'.
 * `active={false}` stops the moving highlight - used once a transfer is over.
 *
 * Exposed as a progress bar with its value, so assistive tech announces it the
 * way it announces a native <progress>.
 */
export function ProgressBar({ value = null, label, tone = 'primary', size = 'md', active = true }) {
    const known = typeof value === 'number' && Number.isFinite(value)
    const pct = known ? Math.min(100, Math.max(0, value)) : null

    const cls = [
        'pbar',
        size !== 'md' && `pbar-${size}`,
        tone !== 'primary' && `pbar-${tone}`,
        !known && 'pbar-indeterminate',
        known && active && 'pbar-active',
    ].filter(Boolean).join(' ')

    return (
        <div
            className={cls}
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={known ? Math.round(pct) : undefined}
        >
            <div className="pbar-fill" style={known ? { '--pbar-value': pct / 100 } : undefined} />
        </div>
    )
}
