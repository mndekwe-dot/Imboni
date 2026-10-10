import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

/**
 * CommandPalette - jump to any page of the portal from the keyboard.
 *
 * Ctrl+K (Cmd+K on a Mac) or the search button in the header opens it; type a
 * few letters of a page's name, arrow to it, Enter. It searches the same
 * navigation the sidebar shows, so it can never offer a page this person's role
 * or school plan does not have, and a new nav item appears here for free.
 *
 * Deliberately only a navigator. Searching for people or records would mean a
 * new endpoint per portal and a new way to leak one school's names to another
 * role; the nav list is already filtered to what this person may open.
 */

/* Letters in order, not necessarily touching: "stu" finds "Students", "sdt" too. */
function matches(label, query) {
    if (!query) return true
    const text = label.toLowerCase()
    const q = query.toLowerCase().trim()
    if (text.includes(q)) return true
    let at = 0
    for (const ch of q.replace(/\s+/g, '')) {
        at = text.indexOf(ch, at)
        if (at === -1) return false
        at += 1
    }
    return true
}

export function CommandPalette({ items }) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [active, setActive] = useState(0)
    const inputRef = useRef(null)
    const returnFocus = useRef(null)

    const close = useCallback(() => {
        setOpen(false)
        setQuery('')
        setActive(0)
        returnFocus.current?.focus?.()
    }, [])

    const show = useCallback(() => {
        returnFocus.current = document.activeElement
        setOpen(true)
    }, [])

    useEffect(() => {
        const onKey = e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setOpen(o => {
                    if (!o) returnFocus.current = document.activeElement
                    return !o
                })
            }
        }
        document.addEventListener('keydown', onKey)
        document.addEventListener('imboni:open-palette', show)
        return () => {
            document.removeEventListener('keydown', onKey)
            document.removeEventListener('imboni:open-palette', show)
        }
    }, [show])

    useEffect(() => {
        if (open) inputRef.current?.focus()
    }, [open])

    const entries = useMemo(
        () => items
            .filter(i => i.to)
            .map(i => ({ ...i, text: i.label ?? t(i.labelKey) })),
        [items, t],
    )
    const results = useMemo(() => entries.filter(e => matches(e.text, query)), [entries, query])
    const current = Math.min(active, Math.max(results.length - 1, 0))

    if (!open) return null

    function go(entry) {
        close()
        navigate(entry.to)
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault()
            close()
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive(Math.min(current + 1, results.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive(Math.max(current - 1, 0))
        } else if (e.key === 'Enter' && results[current]) {
            e.preventDefault()
            go(results[current])
        }
    }

    return (
        <div className="palette-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
            <div className="palette" role="dialog" aria-modal="true" aria-label={t('common.palette.title')}
                onKeyDown={onKeyDown}>
                <div className="palette-search">
                    <span className="material-symbols-rounded" aria-hidden="true">search</span>
                    <input
                        ref={inputRef}
                        className="palette-input"
                        type="text"
                        role="combobox"
                        aria-expanded="true"
                        aria-controls="palette-results"
                        aria-activedescendant={results[current] ? `palette-opt-${current}` : undefined}
                        placeholder={t('common.palette.placeholder')}
                        value={query}
                        onChange={e => { setQuery(e.target.value); setActive(0) }}
                    />
                    <kbd className="palette-kbd">Esc</kbd>
                </div>
                <ul className="palette-results" id="palette-results" role="listbox">
                    {results.length === 0 && (
                        <li className="palette-empty" role="presentation">{t('common.palette.noResults')}</li>
                    )}
                    {results.map((entry, i) => (
                        <li key={entry.to} id={`palette-opt-${i}`} role="option" aria-selected={i === current}
                            className={`palette-item${i === current ? ' active' : ''}`}
                            onMouseEnter={() => setActive(i)}
                            onMouseDown={e => { e.preventDefault(); go(entry) }}>
                            <span className="material-symbols-rounded" aria-hidden="true">{entry.icon}</span>
                            <span>{entry.text}</span>
                        </li>
                    ))}
                </ul>
                <div className="palette-hint">{t('common.palette.hint')}</div>
            </div>
        </div>
    )
}
