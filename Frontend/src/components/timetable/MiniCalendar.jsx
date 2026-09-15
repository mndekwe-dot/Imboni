import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    addDays, addMonths, format, isSameDay, isSameMonth, isWithinInterval, startOfDay, startOfMonth,
} from 'date-fns'
import { formatDateLong, monthName, weekdayShortNames } from '../../utils/date'
import { mondayOf } from './timetableNav'

const iso = d => format(d, 'yyyy-MM-dd')

/**
 * A month grid for jumping the timetable to any date.
 *
 * Monday first, because the school week is — the Sunday-first grid most
 * pickers draw would split every timetable week across two rows.
 *
 * Keyboard follows the date-picker pattern screen-reader users already know:
 * arrows move a day / a week, Home and End go to the start and end of the
 * week, Page Up / Page Down change the month, Enter or Space picks. Only the
 * focused day is in the tab order, so Tab leaves the grid in one press.
 *
 * Props:
 *   selected   Date     the timetable's current day
 *   range      {start, end} | null   days currently on screen, shaded
 *   today      Date
 *   onPick     (date) => void
 *   maxDate    Date | null   days after it cannot be picked
 */
export function MiniCalendar({ selected, range, today, onPick, maxDate = null }) {
    const { t } = useTranslation()
    const [focused, setFocused] = useState(() => startOfDay(selected))
    const gridRef = useRef(null)
    const moved = useRef(false)

    /* Focus follows the keyboard, but not on first open — the popover's own
       effect puts focus on the selected day then. */
    useEffect(() => {
        if (!moved.current) return
        gridRef.current?.querySelector(`[data-date="${iso(focused)}"]`)?.focus()
    }, [focused])

    const first = startOfMonth(focused)
    const gridStart = mondayOf(first)
    // Always six rows, so the popover does not change height between months.
    const weeks = Array.from({ length: 6 }, (_, w) =>
        Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)))

    const sundayFirst = weekdayShortNames()
    const headers = [...sundayFirst.slice(1), sundayFirst[0]]

    function move(next) {
        moved.current = true
        setFocused(startOfDay(next))
    }

    function onKeyDown(e) {
        const d = focused
        const map = {
            ArrowLeft:  () => addDays(d, -1),
            ArrowRight: () => addDays(d, 1),
            ArrowUp:    () => addDays(d, -7),
            ArrowDown:  () => addDays(d, 7),
            Home:       () => mondayOf(d),
            End:        () => addDays(mondayOf(d), 6),
            PageUp:     () => addMonths(d, -1),
            PageDown:   () => addMonths(d, 1),
        }
        if (!map[e.key]) return
        e.preventDefault()
        move(map[e.key]())
    }

    return (
        <div className="tt-cal">
            <div className="tt-cal-head">
                <button type="button" className="tt-icon-btn" onClick={() => move(addMonths(first, -1))}
                    aria-label={t('timetable.previousMonth')} title={t('timetable.previousMonth')}>
                    <span className="material-symbols-rounded" aria-hidden="true">chevron_left</span>
                </button>
                <span className="tt-cal-title" aria-live="polite">
                    {monthName(first.getFullYear(), first.getMonth())} {first.getFullYear()}
                </span>
                <button type="button" className="tt-icon-btn" onClick={() => move(addMonths(first, 1))}
                    aria-label={t('timetable.nextMonth')} title={t('timetable.nextMonth')}>
                    <span className="material-symbols-rounded" aria-hidden="true">chevron_right</span>
                </button>
            </div>

            <table className="tt-cal-grid" role="grid" ref={gridRef} onKeyDown={onKeyDown}>
                <thead>
                    <tr>
                        {/* Keyed by position: short weekday names are not
                            guaranteed unique in every locale. */}
                        {headers.map((h, i) => <th key={i} scope="col" className="tt-cal-dow">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {weeks.map(week => (
                        <tr key={iso(week[0])}>
                            {week.map(day => {
                                const outside  = !isSameMonth(day, first)
                                const isSel    = isSameDay(day, selected)
                                const isToday  = isSameDay(day, today)
                                const inRange  = range && isWithinInterval(day, range)
                                const tooLate  = !!maxDate && day > maxDate
                                const cls = ['tt-cal-day',
                                    outside && 'is-outside',
                                    inRange && 'is-range',
                                    isSel && 'is-selected',
                                    isToday && 'is-today'].filter(Boolean).join(' ')
                                return (
                                    <td key={iso(day)} role="gridcell" aria-selected={isSel}>
                                        <button
                                            type="button"
                                            className={cls}
                                            data-date={iso(day)}
                                            tabIndex={isSameDay(day, focused) ? 0 : -1}
                                            aria-label={formatDateLong(day)}
                                            aria-current={isToday ? 'date' : undefined}
                                            disabled={tooLate}
                                            onClick={() => onPick(day)}
                                        >
                                            {day.getDate()}
                                        </button>
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
