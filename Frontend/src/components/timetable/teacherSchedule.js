/**
 * Adapter: the teacher's own timetable rows from the API → the shape the shared
 * academic grid already renders.
 *
 * Every other portal reads its timetable from the static class-keyed data, so
 * the grid was written against that shape. The teacher's timetable is the one
 * that comes from the backend, and it arrives pivoted the other way: a flat
 * list of lessons, each carrying its own day and clock time, with no period
 * numbers at all.
 *
 * Rather than give the teacher a second grid component that speaks the API's
 * shape — which is what used to happen, and why the teacher's timetable looked
 * nothing like everyone else's — this converts the list into the same
 * `{ periods, schedule }` pair the academic grid consumes. The teacher then
 * gets subject colouring, the home-room rule, the today column and the "Now"
 * marker for free, because it is literally the same renderer.
 */
import { DAYS } from '../../data/extraTimetable'

/* The API days are lowercase; the grid keys off capitalised names. */
const DAY_NAME = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
    thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

/* The grid renders Mon–Sat, so the schedule must have a row per those days. */
const ACADEMIC_DAYS = DAYS.slice(0, 6)

/* "08:00:00" and "08:00" both mean the same row. */
export function normTime(t) {
    return t ? String(t).slice(0, 5) : ''
}

/* "14:30" → "2:30", the same 12-hour, no-meridiem form the static timetables
   use ("2:00 - 2:40" for the afternoon). Matching them is not cosmetic: the
   period column is sized for that width, and spelling out "2:30 PM" in a range
   overflows it into the Monday cell. The reader is looking at a school day, so
   there is no morning/afternoon ambiguity to resolve. */
export function fmtTime(t) {
    if (!t) return ''
    const [h, m] = String(t).split(':')
    const hour = parseInt(h, 10)
    if (Number.isNaN(hour)) return ''
    return `${hour % 12 || 12}:${m}`
}

/**
 * Build `{ periods, schedule }` from a flat list of API timetable rows.
 *
 * Rows become periods: every distinct start time in the week is one row,
 * ordered by the clock. A teacher whose Monday starts at 08:00 and whose
 * Tuesday starts at 08:40 gets both rows, and each day fills only the ones it
 * actually uses — so the grid stays rectangular without inventing lessons.
 *
 * A slot with no lesson is returned as an explicit empty cell rather than
 * null, because for a teacher an unfilled slot is not missing data: it is a
 * free period, and saying so is more useful than a dash.
 */
export function teacherSlotsToSchedule(slots, { freeLabel = 'Free' } = {}) {
    const list = Array.isArray(slots) ? slots : []

    /* One row per distinct start time, earliest first. The end time comes from
       the first slot seen at that start — lessons sharing a start share a bell. */
    const ends = new Map()
    for (const s of list) {
        const start = normTime(s.start_time)
        if (!start) continue
        if (!ends.has(start)) ends.set(start, normTime(s.end_time))
    }
    const starts = [...ends.keys()].sort((a, b) => a.localeCompare(b))

    const periods = starts.map((start, i) => ({
        id:    start,
        label: `Period ${i + 1}`,
        time:  `${fmtTime(start)} - ${fmtTime(ends.get(start))}`,
    }))

    /* day → start time → the lesson in that slot. */
    const byDay = {}
    for (const s of list) {
        const day = DAY_NAME[String(s.day || '').toLowerCase()]
        const start = normTime(s.start_time)
        if (!day || !start) continue
        byDay[day] ??= {}
        byDay[day][start] = s
    }

    const schedule = {}
    for (const day of ACADEMIC_DAYS) {
        schedule[day] = starts.map(start => {
            const s = byDay[day]?.[start]
            if (!s) return { type: 'empty', label: freeLabel }
            return {
                type:    'academic',
                subject: s.subject_name || '',
                /* The teacher already knows who is teaching: it is them. The
                   useful second line here is which class they are in front of,
                   passed as `meta` so the cell prints it as-is instead of
                   running it through the shorten-a-person's-name rule. */
                meta:    s.class_name || '',
                room:    s.room_number || '',
            }
        })
    }

    return { periods, schedule }
}
