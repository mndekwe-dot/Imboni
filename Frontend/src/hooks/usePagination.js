import { useState } from 'react'

/**
 * Client-side pagination over a list that is already loaded and filtered.
 *
 * For feeds whose stat cards count the WHOLE list (announcements: total,
 * urgent, events), so the page cannot ask the server for one page at a time
 * without those numbers going wrong.
 *
 *   const { pageItems, ...bar } = usePagination(visible, { pageSize: 10, resetKey: chip, scrollRef })
 *   {pageItems.map(...)}
 *   <PaginationBar {...bar} summary={...} />
 *
 * `resetKey` — change it (the active filter, the search text) and the list
 * returns to page 1. Held beside the page in state and compared on render,
 * rather than reset in an effect, so there is no frame showing page 3 of a
 * list that now has one page.
 *
 * `scrollRef` — the top of the list. A pager sits under the last item, so
 * without this "next" swaps the content and leaves you at the bottom of it.
 */
export function usePagination(items, { pageSize = 10, resetKey, scrollRef } = {}) {
    const [state, setState] = useState({ page: 1, key: resetKey })

    const totalCount = items.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const requested  = state.key === resetKey ? state.page : 1
    // Clamp too: deleting the last item on the last page must not strand the
    // reader on an empty page.
    const page = Math.min(Math.max(1, requested), totalPages)

    const pageItems = items.slice((page - 1) * pageSize, page * pageSize)

    function onPage(next) {
        setState({ page: next, key: resetKey })
        // block defaults to start. Not spelled out: the icon-subset scan reads any
        // quoted word that names an icon as one, and start is an icon name.
        scrollRef?.current?.scrollIntoView?.({ behavior: 'smooth' })
    }

    return { page, totalPages, totalCount, pageItems, onPage }
}
