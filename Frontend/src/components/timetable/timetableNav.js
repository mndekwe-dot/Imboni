import { addDays, addMonths, endOfMonth, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { formatDate, formatDateShort, monthName } from '../../utils/date'

/**
 * Date arithmetic for the timetable's views — pure, so it is tested on its own.
 *
 * The timetable holds one anchor: a Monday (the week) plus a day index into it
 * (0 = Mon … 6 = Sun). Day view shows that day, Week and Schedule show the
 * week around it. Every move goes through here so the three views agree on
 * which days exist.
 */

export const VIEWS = ['day', 'week', 'schedule']

/* The letter each view answers to, as in Google Calendar. Kept identical in
   every language: a shortcut that moves when the UI language changes is one
   nobody can learn. */
export const VIEW_KEYS = { day: 'D', week: 'W', schedule: 'A', month: 'M' }

/* Month is not a timetable view - a lesson grid a month wide says nothing -
   but the attendance record uses the same toolbar and needs it. */

/* The academic week is Mon–Sat; the boarding routine runs all seven days. */
export function allDaysFor(type) {
    return type === 'extracurricular' ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5]
}

/* Weekend = Saturday and Sunday. "Show weekends" off leaves Mon–Fri for both
   grids; the academic one simply had no Sunday to hide. */
export function visibleDaysFor(type, showWeekends) {
    const all = allDaysFor(type)
    return showWeekends ? all : all.filter(d => d < 5)
}

export const mondayOf = date => startOfWeek(date, { weekStartsOn: 1 })

/* DAYS index of a date: JS getDay() is 0 = Sun, the grid is 0 = Mon. */
export const dayIndexOf = date => (date.getDay() + 6) % 7

/**
 * The nearest date on or after `date` (dir = 1) or on or before it (dir = -1)
 * that the grid actually shows. Sunday on the academic grid, or Saturday with
 * weekends hidden, has no column — landing there would show nothing.
 */
export function snapToVisible(date, visibleDays, dir = 1) {
    let d = date
    for (let i = 0; i < 7; i++) {
        if (visibleDays.includes(dayIndexOf(d))) return d
        d = addDays(d, dir)
    }
    return date   // no visible days at all; nothing better to offer
}

/** One step back or forward: a visible day in Day view, a week otherwise. */
export function step(anchor, view, visibleDays, dir) {
    if (view === 'day') return snapToVisible(addDays(anchor, dir), visibleDays, dir)
    if (view === 'month') return addMonths(anchor, dir)
    return addDays(anchor, 7 * dir)
}

/**
 * "Sep 14 – Sep 19, 2026" for the days actually on screen, or the single day.
 * Locale-aware through utils/date, so month names follow the UI language.
 */
export function rangeLabel(anchor, view, visibleDays, formatDay) {
    if (view === 'day') return formatDay(anchor)
    if (view === 'month') return `${monthName(anchor.getFullYear(), anchor.getMonth())} ${anchor.getFullYear()}`
    const monday = mondayOf(anchor)
    const first  = addDays(monday, visibleDays[0] ?? 0)
    const last   = addDays(monday, visibleDays[visibleDays.length - 1] ?? 6)
    // Across New Year both ends need their year, or "Dec 29 – Jan 2, 2027"
    // reads as if December were in 2027 too.
    const start = first.getFullYear() === last.getFullYear() ? formatDateShort(first) : formatDate(first)
    return `${start} – ${formatDate(last)}`
}

/** True when the anchor date is already where "Today" would take you. */
export function isAtToday(anchor, view, visibleDays, now) {
    const today = snapToVisible(now, visibleDays, 1)
    if (view === 'month') return isSameMonth(anchor, today)
    return view === 'day' ? isSameDay(anchor, today) : isSameDay(mondayOf(anchor), mondayOf(today))
}

/* The days on screen, for shading in the month calendar; null in Day view,
   where the selected day already marks the one day. The end runs to the last
   second of the last day, because isWithinInterval compares instants. */
export function shadedRange(anchor, view, visibleDays) {
    if (view === 'day') return null
    if (view === 'month') {
        const last = endOfMonth(anchor)
        return { start: startOfMonth(anchor), end: new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59) }
    }
    const monday = mondayOf(anchor)
    const last = addDays(monday, visibleDays[visibleDays.length - 1] ?? 6)
    return {
        start: addDays(monday, visibleDays[0] ?? 0),
        end:   new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59),
    }
}
