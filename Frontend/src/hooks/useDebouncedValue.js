import { useEffect, useState } from 'react'

/**
 * A value that follows `value` after it has stopped changing for `delay` ms.
 *
 * For search boxes that ask the server: without it, every keystroke is a
 * request, and the answers can arrive out of order. The typed text in the box
 * still updates instantly (that stays the raw state); only the value used to
 * query is held back.
 */
export function useDebouncedValue(value, delay = 300) {
    const [debounced, setDebounced] = useState(value)

    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(id)
    }, [value, delay])

    return debounced
}
