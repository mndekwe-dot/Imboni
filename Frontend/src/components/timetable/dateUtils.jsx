import { startOfWeek, endOfWeek, format, isSameWeek } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const SCHOOL_TIMEZONE = 'Africa/Kigali'

// Gets current date/time in Rwanda timezone (UTC+2)
export function getNow() {
    return toZonedTime(new Date(), SCHOOL_TIMEZONE)
}

// Returns the Monday of the current week in Rwanda time
export function getThisMonday() {
    return startOfWeek(getNow(), { weekStartsOn: 1 })
}

// Builds label like "Apr 14 – Apr 20, 2026"
export function formatWeekLabel(monday) {
    const sunday = endOfWeek(monday, { weekStartsOn: 1 })
    return `${format(monday, 'MMM d')} – ${format(sunday, 'MMM d, yyyy')}`
}

// Returns true if two dates fall in the same week (Monday start)
export function isThisWeek(date) {
    return isSameWeek(date, getNow(), { weekStartsOn: 1 })
}

// Returns the DAYS-array index (0=Mon … 6=Sun) of today when viewing the current week.
// Returns -1 if currentMonday is not the current week — no column should be highlighted.
// Used by timetable header rows to apply the tt-today CSS class.
export function getTodayDayIndex(currentMonday) {
    if (!isThisWeek(currentMonday)) return -1
    // JS getDay(): 0=Sun, 1=Mon, …, 6=Sat
    // DAYS array : 0=Mon, …, 6=Sun   →  formula: (jsDay + 6) % 7
    return (getNow().getDay() + 6) % 7
}
