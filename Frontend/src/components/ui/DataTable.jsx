import { useState, useEffect } from 'react'
import '../../styles/tables.css'

/**
 * DataTable — reusable paginated table used across all portals.
 *
 * Props:
 *   title          {string}   Container heading
 *   data           {array}    Already-filtered data to paginate over
 *   columns        {array}    [{label}] for <thead>
 *   renderRow      {fn}       (item, index) => <tr key=...>
 *   pageSize       {number}   Rows per page (default 8)
 *   emptyIcon      {string}   Material symbol name for empty state
 *   emptyTitle     {string}
 *   emptyDesc      {string}
 *   onClearFilters {fn}       Called by "Clear Filters" button — omit to hide it
 *   headerRight    {node}     JSX rendered right of the title (buttons, badges)
 *   rowHeight      {number}   px per row for minHeight calc (default 68)
 */
export function DataTable({
    title,
    data = [],
    columns = [],
    renderRow,
    pageSize = 8,
    emptyIcon = 'table_rows',
    emptyTitle = 'No data found',
    emptyDesc = 'Try adjusting your filters.',
    onClearFilters,
    headerRight,
    rowHeight = 68,
}) {
    const [page, setPage] = useState(1)

    // Reset to page 1 when data length changes (filter applied externally)
    useEffect(() => { setPage(1) }, [data.length])

    const pageCount = Math.max(1, Math.ceil(data.length / pageSize))
    const safePage  = Math.min(page, pageCount)
    const paginated = data.slice((safePage - 1) * pageSize, safePage * pageSize)
    const bodyMinH  = pageSize * rowHeight

    const start = data.length === 0 ? 0 : (safePage - 1) * pageSize + 1
    const end   = Math.min(safePage * pageSize, data.length)

    function pages() {
        if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
        // Windowed: always show first, last, and 3 around current
        const set = new Set([1, pageCount, safePage - 1, safePage, safePage + 1].filter(p => p >= 1 && p <= pageCount))
        const sorted = [...set].sort((a, b) => a - b)
        const result = []
        for (let i = 0; i < sorted.length; i++) {
            if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('…')
            result.push(sorted[i])
        }
        return result
    }

    return (
        <div className="dt-container">

            {/* Header */}
            <div className="dt-header">
                <span className="dt-title">{title}</span>
                <div className="dt-header-right">
                    {data.length > 0 && (
                        <span className="dt-count">
                            {data.length <= pageSize
                                ? `${data.length} row${data.length !== 1 ? 's' : ''}`
                                : `${start}–${end} of ${data.length}`}
                        </span>
                    )}
                    {headerRight}
                </div>
            </div>

            {/* Body — always present, fixed minHeight */}
            <div className="dt-body" style={{ minHeight: bodyMinH }}>
                {data.length === 0 ? (
                    <div className="dt-empty" style={{ minHeight: bodyMinH }}>
                        <span className="material-symbols-rounded">{emptyIcon}</span>
                        <p className="dt-empty-title">{emptyTitle}</p>
                        <p className="dt-empty-desc">{emptyDesc}</p>
                        {onClearFilters && (
                            <button className="btn btn-outline btn-sm" onClick={onClearFilters}>
                                <span className="material-symbols-rounded icon-sm">close</span>
                                Clear Filters
                            </button>
                        )}
                    </div>
                ) : (
                    <table className="dt-table">
                        <thead>
                            <tr>
                                {columns.map(col => (
                                    <th key={col.label ?? col}>{col.label ?? col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginated.map((item, i) => renderRow(item, (safePage - 1) * pageSize + i))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer — always present */}
            <div className="dt-footer">
                <span className="dt-page-info">
                    {data.length === 0 ? 'No results' : `Page ${safePage} of ${pageCount}`}
                </span>
                <div className="dt-pagination">
                    <button className="dt-page-btn" disabled={safePage <= 1} onClick={() => setPage(1)} title="First page">
                        <span className="material-symbols-rounded">first_page</span>
                    </button>
                    <button className="dt-page-btn" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} title="Previous">
                        <span className="material-symbols-rounded">chevron_left</span>
                    </button>
                    {pages().map((p, i) =>
                        p === '…'
                            ? <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>…</span>
                            : <button key={p} className={`dt-page-btn${p === safePage ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                    )}
                    <button className="dt-page-btn" disabled={safePage >= pageCount} onClick={() => setPage(p => p + 1)} title="Next">
                        <span className="material-symbols-rounded">chevron_right</span>
                    </button>
                    <button className="dt-page-btn" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)} title="Last page">
                        <span className="material-symbols-rounded">last_page</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
