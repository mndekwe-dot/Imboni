import { useState, useEffect, useRef, useId } from 'react'
import { useTranslation } from 'react-i18next'
import '../../styles/components.css'

/**
 * Pick one student by typing their name.
 *
 * A school with a thousand students cannot be a <select>: the list is too long
 * to scroll, and shipping it to the browser to filter on the client means
 * sending the whole roll to every page that needs one name. So the typing goes
 * to the server and only the matches come back.
 *
 * Which server is the caller's business. This component lives in the shared UI
 * and every portal reaches students through its own endpoint under its own
 * permission — the Matron sees her dormitory, the Discipline Master sees the
 * school. Hard-coding one of those here would have made the component a
 * Discipline component wearing shared clothes, and calling it from the Matron
 * portal would have 403'd.
 */
export function StudentSearchPicker({
    value, onChange, fetchStudents,
    label, placeholder, required, minChars = 2, limit = 8, hideLabel,
}) {
    const { t } = useTranslation()
    const [query, setQuery] = useState(value?.name || '')
    const [results, setResults] = useState([])
    const [open, setOpen] = useState(false)
    const [searching, setSearching] = useState(false)
    const [searched, setSearched] = useState(false)
    const [active, setActive] = useState(-1)
    const wrapRef = useRef(null)
    const debounceRef = useRef(null)
    // Only the newest search may write to state. Typing "mu" then "muk" fires
    // two requests, and the shorter one is both broader and likelier to land
    // last — without this the wider result list overwrites the narrower.
    const runRef = useRef(0)
    const listId = useId()

    useEffect(() => {
        function handler(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) close()
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    useEffect(() => () => clearTimeout(debounceRef.current), [])

    useEffect(() => {
        if (value?.name) setQuery(value.name)
    }, [value?.name])

    function close() {
        setOpen(false)
        setActive(-1)
    }

    function handleSearch(e) {
        const q = e.target.value
        setQuery(q)
        // Typing after a pick means the pick no longer matches what is on
        // screen, so the caller must not keep holding the old student.
        if (value) onChange(null)
        clearTimeout(debounceRef.current)
        setActive(-1)
        if (q.trim().length < minChars) {
            setResults([]); setSearched(false); setOpen(false); return
        }
        debounceRef.current = setTimeout(async () => {
            const run = ++runRef.current
            setSearching(true)
            try {
                const data = await fetchStudents(q.trim())
                if (run !== runRef.current) return
                setResults(Array.isArray(data) ? data.slice(0, limit) : [])
            } catch {
                if (run === runRef.current) setResults([])
            } finally {
                if (run === runRef.current) {
                    setSearching(false); setSearched(true); setOpen(true)
                }
            }
        }, 300)
    }

    function select(student) {
        setQuery(studentName(student))
        onChange(student)
        close()
        setResults([])
    }

    /* The combobox keys people expect. Without these the menu was reachable
       only with a mouse, which is also what made every option a <div>. */
    function handleKeyDown(e) {
        if (e.key === 'Escape') { close(); return }
        if (!open || results.length === 0) {
            if (e.key === 'ArrowDown' && results.length) setOpen(true)
            return
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive(i => (i + 1) % results.length)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive(i => (i <= 0 ? results.length - 1 : i - 1))
        } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault()
            select(results[active])
        } else if (e.key === 'Tab') {
            close()
        }
    }

    const showEmpty = open && searched && !searching && results.length === 0

    return (
        <div className="form-group student-picker" ref={wrapRef}>
            {/* Always labelled. It used to render only when `required`, which
                left the unlabelled case to screen readers as a bare textbox.
                `hideLabel` hides it from sight only — in a filter row beside
                unlabelled dropdowns a visible label pushes this control out of
                line, but removing it would leave the field unnamed. */}
            <label className={`form-label${hideLabel ? ' sr-only' : ''}`}
                   htmlFor={`${listId}-input`}>
                {label || t('common.student')}{required ? ' *' : ''}
            </label>
            <div className="student-picker-wrap">
                <input
                    id={`${listId}-input`}
                    className="form-input"
                    value={query}
                    onChange={handleSearch}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder || t('common.searchStudentPlaceholder')}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
                />
                {searching && (
                    <span className="material-symbols-rounded student-picker-spin"
                          role="status" aria-label={t('common.searching')}>
                        progress_activity
                    </span>
                )}
            </div>

            {open && results.length > 0 && (
                <div className="student-picker-menu" id={listId} role="listbox">
                    {results.map((s, i) => (
                        <button
                            type="button"
                            key={studentKey(s)}
                            id={`${listId}-opt-${i}`}
                            role="option"
                            aria-selected={i === active}
                            className={`student-picker-item${i === active ? ' active' : ''}`}
                            onMouseEnter={() => setActive(i)}
                            onClick={() => select(s)}
                        >
                            <span className="student-picker-av" aria-hidden="true">
                                {initials(studentName(s))}
                            </span>
                            <span className="student-picker-text">
                                <span className="student-picker-name">{studentName(s)}</span>
                                <span className="student-picker-sub">{studentSub(s)}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* A silent empty menu reads as a broken search. */}
            {showEmpty && (
                <div className="student-picker-menu" id={listId} role="listbox">
                    <p className="student-picker-empty">{t('common.noStudentsFound')}</p>
                </div>
            )}
        </div>
    )
}

/* Portals serialise a student slightly differently; the picker should not care. */
function studentName(s) {
    return s?.name || s?.full_name || ''
}

function studentKey(s) {
    return s?.id ?? s?.student_pk ?? studentName(s)
}

function studentSub(s) {
    if (s?.grade && s?.section) return `${s.grade}${s.section}`
    return s?.class_name || s?.student_id || s?.student_code || ''
}

function initials(name) {
    return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
