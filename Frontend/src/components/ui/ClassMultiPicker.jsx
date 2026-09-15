import { useTranslation } from 'react-i18next'

import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import '../../styles/components.css'

/**
 * Choose SEVERAL classes: whole years, or particular streams within a year.
 *
 * The third member of the class family, beside `ClassPicker` (exactly one
 * class) and `ClassFilter` (narrow a list). A fee line, an announcement, a
 * discount apply to a set - "S4, and S5 MPC only" - which neither of the others
 * can say. Options come from the school's own structure via
 * `useSchoolConfig`, so nothing the school does not teach can be chosen.
 *
 * value     [{ grade: 'S4', stream: '' }, { grade: 'S5', stream: 'MPC' }]
 *           A blank stream is the whole year. An empty list is "every class",
 *           which the page says in its own words through `allLabel`.
 * onChange  (nextValue) => void
 */
export function ClassMultiPicker({ value = [], onChange, allLabel, idPrefix = 'cmp' }) {
    const { t } = useTranslation()
    const { config } = useSchoolConfig()

    const years = (config || [])
        .flatMap(section => (section.years || []).map(year => ({ ...year, section: section.name })))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

    const wholeYear = grade => value.some(v => v.grade === grade && !v.stream)
    const streamOn = (grade, stream) => wholeYear(grade) || value.some(v => v.grade === grade && v.stream === stream)
    const anyOf = grade => value.some(v => v.grade === grade)

    function toggleYear(grade) {
        const others = value.filter(v => v.grade !== grade)
        onChange(anyOf(grade) ? others : [...others, { grade, stream: '' }])
    }

    function toggleStream(year, stream) {
        const others = value.filter(v => v.grade !== year.name)
        let streams = wholeYear(year.name)
            ? [...(year.streams || [])]
            : value.filter(v => v.grade === year.name).map(v => v.stream)
        streams = streams.includes(stream) ? streams.filter(s => s !== stream) : [...streams, stream]
        // Every stream ticked is the whole year; say it that way, so a stream
        // added to the school later is included too.
        const all = (year.streams || []).length > 0 && streams.length === year.streams.length
        onChange([...others, ...(all ? [{ grade: year.name, stream: '' }]
            : streams.map(s => ({ grade: year.name, stream: s })))])
    }

    return (
        <fieldset className="class-multi" aria-describedby={`${idPrefix}-summary`}>
            <legend className="form-label">{t('common.classes')}</legend>
            <p id={`${idPrefix}-summary`} className="text-xs-muted">
                {value.length === 0
                    ? (allLabel || t('common.allClasses'))
                    : value.map(v => `${v.grade}${v.stream}`).join(', ')}
            </p>
            <div className="class-multi-years">
                {years.map(year => (
                    <div key={year.name} className={`class-multi-year${anyOf(year.name) ? ' on' : ''}`}>
                        <label className="class-multi-year-label">
                            <input type="checkbox" checked={anyOf(year.name)}
                                onChange={() => toggleYear(year.name)} />
                            <span>{year.name}</span>
                        </label>
                        {(year.streams || []).length > 1 && anyOf(year.name) && (
                            <div className="class-multi-streams">
                                {year.streams.map(stream => (
                                    <button key={stream} type="button"
                                        aria-pressed={streamOn(year.name, stream)}
                                        className={`class-picker-chip${streamOn(year.name, stream) ? ' active' : ''}`}
                                        onClick={() => toggleStream(year, stream)}>
                                        {year.name}{stream}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {value.length > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([])}>
                    {allLabel || t('common.allClasses')}
                </button>
            )}
        </fieldset>
    )
}
