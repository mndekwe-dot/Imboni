/**
 * PaginationBar — shared across portals.
 *
 * Lifted out of DosAttendance.jsx, where it was defined privately. DosResults
 * needed the same control and would otherwise have grown a second copy that
 * drifted from this one, which is how `.filter-tab` ended up declared three
 * times in three portal stylesheets.
 *
 * Renders nothing for a single page, so a caller can mount it unconditionally.
 *
 * Props:
 *   page       — current page, 1-based
 *   totalPages — total number of pages
 *   totalCount — total rows across all pages (shown in the summary)
 *   label      — plural noun for the rows, e.g. "results"
 *   onPage     — (nextPage) => void
 */
export function PaginationBar({ page, totalPages, totalCount, label, onPage }) {
    if (totalPages <= 1) return null

    const first = page === 1
    const last = page === totalPages

    return (
        <div className="pagination-bar">
            <span className="pagination-info">
                {totalCount} {label} (Page {page} of {totalPages})
            </span>
            <div className="pagination-controls">
                <button className="pagination-btn" disabled={first}
                    aria-label="First page" onClick={() => onPage(1)}>
                    <span className="material-symbols-rounded">first_page</span>
                </button>
                <button className="pagination-btn" disabled={first}
                    aria-label="Previous page" onClick={() => onPage(page - 1)}>
                    <span className="material-symbols-rounded">chevron_left</span>
                </button>
                <button className="pagination-btn" disabled={last}
                    aria-label="Next page" onClick={() => onPage(page + 1)}>
                    <span className="material-symbols-rounded">chevron_right</span>
                </button>
                <button className="pagination-btn" disabled={last}
                    aria-label="Last page" onClick={() => onPage(totalPages)}>
                    <span className="material-symbols-rounded">last_page</span>
                </button>
            </div>
        </div>
    )
}
