import { useEffect, useRef, useState } from 'react'

/* Shared by the timetable and the attendance record, which use the same
   toolbar and so must answer to the same keys and remember choices the same
   way. */

export function useStoredState(key, fallback, isValid) {
    const [value, setValue] = useState(() => {
        try {
            const raw = localStorage.getItem(key)
            if (raw !== null) {
                const parsed = JSON.parse(raw)
                if (isValid(parsed)) return parsed
            }
        } catch { /* storage blocked or a stale value: the default is fine */ }
        return fallback
    })
    function update(next) {
        setValue(next)
        try { localStorage.setItem(key, JSON.stringify(next)) }
        catch { /* storage blocked: the choice still holds for this visit */ }
    }
    return [value, update]
}

/**
 * Google Calendar's single-key shortcuts: D / W / A switch view, T is today,
 * N or J next, P or K previous.
 *
 * Stands down whenever the key clearly belongs to something else — typing in a
 * field, a modifier held (Ctrl+P is print), or a <dialog> open, which is how
 * the DOS edit form is shown and which must not have the week move behind it.
 */
export function useCalendarShortcuts(enabled, handlers) {
    const latest = useRef(handlers)
    useEffect(() => { latest.current = handlers })

    useEffect(() => {
        if (!enabled) return
        function onKey(e) {
            if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
            const el = e.target
            if (el instanceof HTMLElement
                && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
            if (document.querySelector('dialog[open]')) return
            const run = latest.current[e.key.toLowerCase()]
            if (!run) return
            e.preventDefault()
            run()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [enabled])
}
