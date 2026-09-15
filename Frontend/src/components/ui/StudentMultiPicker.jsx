import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StudentSearchPicker } from './StudentSearchPicker'
import '../../styles/components.css'

/**
 * Build a list of students: search, add, remove.
 *
 * `StudentSearchPicker` picks one; this keeps picking. Like it, the search goes
 * to whatever endpoint the caller passes, under that portal's own permission.
 *
 * value     [{ id, name, class_label?, student_id? }]
 * onChange  (nextValue) => void
 */
export function StudentMultiPicker({ value = [], onChange, fetchStudents, label, placeholder }) {
    const { t } = useTranslation()
    // Remounting the single picker after each pick clears its search box.
    const [round, setRound] = useState(0)

    function add(student) {
        if (!student) return
        if (!value.some(s => s.id === student.id)) {
            onChange([...value, student])
        }
        setRound(r => r + 1)
    }

    return (
        <div className="student-multi">
            <StudentSearchPicker key={round} value={null} onChange={add}
                fetchStudents={fetchStudents} label={label} placeholder={placeholder} />
            {value.length > 0 && (
                <ul className="student-chips" aria-label={label}>
                    {value.map(student => (
                        <li key={student.id} className="student-chip">
                            <span>
                                {student.name}
                                {(student.class_label || student.grade) && (
                                    <span className="text-xs-muted"> · {student.class_label || student.grade}</span>
                                )}
                            </span>
                            <button type="button"
                                aria-label={t('common.removeItem', { name: student.name })}
                                onClick={() => onChange(value.filter(s => s.id !== student.id))}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">close</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
