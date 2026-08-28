import { getISOWeek, getISOWeekYear } from 'date-fns'

/**
 * The extracurricular / boarding week, as rows on the wire and as the shape
 * the <Timetable> grid reads.
 *
 * Two portals meet here. The Discipline Office writes this routine; every
 * matron reads it. Both render it through the same grid, so the translation
 * between `ExtracurricularEntry` rows and the grid's nested schedule object
 * lives once, here, rather than being written a second time in the matron
 * page — where a small difference would have shown up as cells quietly
 * rendering blank in her copy of a routine the Discipline Director could see.
 */

/** A Monday `Date` → the ISO week key the API files entries under, e.g. "2026-W23". */
export function toWeekKey(monday) {
    return `${getISOWeekYear(monday)}-W${String(getISOWeek(monday)).padStart(2, '0')}`
}

/**
 * Entry rows -> `{ [weekKey]: { [slotId]: { [Day]: cell } } }`, what <Timetable> reads.
 *
 * Everything is filed under `weekKey` -- the week that was ASKED for -- not
 * under each row's own `week` field. Callers fetch one week at a time, so the
 * two agree in practice; where they did not, rows were filed under their own
 * key while the grid looked up `weekKey`, found the pre-seeded empty bucket
 * sitting there, and rendered a blank week over data it had just been handed.
 *
 * The bucket for `weekKey` is always present, empty or not: without it the
 * grid falls through to the built-in `default` routine, so clearing a week
 * would show a different week's timetable rather than an empty one.
 */
export function entriesToSchedules(entries, weekKey) {
    const result = { [weekKey]: {} }
    entries.forEach(e => {
        const slots = result[weekKey]
        if (!slots[e.slot_id]) slots[e.slot_id] = {}
        slots[e.slot_id][e.day] = e.activity_type === 'empty'
            ? { type: 'empty', label: e.label || '-' }
            : { type: e.activity_type, subject: e.subject, teacher: e.teacher, room: e.room }
    })
    return result
}

/** `week__slot__day` → entry id, so an edit knows whether to POST or PATCH. */
export function buildIdMap(entries, weekKey) {
    const map = {}
    entries.forEach(e => { map[`${e.week || weekKey}__${e.slot_id}__${e.day}`] = e.id })
    return map
}

/* Supervision that is a standing duty rather than a named member of staff.
   Counting these as people made "Patron Teachers" read 4 when three of them
   were the words "Duty Staff" repeated. */
const GENERIC_STAFF = new Set(['Duty Staff', 'All Matrons', 'House Staff', 'All Dormitory Staff'])

/** What the week amounts to: activities, distinct clubs, named staff, venues. */
export function computeStats(entries) {
    const nonEmpty = entries.filter(e => e.activity_type !== 'empty')
    const clubs = new Set(
        nonEmpty.filter(e => !['boarding', 'dining'].includes(e.activity_type) && e.subject)
                .map(e => e.subject)
    )
    const patrons = new Set(
        nonEmpty.filter(e => e.teacher && !GENERIC_STAFF.has(e.teacher))
                .map(e => e.teacher)
    )
    const venues = new Set(nonEmpty.filter(e => e.room).map(e => e.room))
    return { scheduled: nonEmpty.length, clubs: clubs.size, patrons: patrons.size, venues: venues.size }
}
