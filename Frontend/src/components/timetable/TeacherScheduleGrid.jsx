import { useState, useEffect } from 'react'
import { DayTabs } from './DaysTabs'
import { TimetableCell } from './TimetableCell'
import { getTodayDayIndex } from './dateUtils'
import { getTeacherTimetable } from '../../api/teacher'

const DAY_KEYS  = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_SHORT = ['Mon',    'Tue',     'Wed',       'Thu',      'Fri',    'Sat'     ]

function normTime(t) {
    // "08:00:00" → "08:00"  |  "08:00" → "08:00"
    return t ? t.slice(0, 5) : ''
}

function fmtTime(t) {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hour = parseInt(h, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    return `${hour % 12 || 12}:${m} ${ampm}`
}

/**
 * TeacherScheduleGrid — teacher's personal weekly timetable from the backend.
 * Rows = unique start times, columns = Mon–Sat.
 */
export function TeacherScheduleGrid({ currentMonday }) {
    const [slots,   setSlots]   = useState([])
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)
    const [selDay,  setSelDay]  = useState(0)

    const todayDayIndex = getTodayDayIndex(currentMonday)

    useEffect(() => {
        getTeacherTimetable()
            .then(data => {
                const list = Array.isArray(data) ? data : (data?.results ?? [])
                setSlots(list)
            })
            .catch(() => setError('Failed to load timetable.'))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <p style={{ color: 'var(--muted-foreground)', padding: '1rem' }}>Loading timetable…</p>
    if (error)   return <p style={{ color: 'var(--destructive)',      padding: '1rem' }}>{error}</p>
    if (slots.length === 0) return (
        <p style={{ color: 'var(--muted-foreground)', padding: '1rem' }}>
            No lessons scheduled for this term yet.
        </p>
    )

    // Build sorted unique time rows
    const rowMap = new Map()
    for (const s of slots) {
        const start = normTime(s.start_time)
        const end   = normTime(s.end_time)
        if (!rowMap.has(start)) rowMap.set(start, end)
    }
    const timeRows = [...rowMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([start, end]) => ({ start, end }))

    // Build lookup: day → start_time → slot
    const lookup = {}
    for (const s of slots) {
        const start = normTime(s.start_time)
        if (!lookup[s.day]) lookup[s.day] = {}
        lookup[s.day][start] = s
    }

    return (
        <div>
            <DayTabs
                selected={selDay}
                onChange={setSelDay}
                days={DAY_SHORT}
            />
            <div className="tt-wrap">
                <table className="tt-table" data-day={selDay}>
                    <thead>
                        <tr>
                            <th className="tt-time-head">Period</th>
                            {DAY_SHORT.map((d, i) => (
                                <th key={d} className={`tt-day-head tt-col-${i + 1}${i === todayDayIndex ? ' tt-today' : ''}`}>
                                    {d}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {timeRows.map((row, ri) => (
                            <tr key={row.start}>
                                <td className="tt-time-cell">
                                    <strong>P{ri + 1}</strong>
                                    <span>{fmtTime(row.start)}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
                                        {fmtTime(row.end)}
                                    </span>
                                </td>
                                {DAY_KEYS.map((day, i) => {
                                    const s = lookup[day]?.[row.start]
                                    const cell = s ? {
                                        type:    'academic',
                                        subject: s.subject_name,
                                        teacher: s.class_name,
                                        room:    s.room_number,
                                    } : null
                                    return (
                                        <TimetableCell
                                            key={day}
                                            cell={cell}
                                            editable={false}
                                            onEdit={() => {}}
                                            colIndex={i + 1}
                                        />
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
