import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { SkeletonRows } from './Skeleton'
import '../../styles/tables.css'

/**
 * DataTable — reusable paginated table used across all portals.
 *
 * Props:
 *   title          {string}   Container heading
 *   icon           {string}   Material symbol beside the heading, as ListSection
 *                             takes one. The two draw the same frame, so a page
 *                             with a card grid above a table should not have to
 *                             lose the icon when it crosses from one to the other.
 *   data           {array}    Already-filtered data to paginate over
 *   columns        {array}    [{label, align}] — or plain strings — for <thead>.
 *                             align: 'right' for money and counts.
 *   renderRow      {fn}       (item, index) => <tr key=...>
 *   pageSize       {number}   Rows per page (default 8)
 *   emptyIcon      {string}   Material symbol name for empty state
 *   emptyTitle     {string}
 *   emptyDesc      {string}
 *   onClearFilters {fn}       Called by "Clear Filters" button — omit to hide it
 *   headerRight    {node}     JSX rendered right of the title (buttons, badges)
 *   rowHeight      {number}   px per row for minHeight calc (default 68)
 *
 * Loading:
 *   loading        {bool}     The rows have not arrived. The real header stays
 *                             and skeleton rows fill the body, so the columns are
 *                             right by construction and nothing moves when the
 *                             data lands.
 *   loadingLabel   {string}   What a screen reader announces meanwhile.
 *   skeletonAvatar {bool}     First column is a person: round avatar + name.
 *
 * Server paging (omit all three and the table pages `data` itself, as before):
 *   total          {number}   Rows on the server across ALL pages. Passing it
 *                             switches the table to server mode: `data` is then
 *                             just the CURRENT page, and nothing is sliced here.
 *   page           {number}   Current page, 1-based (controlled).
 *   onPageChange   {fn}       (page) => void
 */
export function DataTable({
    title,
    icon,
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
    loading = false,
    loadingLabel,
    skeletonAvatar = false,
    total,
    page = 1,
    onPageChange,
}) {
    const { t } = useTranslation()
    const serverPaged = typeof total === 'number'
    const [localPage, setLocalPage] = useState(1)
    // `page` is the caller's in server mode, ours otherwise.
    const current = serverPaged ? page : localPage
    const setPage = serverPaged ? (p => onPageChange?.(typeof p === 'function' ? p(page) : p)) : setLocalPage
    // Rows across every page: the server's count, or what we were handed.
    const count   = serverPaged ? total : data.length

    // Reset to page 1 when data length changes (filter applied externally).
    // Not in server mode: there the page is the caller's to control, and
    // `data.length` is the page size, which says nothing about a filter.
    useEffect(() => { if (!serverPaged) setLocalPage(1) }, [data.length, serverPaged])

    const pageCount = Math.max(1, Math.ceil(count / pageSize))
    const safePage  = Math.min(current, pageCount)
    const paginated = serverPaged ? data : data.slice((safePage - 1) * pageSize, safePage * pageSize)
    const bodyMinH  = pageSize * rowHeight

    const start = count === 0 ? 0 : (safePage - 1) * pageSize + 1
    const end   = Math.min(safePage * pageSize, count)

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
                <span className="dt-title">
                    {icon && (
                        <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>
                    )}
                    {title}
                </span>
                <div className="dt-header-right">
                    {!loading && count > 0 && (
                        <span className="dt-count">
                            {count <= pageSize
                                ? `${count} row${count !== 1 ? 's' : ''}`
                                : `${start}-${end} of ${count}`}
                        </span>
                    )}
                    {headerRight}
                </div>
            </div>

            {/* Body — always present, fixed minHeight */}
            <div className="dt-body" style={{ minHeight: bodyMinH }} aria-busy={loading || undefined}>
                {count === 0 && !loading ? (
                    <div className="dt-empty" style={{ minHeight: bodyMinH }}>
                        <span className="material-symbols-rounded" aria-hidden="true">{emptyIcon}</span>
                        <p className="dt-empty-title">{emptyTitle}</p>
                        <p className="dt-empty-desc">{emptyDesc}</p>
                        {onClearFilters && (
                            <button className="btn btn-outline btn-sm" onClick={onClearFilters}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">close</span>
                                {t('common.clearFilters')}
                            </button>
                        )}
                    </div>
                ) : (
                    <table className="dt-table">
                        <thead>
                            <tr>
                                {columns.map(col => (
                                    <th key={col.label ?? col}
                                        className={col.align === 'right' ? 'dt-num' : undefined}>
                                        {col.label ?? col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading
                                ? <SkeletonRows rows={pageSize} cols={columns.length || 1}
                                    avatarFirst={skeletonAvatar} label={loadingLabel} />
                                : paginated.map((item, i) => renderRow(item, (safePage - 1) * pageSize + i))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer — always present */}
            <div className="dt-footer">
                <span className="dt-page-info">
                    {loading ? '\u00a0' : count === 0 ? 'No results' : `Page ${safePage} of ${pageCount}`}
                </span>
                <div className="dt-pagination">
                    <button className="dt-page-btn" disabled={safePage <= 1} onClick={() => setPage(1)} title={t('common.firstPage')} aria-label={t('common.firstPage')}>
                        <span className="material-symbols-rounded" aria-hidden="true">first_page</span>
                    </button>
                    <button className="dt-page-btn" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} title={t('common.previous')} aria-label={t('common.previous')}>
                        <span className="material-symbols-rounded" aria-hidden="true">chevron_left</span>
                    </button>
                    {pages().map((p, i) =>
                        p === '…'
                            ? <span key={`ellipsis-`} className="dt-ellipsis">…</span>
                            : <button key={p} className={`dt-page-btn${p === safePage ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                    )}
                    <button className="dt-page-btn" disabled={safePage >= pageCount} onClick={() => setPage(p => p + 1)} title="Next" aria-label="Next">
                        <span className="material-symbols-rounded" aria-hidden="true">chevron_right</span>
                    </button>
                    <button className="dt-page-btn" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)} title={t('common.lastPage')} aria-label={t('common.lastPage')}>
                        <span className="material-symbols-rounded" aria-hidden="true">last_page</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
