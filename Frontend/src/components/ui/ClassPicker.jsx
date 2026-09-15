import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import '../../styles/components.css'

/**
 * Section → Year → Class, for every portal.
 *
 * **The picker's options always come from the school's own settings.** A school
 * declares its structure once, in Settings, and `useSchoolConfig` is the single
 * road out of it. `sections` is therefore OPTIONAL: leave it off and the picker
 * reads the school configuration itself, so a page cannot accidentally offer a
 * year the school does not teach or a stream it does not have.
 *
 * Pass `sections` only to NARROW that same configuration to a subset the page
 * is entitled to — the teacher pages pass
 * `sectionsFromClasses(myClasses, config)`, which is still the school's
 * structure, intersected with the classes that teacher actually teaches. It is
 * not a place to invent a class list.
 *
 * Three variants:
 *   default   three dropdowns and the current selection spelled out
 *   'chips'   one row of class chips, for a page with room for it
 *   'form'    a year and a stream, for a FORM that records one class (admitting
 *             a student, moving one, a class representative). See ClassSelect.
 */
export function ClassPicker({
    sections,
    // dropdown mode
    section, onSectionChange, year, onYearChange, classVal, onClassChange,
    // chip mode — pass `classes` (flat string[]) or let it derive from sections
    variant, classes, value, onChange,
    // form mode: `year` + `classVal` are the value, onChange({ grade, stream })
    yearLabel, streamLabel, allowAll, yearOnly, disabled,
}) {
    const { t } = useTranslation()
    const id = useId()
    /* Called unconditionally — hooks must be. When the page passed its own
       (narrowed) sections we simply do not read this one; `useSchoolConfig`
       caches at module scope, so the extra call costs no extra request. */
    const { config } = useSchoolConfig()
    const source = sections ?? config

    if (variant === 'form') {
        return (
            <ClassSelect source={source} grade={year} stream={classVal} onChange={onChange}
                yearLabel={yearLabel} streamLabel={streamLabel} allowAll={allowAll}
                yearOnly={yearOnly} disabled={disabled} />
        )
    }

    // ── Chip variant ──────────────────────────────────────────────────────────
    if (variant === 'chips') {
        // source[].years = [{name:"S1", streams:["A","B"]}, ...]
        const allClasses = classes ?? source.flatMap(sec =>
            (sec.years || []).flatMap(y =>
                (y.streams || []).map(stream => `${y.name}${stream}`)
            )
        )

        return (
            <div className="class-picker-chips">
                <span className="class-picker-label">{t('common.class')}</span>
                <div className="class-picker-chip-list">
                    <button
                        type="button"
                        className={`class-picker-chip${!value ? ' active' : ''}`}
                        onClick={() => onChange('')}
                    >{t('common.all')}</button>
                    {allClasses.map(key => (
                        <button
                            key={key}
                            type="button"
                            className={`class-picker-chip${value === key ? ' active' : ''}`}
                            onClick={() => onChange(value === key ? '' : key)}
                        >{key}</button>
                    ))}
                </div>
            </div>
        )
    }

    // ── Dropdown variant ─────────────────────────────────────────────────────
    const activeSection = source.find(s => s.name === section)

    // School order, S1 before S4, whichever section the settings list first.
    const yearOptions = (activeSection
        ? activeSection.years.map(y => y.name)
        : [...new Set(source.flatMap(s => s.years.map(y => y.name)))])
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

    const activeYear = activeSection?.years.find(y => y.name === year)
    const classOptions = activeYear
        ? activeYear.streams
        : year
            ? [...new Set(source.flatMap(s => s.years.filter(y => y.name === year).flatMap(y => y.streams)))]
            : [...new Set(source.flatMap(s => s.years.flatMap(y => y.streams)))]

    const current = [section, year, classVal].filter(Boolean).join(' · ') || t('common.allClasses')

    function handleSectionChange(val) {
        onSectionChange(val)
        onYearChange('')
        onClassChange('')
    }

    function handleYearChange(val) {
        onYearChange(val)
        onClassChange('')
    }

    return (
        <div className="class-picker">
            <div className="class-picker-group">
                <label className="class-picker-label" htmlFor={`${id}-section`}>{t('common.section')}</label>
                <select
                    id={`${id}-section`}
                    disabled={disabled}
                    className="picker-select"
                    value={section}
                    onChange={e => handleSectionChange(e.target.value)}
                >
                    <option value="">{t('common.allSections')}</option>
                    {source.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
            </div>
            <div className="class-picker-group">
                <label className="class-picker-label" htmlFor={`${id}-year`}>{t('common.year')}</label>
                <select
                    id={`${id}-year`}
                    disabled={disabled}
                    className="picker-select"
                    value={year}
                    onChange={e => handleYearChange(e.target.value)}
                >
                    <option value="">{t('common.allYears')}</option>
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <div className="class-picker-group">
                <label className="class-picker-label" htmlFor={`${id}-class`}>{t('common.class')}</label>
                <select
                    id={`${id}-class`}
                    disabled={disabled}
                    className="picker-select"
                    value={classVal}
                    onChange={e => onClassChange(e.target.value)}
                >
                    <option value="">{t('common.allClasses')}</option>
                    {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            <span className="class-picker-current">{current}</span>
        </div>
    )
}


/**
 * Year, then a stream of THAT year - for recording which one class something is.
 *
 * The forms that did this by hand listed every stream in the school under any
 * year, so S1 could be given the A-Level combination "MPC", and a class-rep form
 * offered classes the school does not have.
 *
 *   allowAll   an "all years" choice (a request sent to the whole school)
 *   yearOnly   no stream dropdown (something that belongs to a year group)
 *   disabled   read-only forms
 */
function ClassSelect({ source, grade = '', stream = '', onChange, allowAll = false, yearOnly = false,
    disabled = false, yearLabel, streamLabel }) {
    const { t } = useTranslation()
    const id = useId()
    const years = [...new Set(source.flatMap(s => (s.years || []).map(y => y.name)))]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const streams = [...new Set(source.flatMap(s => (s.years || [])
        .filter(y => y.name === grade).flatMap(y => y.streams || [])))]

    return (
        <div className="class-select">
            <div className="form-group">
                <label className="form-label" htmlFor={`${id}-year`}>{yearLabel || t('common.year')}</label>
                <select id={`${id}-year`} className="form-select" value={grade} disabled={disabled}
                    onChange={e => {
                        const next = e.target.value
                        const nextStreams = source.flatMap(s => (s.years || [])
                            .filter(y => y.name === next).flatMap(y => y.streams || []))
                        // A stream that exists in the new year is kept; otherwise the first one.
                        onChange({ grade: next, stream: yearOnly || !next ? '' : (nextStreams.includes(stream) ? stream : nextStreams[0] || '') })
                    }}>
                    {(allowAll || !grade) && <option value="">{allowAll ? t('common.allYears') : '—'}</option>}
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            {!yearOnly && (
                <div className="form-group">
                    <label className="form-label" htmlFor={`${id}-stream`}>{streamLabel || t('common.stream')}</label>
                    <select id={`${id}-stream`} className="form-select" value={stream}
                        disabled={disabled || !grade || streams.length === 0}
                        onChange={e => onChange({ grade, stream: e.target.value })}>
                        {streams.length === 0 && <option value="">—</option>}
                        {streams.map(s => <option key={s} value={s}>{grade}{s}</option>)}
                    </select>
                </div>
            )}
        </div>
    )
}

/** Split a class label ("S5MPC") into { grade, stream } against the school's years. */
export function splitClassLabel(label, config) {
    const years = (config || []).flatMap(s => (s.years || []).map(y => y.name))
        .sort((a, b) => b.length - a.length)
    const grade = years.find(y => (label || '').startsWith(y)) || ''
    return { grade, stream: grade ? label.slice(grade.length) : '' }
}
