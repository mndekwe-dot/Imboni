import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The older `.modal-overlay` / `.modal-box` modals, made behave like a dialog.
 *
 * Wrap the existing markup and nothing else changes: the box gets
 * `role="dialog"`, `aria-modal` and a name from its title; Escape and a click
 * outside close it; Tab stays inside; focus moves in on open and goes back to
 * the button that opened it. New modals should use the shared <Modal>, which
 * does the same with a native <dialog>.
 */
export function ModalOverlay({ onClose, children }) {
    const overlayRef = useRef(null)
    const closeRef = useRef(onClose)
    closeRef.current = onClose

    useEffect(() => {
        const overlay = overlayRef.current
        const box = overlay.querySelector('.modal-box') || overlay.firstElementChild
        const opener = document.activeElement

        if (box) {
            box.setAttribute('role', 'dialog')
            box.setAttribute('aria-modal', 'true')
            const title = box.querySelector('.modal-title, h1, h2, h3')
            if (title) {
                if (!title.id) title.id = `modal-title-${Math.random().toString(36).slice(2, 8)}`
                box.setAttribute('aria-labelledby', title.id)
            }
            // Respect an autoFocus that already put focus inside.
            if (!box.contains(document.activeElement)) {
                const first = box.querySelector(FOCUSABLE)
                if (first) first.focus()
                else { box.setAttribute('tabindex', '-1'); box.focus() }
            }
        }

        const onKey = e => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                closeRef.current?.()
                return
            }
            if (e.key !== 'Tab' || !box) return
            const items = [...box.querySelectorAll(FOCUSABLE)].filter(el => !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden')
            if (items.length === 0) { e.preventDefault(); return }
            const first = items[0], last = items[items.length - 1]
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
        }
        document.addEventListener('keydown', onKey, true)
        return () => {
            document.removeEventListener('keydown', onKey, true)
            if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus()
        }
    }, [])

    return (
        <div
            ref={overlayRef}
            className="modal-overlay"
            onClick={e => { if (e.target === e.currentTarget) closeRef.current?.() }}
        >
            {children}
        </div>
    )
}
