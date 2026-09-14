import { useTranslation } from 'react-i18next'

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
 *   summary    — optional, replaces "{totalCount} {label}". Pass an already
 *                pluralised string (`t('announcements.count', { count })`)
 *                where "1 announcements" would otherwise show up.
 *   onPage     — (nextPage) => void
 */
export function PaginationBar({ page, totalPages, totalCount, label, summary, onPage }) {
    const { t } = useTranslation()
    if (totalPages <= 1) return null

    const first = page === 1
    const last = page === totalPages

    return (
        <div className="pagination-bar">
            <span className="pagination-info">
                {summary ?? `${totalCount} ${label}`} ({t('common.pageOf', { page, total: totalPages })})
            </span>
            <div className="pagination-controls">
                <button type="button" className="pagination-btn" disabled={first}
                    aria-label={t('common.firstPage')} onClick={() => onPage(1)}>
                    <span className="material-symbols-rounded" aria-hidden="true">first_page</span>
                </button>
                <button type="button" className="pagination-btn" disabled={first}
                    aria-label={t('common.previousPage')} onClick={() => onPage(page - 1)}>
                    <span className="material-symbols-rounded" aria-hidden="true">chevron_left</span>
                </button>
                <button type="button" className="pagination-btn" disabled={last}
                    aria-label={t('common.nextPage')} onClick={() => onPage(page + 1)}>
                    <span className="material-symbols-rounded" aria-hidden="true">chevron_right</span>
                </button>
                <button type="button" className="pagination-btn" disabled={last}
                    aria-label={t('common.lastPage')} onClick={() => onPage(totalPages)}>
                    <span className="material-symbols-rounded" aria-hidden="true">last_page</span>
                </button>
            </div>
        </div>
    )
}
