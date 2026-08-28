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
 * Two variants:
 *   default   three dropdowns and the current selection spelled out
 *   'chips'   one row of class chips, for a page with room for it
 */
export function ClassPicker({
    sections,
    // dropdown mode
    section, onSectionChange, year, onYearChange, classVal, onClassChange,
    // chip mode — pass `classes` (flat string[]) or let it derive from sections
    variant, classes, value, onChange,
}) {
    const { t } = useTranslation()
    /* Called unconditionally — hooks must be. When the page passed its own
       (narrowed) sections we simply do not read this one; `useSchoolConfig`
       caches at module scope, so the extra call costs no extra request. */
    const { config } = useSchoolConfig()
    const source = sections ?? config

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

    const yearOptions = activeSection
        ? activeSection.years.map(y => y.name)
        : [...new Set(source.flatMap(s => s.years.map(y => y.name)))]

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
                <label className="class-picker-label" htmlFor="class-picker-section">{t('common.section')}</label>
                <select
                    id="class-picker-section"
                    className="picker-select"
                    value={section}
                    onChange={e => handleSectionChange(e.target.value)}
                >
                    <option value="">{t('common.allSections')}</option>
                    {source.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
            </div>
            <div className="class-picker-group">
                <label className="class-picker-label" htmlFor="class-picker-year">{t('common.year')}</label>
                <select
                    id="class-picker-year"
                    className="picker-select"
                    value={year}
                    onChange={e => handleYearChange(e.target.value)}
                >
                    <option value="">{t('common.allYears')}</option>
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <div className="class-picker-group">
                <label className="class-picker-label" htmlFor="class-picker-class">{t('common.class')}</label>
                <select
                    id="class-picker-class"
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
