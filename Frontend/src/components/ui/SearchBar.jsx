import { useRef } from 'react'
import '../../styles/tables.css'

/**
 * The one search field, for every portal.
 *
 * Two things it fixes over the hand-rolled `.toolbar-search` markup each page
 * had:
 *
 *  - Size. It was a 30px-tall strip of the toolbar. Search is the control
 *    people use most on a list page, so it is now a full-height field you can
 *    hit without aiming.
 *  - The focus state. `input:focus-visible` in index.css draws a 2px ring in
 *    `--primary`, and `.toolbar-search:focus-within` drew a second one on the
 *    wrapper — two rings in the portal's brand colour around one field, which
 *    on the matron portal is magenta and read as an error. The wrapper now
 *    owns the focus state and the inner input's own ring is suppressed: one
 *    indicator, still clearly visible to a keyboard user.
 *
 * Controlled only — the caller holds the query, because filtering is its job.
 * `onChange` is called on every keystroke: these lists filter in the browser,
 * so results update as you type with no request and no spinner.
 */
export function SearchBar({
    value,
    onChange,
    placeholder = 'Search…',
    label,
    className = '',
    autoFocus = false,
}) {
    const inputRef = useRef(null)

    function clear() {
        onChange('')
        inputRef.current?.focus()
    }

    return (
        <div className={`search-bar${className ? ' ' + className : ''}`}>
            <span className="material-symbols-rounded search-bar-icon" aria-hidden="true">search</span>
            <input
                ref={inputRef}
                type="search"
                className="search-bar-input"
                value={value}
                placeholder={placeholder}
                aria-label={label || placeholder}
                autoFocus={autoFocus}
                onChange={e => onChange(e.target.value)}
            />
            {value && (
                <button type="button" className="search-bar-clear" onClick={clear} aria-label="Clear search">
                    <span className="material-symbols-rounded" aria-hidden="true">close</span>
                </button>
            )}
        </div>
    )
}
