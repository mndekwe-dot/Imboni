import '../../styles/tables.css'

/**
 * ListSection — the bounded frame a list of things sits in.
 *
 * A titled, counted container with a body: the same frame <DataTable> draws,
 * available to anything that is NOT a table. That is the whole point of it.
 * A card grid rendered straight onto the page background and a table rendered
 * inside `.dt-container` read as two different pages even when they are two
 * halves of one tab, because one of them has an edge and the other does not.
 *
 * It deliberately reuses DataTable's `dt-` classes rather than defining a
 * second set. `.act-list-card` in discipline.css WAS that second set — the
 * same five elements at a different padding and shadow — so a grid section
 * and a table section were built to look alike and slowly stopped.
 *
 * Props:
 *   title       {node}    Section heading. Rendered as <h2>.
 *   icon        {string}  Optional Material symbol beside the title.
 *   count       {node}    Optional right-aligned count ("12 clubs").
 *   headerRight {node}    Optional controls right of the count.
 *   pad         {bool}    Pad the body (default true). A table sets its own.
 */
export function ListSection({ title, icon, count, headerRight, pad = true, className = '', children, ...rest }) {
    return (
        // className is merged, not spread through `rest`: a caller passing one
        // for spacing would otherwise replace `dt-container` and lose the frame.
        <section className={`dt-container${className ? ` ${className}` : ''}`} {...rest}>
            <div className="dt-header">
                <h2 className="dt-title">
                    {icon && <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>}
                    {title}
                </h2>
                {(count != null || headerRight) && (
                    <div className="dt-header-right">
                        {count != null && <span className="dt-count">{count}</span>}
                        {headerRight}
                    </div>
                )}
            </div>
            <div className={`dt-body${pad ? ' dt-body-pad' : ''}`}>
                {children}
            </div>
        </section>
    )
}
