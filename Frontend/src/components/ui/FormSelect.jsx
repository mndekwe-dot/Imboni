import { useState, useRef, useEffect } from 'react'

/**
 * A select styled like the rest of the app's form controls.
 *
 * A native <select> cannot be styled to match the other inputs on every
 * browser, so this is a button plus a menu. It closes on an outside click and
 * keeps the same class names the form controls use, which is why it belongs
 * with the shared UI rather than beside any one page.
 */
export function FormSelect({ value, onChange, options, placeholder, disabled, id, ariaLabel }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
        function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])
    const selected = options.find(o => o.value === value)
    return (
        <div ref={ref} className="form-select-wrap">
            {/* The trigger takes the id so a <label htmlFor> reaches it — a
                label pointing at the wrapper named nothing focusable. */}
            <button
                type="button"
                id={id}
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
                className={`form-select-btn${selected ? ' has-value' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
            >
                <span>{selected ? selected.label : placeholder}</span>
                <span className="material-symbols-rounded">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div className="form-select-menu" role="listbox">
                    {options.map(opt => (
                        <button key={opt.value} type="button"
                            role="option"
                            aria-selected={value === opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false) }}
                            className={`form-select-opt${value === opt.value ? ' active' : ''}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
