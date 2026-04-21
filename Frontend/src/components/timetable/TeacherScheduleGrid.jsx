import { useState } from 'react'
import { PERIODS } from '../../data/academicTimetable'
import { getTeacherSchedule } from '../../data/academicTimetable'
import { DAYS, DAY_SHORT } from '../../data/extraTimetable'
import { getTodayDayIndex } from './dateUtils'
import { DayTabs } from './DaysTabs'
import { TimetableCell } from './TimetableCell'

/**
 * TeacherScheduleGrid — shows all lessons for one teacher across all classes.
 *
 * Calls getTeacherSchedule(teacherId) to collect every lesson the teacher has,
 * then renders a PERIODS × Mon-Sat grid where each cell shows:
 *   subject (row 1), class (row 2, shown as teacher field), room (row 3)
 *
 * Props:
 *   teacherId     {string}   e.g. 'T001'
 *   currentMonday {Date}     Monday of the week being viewed (from WeekPicker)
 *   schedules     {object}   Optional live schedule state; null = use static data
 */
export function TeacherScheduleGrid({ teacherId, currentMonday, schedules = null }) {
    const [selectedDay, setSelectedDay] = useState(0)
    const todayDayIndex = getTodayDayIndex(currentMonday)

    /* Mon–Sat only */
    const academicDays     = DAYS.slice(0, 6)
    const academicDayShort = DAY_SHORT.slice(0, 6)

    /* Build lookup: lookup[day][periodIndex] = cell object */
    const lessons = getTeacherSchedule(teacherId, schedules || undefined)
    const lookup = {}
    for (const lesson of lessons) {
        if (!lookup[lesson.day]) lookup[lesson.day] = {}
        lookup[lesson.day][lesson.periodIndex] = {
            type: 'academic',
            subject: lesson.subject,
            /* Show class name where TimetableCell renders the "teacher" line */
            teacher: lesson.classId,
            room: lesson.room,
        }
    }

    if (lessons.length === 0) {
        return (
            <p style={{ color: 'var(--muted-foreground)', padding: '1rem' }}>
                No lessons found for this teacher.
            </p>
        )
    }

    return (
        <div>
            <DayTabs
                selected={selectedDay}
                onChange={setSelectedDay}
                days={academicDayShort}
            />
            <div className="tt-wrap">
                <table className="tt-table" data-day={selectedDay}>
                    <thead>
                        <tr>
                            <th className="tt-time-head">Period</th>
                            {academicDays.map((day, i) => (
                                <th
                                    key={day}
                                    className={`tt-day-head tt-col-${i + 1}${i === todayDayIndex ? ' tt-today' : ''}`}
                                >
                                    {academicDayShort[i]}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {PERIODS.map((period, periodIndex) => (
                            <tr key={period.id}>
                                <td className="tt-time-cell">
                                    <strong>{period.label}</strong>
                                    <span>{period.time}</span>
                                </td>
                                {period.id === 'break'
                                    ? <td className="tt-cell tt-break" colSpan={6}>Break</td>
                                    : academicDays.map((day, i) => (
                                        <TimetableCell
                                            key={day}
                                            cell={lookup[day]?.[periodIndex] ?? null}
                                            editable={false}
                                            onEdit={() => {}}
                                            colIndex={i + 1}
                                        />
                                    ))
                                }
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
