import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

export function Select({ value, onChange, options, placeholder = 'Select...', style }) {
    const [open, setOpen] = useState(false)
    const [rect, setRect] = useState(null)
    const [portalTarget, setPortalTarget] = useState(null)
    const ref = useRef(null)

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

    return (
        <div className="cs-wrap" ref={ref} style={style}>
            <button type="button" className="cs-trigger form-input" onClick={() => setOpen(o => !o)}>
                <span>{selected ? selected.label : placeholder}</span>
                <span className="material-symbols-rounded icon-sm">
                    {open ? 'expand_less' : 'expand_more'}
                </span>
            </button>
            {open && rect && portalTarget && createPortal(
                <ul
                    className="cs-list cs-list--portal"
                    style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, minWidth: rect.width }}
                >
                    {options.map(o => (
                        <li
                            key={o.value}
                            className={`cs-item${String(o.value) === String(value) ? ' cs-item--selected' : ''}`}
                            onClick={() => { onChange(o.value); setOpen(false) }}
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
