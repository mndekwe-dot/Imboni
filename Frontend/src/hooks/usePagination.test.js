import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePagination } from './usePagination'

const items = Array.from({ length: 23 }, (_, i) => i + 1)

describe('usePagination', () => {
    it('slices the list into pages and counts them', () => {
        const { result } = renderHook(() => usePagination(items, { pageSize: 10 }))
        expect(result.current.totalPages).toBe(3)
        expect(result.current.totalCount).toBe(23)
        expect(result.current.pageItems).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

        act(() => result.current.onPage(3))
        expect(result.current.page).toBe(3)
        expect(result.current.pageItems).toEqual([21, 22, 23])
    })

    it('goes back to page 1 when the filter changes', () => {
        const { result, rerender } = renderHook(
            ({ key }) => usePagination(items, { pageSize: 10, resetKey: key }),
            { initialProps: { key: 'All' } },
        )
        act(() => result.current.onPage(2))
        expect(result.current.page).toBe(2)

        rerender({ key: 'Urgent' })
        expect(result.current.page).toBe(1)
    })

    it('never strands the reader on a page that no longer exists', () => {
        const { result, rerender } = renderHook(
            ({ list }) => usePagination(list, { pageSize: 10 }),
            { initialProps: { list: items } },
        )
        act(() => result.current.onPage(3))
        rerender({ list: items.slice(0, 12) })      // last page's items deleted
        expect(result.current.page).toBe(2)
        expect(result.current.pageItems).toEqual([11, 12])
    })

    it('scrolls the list back into view on a page change', () => {
        let scrolled = false
        const scrollRef = { current: { scrollIntoView: () => { scrolled = true } } }
        const { result } = renderHook(() => usePagination(items, { pageSize: 10, scrollRef }))
        act(() => result.current.onPage(2))
        expect(scrolled).toBe(true)
    })

    it('is one empty page for an empty list', () => {
        const { result } = renderHook(() => usePagination([], { pageSize: 10 }))
        expect(result.current.totalPages).toBe(1)
        expect(result.current.page).toBe(1)
        expect(result.current.pageItems).toEqual([])
    })
})
