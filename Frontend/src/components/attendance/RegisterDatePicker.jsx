import { format, parseISO, startOfDay } from 'date-fns'
import { TimetableToolbar } from '../timetable/TimetableToolbar'
import { getNow } from '../timetable/dateUtils'
import { snapToVisible, step } from '../timetable/timetableNav'
import '../../styles/timetable.css'

/**
 * The day or week a register is for, picked with the timetable's toolbar
 * (Today · ‹ › · date ▾) instead of a bare browser date field.
 *
 * Nothing after today can be chosen: a register records what happened.
 *
 * Props:
 *   value      'YYYY-MM-DD'
 *   onChange   ('YYYY-MM-DD') => void
 *   unit       'day' (Mon–Sat, the teaching week) | 'week' (Mon–Fri)
 *   children   trailing toolbar content
 */
const DAYS = { day: [0, 1, 2, 3, 4, 5], week: [0, 1, 2, 3, 4] }
const iso = d => format(d, 'yyyy-MM-dd')

export function RegisterDatePicker({ value, onChange, unit = 'day', children }) {
    const now = getNow()
    const today = startOfDay(now)
    const visibleDays = DAYS[unit]
    const anchor = parseISO(value)

    /* Never past today. Sunday has no register, so it snaps back to Saturday. */
    function land(date, dir) {
        const next = snapToVisible(startOfDay(date), visibleDays, dir)
        onChange(iso(next > today ? snapToVisible(today, visibleDays, -1) : next))
    }

    return (
        <TimetableToolbar
            views={[unit]}
            view={unit}
            anchor={anchor}
            visibleDays={visibleDays}
            now={now}
            maxDate={today}
            onStep={dir => land(step(anchor, unit, visibleDays, dir), dir)}
            onToday={() => land(today, -1)}
            onPick={date => land(date, -1)}
        >
            {children}
        </TimetableToolbar>
    )
}
