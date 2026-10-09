import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

export function Select({ value, onChange, options, placeholder = 'Select...', style }) {
    const [open, setOpen] = useState(false)
    const [rect, setRect] = useState(null)
    const [portalTarget, setPortalTarget] = useState(null)
    const ref = useRef(null)
    const triggerRef = useRef(null)
    const listRef = useRef(null)

    const selected = options.find(o => String(o.value) === String(value))

    function updateRect() {
        if (ref.current) setRect(ref.current.getBoundingClientRect())
    }

    // Inside a native <dialog> opened with showModal(), ancestors like .tt-modal-inner
    // and .tt-modal-body use `overflow: hidden` / `overflow-y: auto` — this clips any
    // absolutely-positioned descendant regardless of z-index. Portaling the dropdown
    // directly into the <dialog> (a sibling of those clipping containers, not inside
    // them) escapes the clip. Falls back to document.body when there's no dialog
    // ancestor (i.e. the Select isn't inside a modal). Refs are read here, in an
    // effect, rather than during render.
    useLayoutEffect(() => {
        if (open) {
            updateRect()
            setPortalTarget(ref.current?.closest('dialog') || document.body)
        }
    }, [open])

    useEffect(() => {
        function handleOutsideClick(e) {
            if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.cs-list')) setOpen(false)
        }
        function handleReposition() {
            if (open) updateRect()
        }
        document.addEventListener('mousedown', handleOutsideClick)
        window.addEventListener('resize', handleReposition)
        window.addEventListener('scroll', handleReposition, true)
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick)
            window.removeEventListener('resize', handleReposition)
            window.removeEventListener('scroll', handleReposition, true)
        }
    }, [open])

    // Keyboard: opening moves focus to the chosen option; arrows, Home and End
    // move between options, Enter or Space picks, Escape closes and hands focus
    // back to the trigger.
    useEffect(() => {
        if (!open || !portalTarget) return
        const items = listRef.current?.querySelectorAll('[role="option"]')
        if (!items?.length) return
        const chosen = listRef.current.querySelector('[aria-selected="true"]')
        ;(chosen || items[0]).focus()
    }, [open, portalTarget])

    function close(returnFocus) {
        setOpen(false)
        if (returnFocus) triggerRef.current?.focus()
    }

    function pick(o) {
        onChange(o.value)
        close(true)
    }

    function handleListKey(e) {
        const items = [...listRef.current.querySelectorAll('[role="option"]')]
        const at = items.indexOf(document.activeElement)
        const go = i => { e.preventDefault(); items[(i + items.length) % items.length]?.focus() }
        if (e.key === 'ArrowDown') go(at + 1)
        else if (e.key === 'ArrowUp') go(at - 1)
        else if (e.key === 'Home') go(0)
        else if (e.key === 'End') go(items.length - 1)
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true) }
        else if (e.key === 'Tab') close(false)
        else if ((e.key === 'Enter' || e.key === ' ') && at >= 0) { e.preventDefault(); pick(options[at]) }
    }

    return (
        <div className="cs-wrap" ref={ref} style={style}>
            <button type="button" className="cs-trigger form-input" ref={triggerRef}
                aria-haspopup="listbox" aria-expanded={open}
                onKeyDown={e => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) } }}
                onClick={() => setOpen(o => !o)}>
                <span>{selected ? selected.label : placeholder}</span>
                <span className="material-symbols-rounded icon-sm" aria-hidden="true">
                    {open ? 'expand_less' : 'expand_more'}
                </span>
            </button>
            {open && rect && portalTarget && createPortal(
                <ul
                    ref={listRef} role="listbox" onKeyDown={handleListKey}
                    className="cs-list cs-list--portal"
                    style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, minWidth: rect.width }}
                >
                    {options.map(o => (
                        <li
                            key={o.value}
                            className={`cs-item${String(o.value) === String(value) ? ' cs-item--selected' : ''}`}
                            role="option" tabIndex={-1}
                            aria-selected={String(o.value) === String(value)}
                            onClick={() => pick(o)}
                        >
                            {o.label}
                        </li>
                    ))}
                </ul>,
                portalTarget
            )}
        </div>
    )
}
