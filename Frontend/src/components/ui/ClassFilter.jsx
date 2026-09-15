import { useRef, useState } from 'react'

import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { ClassPicker } from './ClassPicker'

/**
 * Narrow a list to a section, a year group and, optionally, one class.
 *
 * The same Section / Year / Class card the teacher pages use, so every portal
 * filters by class the same way. The card stands on its own row above the
 * toolbar; squeezed into a toolbar next to a search box it was the bare
 * "All Classes" dropdown nobody recognised as a filter.
 *
 * A filter, not a picker: every level has an "all", and leaving it alone means
 * everything. The page receives `{ grade, stream }`, which is what the API
 * filters on:
 *   grade   one year ('S4'), or every year of the chosen section ('S4,S5,S6')
 *           when a section is picked without a year, so choosing "A-Level"
 *           actually narrows the list instead of only changing the label
 *   stream  the class within the year (A, B, MPG). The backend's
 *           `Student.section` field holds the STREAM; a section name passed
 *           into it would filter every pupil by 'O-Level' and return nothing.
 */
export function ClassFilter({ grade, stream, onChange, disabled = false }) {
    const { config } = useSchoolConfig()
    const [section, setSection] = useState('')
    // ClassPicker resets the year and the class one callback after another.
    // Each reset builds on the previous one within the same event, rather than
    // on the props of the render that started it, or the second call would put
    // the old year back.
    const pending = useRef(null)

    const year = grade && !grade.includes(',') ? grade : ''

    function yearsOf(name) {
        const found = (config || []).find(s => s.name === name)
        return (found?.years || []).map(y => y.name).join(',')
    }

    function emit(patch) {
        const next = { section, year, stream: stream || '', ...pending.current, ...patch }
        pending.current = next
        queueMicrotask(() => { pending.current = null })
        onChange({
            grade: next.year || (next.section ? yearsOf(next.section) : ''),
            stream: next.stream,
        })
    }

    return (
        <ClassPicker
            section={section}
            onSectionChange={value => { setSection(value); emit({ section: value }) }}
            year={year} onYearChange={value => emit({ year: value, stream: '' })}
            classVal={stream || ''} onClassChange={value => emit({ stream: value })}
            disabled={disabled}
        />
    )
}
