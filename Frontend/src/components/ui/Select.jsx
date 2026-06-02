import { useState, useRef, useEffect } from 'react'

export function Select({ value, onChange, options, placeholder = 'Select...', style }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    const selected = options.find(o => String(o.value) === String(value))

    useEffect(() => {
        function handleOutsideClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handleOutsideClick)
        return () => document.removeEventListener('mousedown', handleOutsideClick)
    }, [])

    return (
        <div className="cs-wrap" ref={ref} style={style}>
            <button type="button" className="cs-trigger form-input" onClick={() => setOpen(o => !o)}>
                <span>{selected ? selected.label : placeholder}</span>
                <span className="material-symbols-rounded icon-sm">
                    {open ? 'expand_less' : 'expand_more'}
                </span>
            </button>
            {open && (
                <ul className="cs-list">
                    {options.map(o => (
                        <li
                            key={o.value}
                            className={`cs-item${String(o.value) === String(value) ? ' cs-item--selected' : ''}`}
                            onClick={() => { onChange(o.value); setOpen(false) }}
                        >
                            {o.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
