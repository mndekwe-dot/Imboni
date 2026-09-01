import { useTranslation } from 'react-i18next'

import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import '../../styles/components.css'

/**
 * Narrow a list to a year group and, optionally, one class within it.
 *
 * A filter, not a picker. `ClassPicker` is for CHOOSING the one class a thing
 * belongs to and insists on a complete answer; this is for narrowing a list you
 * are already looking at, so every level has an "all" and leaving it alone
 * means everything. Wiring ClassPicker into a debtor list would force the
 * bursar to pick a stream before seeing anybody.
 *
 * Options come from the school's own structure via `useSchoolConfig`, the same
 * single source ClassPicker reads, so a filter can never offer a year the
 * school does not teach.
 *
 * NOTE the naming. This emits `grade` (S1..S6) and `stream` (A, B, MPG), which
 * is what the API filters on. The school "section" (O-Level / A-Level) is only
 * used here to narrow which years are offered -- the backend's
 * `Student.section` field holds the STREAM, and passing a section name into it
 * would filter every pupil by the string 'O-Level' and return nothing.
 */
export function ClassFilter({ grade, stream, onChange, disabled = false }) {
    const { t } = useTranslation()
    const { config } = useSchoolConfig()

    const years = [...new Set((config || []).flatMap(s => (s.years || []).map(y => y.name)))]
    const streams = grade
        ? [...new Set((config || [])
            .flatMap(s => (s.years || []).filter(y => y.name === grade)
                .flatMap(y => y.streams || [])))]
        : []

    function pickGrade(value) {
        // Changing the year clears the stream: 'S1' + 'MPG' is a combination
        // that exists in neither the school nor the data, and leaving a stale
        // stream behind silently returns nothing.
        onChange({ grade: value, stream: '' })
    }

    return (
        <div className="class-filter" role="group" aria-label={t('common.filterByClass')}>
            <select
                className="form-input class-filter-select"
                value={grade || ''}
                onChange={e => pickGrade(e.target.value)}
                disabled={disabled}
                aria-label={t('common.year')}
            >
                <option value="">{t('common.allClasses')}</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            {grade && streams.length > 0 && (
                <select
                    className="form-input class-filter-select"
                    value={stream || ''}
                    onChange={e => onChange({ grade, stream: e.target.value })}
                    disabled={disabled}
                    aria-label={t('common.stream')}
                >
                    <option value="">{t('common.allStreams')}</option>
                    {streams.map(s => <option key={s} value={s}>{grade}{s}</option>)}
                </select>
            )}

            {(grade || stream) && (
                <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => onChange({ grade: '', stream: '' })}
                >
                    {t('common.clear')}
                </button>
            )}
        </div>
    )
}
