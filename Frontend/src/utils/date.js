/**
 * Shared date formatting.
 *
 * Before this existed as a set, ~35 call sites hand-rolled `toLocaleDateString`
 * in 18 different shapes across TWO locales (`en-US` and `en-GB`), so the same
 * date rendered as "15 Aug 2026" on one page and "Aug 15, 2026" on the next.
 * Everything now goes through these helpers. If a screen needs a shape that is
 * not here, add it here rather than inlining a new one.
 *
 * The locale follows the active UI language, so switching to Kinyarwanda also
 * switches month and weekday names. It is read per call rather than captured
 * once, because `changeLanguage` happens after this module is imported.
 */
import i18n from '../i18n'

// Intl wants a full BCP 47 tag; 'rw' alone resolves in modern browsers but
// 'rw-RW' is what CLDR actually names, so ask for that and let Intl fall back
// to English if the runtime was built without Kinyarwanda data.
const LOCALES = { en: 'en-US', rw: ['rw-RW', 'rw', 'en-US'] }

const locale = () => LOCALES[i18n.language] || LOCALES.en

// Every helper accepts a Date, an ISO string, or null/undefined and returns ''
// for anything unparseable — call sites used to each guard this themselves.
function toDate(value) {
    if (!value) return null
    const d = value instanceof Date ? value : new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
}

function fmt(value, options) {
    const d = toDate(value)
    return d ? d.toLocaleDateString(locale(), options) : ''
}

/** "Aug 15, 2026" — the default for dates shown in lists and tables. */
export const formatDate = value =>
    fmt(value, { month: 'short', day: 'numeric', year: 'numeric' })

/** "Aug 15, 2026, 2:30 PM" — log entries where the time of day matters. */
export const formatDateTime = value => {
    const d = toDate(value)
    return d ? d.toLocaleString(locale(), {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    }) : ''
}

/** "2:30 PM" — clock time only, for same-day timestamps in message lists. */
export const formatTime = value => {
    const d = toDate(value)
    return d ? d.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' }) : ''
}

/** "Aug 15" — when the year is obvious from context. */
export const formatDateShort = value =>
    fmt(value, { month: 'short', day: 'numeric' })

/** "August 15, 2026" — headings and printed reports. */
export const formatDateLong = value =>
    fmt(value, { month: 'long', day: 'numeric', year: 'numeric' })

/** "Saturday, August 15, 2026" — dashboard date lines. */
export const formatDateWithWeekday = value =>
    fmt(value, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

/** "Sat, Aug 15" — compact schedule/timetable headers. */
export const formatWeekdayShort = value =>
    fmt(value, { weekday: 'short', month: 'short', day: 'numeric' })

/** "Saturday" — day-of-week only. */
export const formatWeekday = value => fmt(value, { weekday: 'long' })

/**
 * "August" — the month heading of a calendar grid. Takes a month index (0-11)
 * rather than a date so callers do not have to build one just to name a month.
 */
export const monthName = (year, month) =>
    fmt(new Date(year, month, 1), { month: 'long' })

/**
 * ["Sun", "Mon", …] in the active locale, Sunday first, for calendar column
 * headers. Hardcoded English arrays were the last thing on those grids still
 * pinned to one language.
 */
export function weekdayShortNames() {
    // 2024-01-07 was a Sunday; stepping seven days from it walks the week.
    return Array.from({ length: 7 }, (_, i) =>
        fmt(new Date(2024, 0, 7 + i), { weekday: 'short' }))
}

/** "Aug 2026" — month pickers and grouping headers. */
export const formatMonthYear = value =>
    fmt(value, { month: 'short', year: 'numeric' })

/**
 * "Sat, Aug 15" pinned to UTC. The exam calendar parses its dates with
 * `Date.UTC` so a day never shifts across a timezone boundary; formatting has
 * to stay in UTC too or the label can disagree with the date it came from.
 */
export const formatWeekdayShortUTC = value =>
    fmt(value, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/**
 * Today's date in the school's timezone, spelled out in full.
 * Kept for the dashboard header banners that show "today".
 */
export function formatSchoolDate(timezone = 'Africa/Kigali') {
    return new Date().toLocaleDateString(locale(), {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: '2-digit',
    })
}
