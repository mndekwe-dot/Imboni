/**
 * Pure display helpers for the timetable grid.
 *
 * All of these exist to cut noise out of a very dense table: 6 day columns x 9
 * period rows, every cell carrying a subject, a teacher and a room. Kept
 * separate from the components so each rule can be tested on its own.
 */

/* How many subject tones timetable.css defines (.tt-tone-1 … .tt-tone-N). */
export const TONE_COUNT = 10

/* Stable, order-independent hash so a subject keeps the same tone between
   renders, between classes and between sessions. Punctuation and case are
   stripped first so "C.R.E" and "CRE" are one subject, not two. */
function hashSubject(subject) {
    const key = String(subject).toLowerCase().replace(/[^a-z0-9]/g, '')
    let h = 0
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
    return h
}

/**
 * Map every distinct subject in a timetable to a tone number (1…TONE_COUNT).
 *
 * The hash alone would let two subjects in the same grid land on one tone,
 * which defeats the whole point of colouring them — so a collision walks to the
 * next free tone. Iterating a sorted list keeps the result deterministic no
 * matter what order the cells were read in.
 *
 * With more subjects than tones the palette necessarily repeats; the subject
 * name is always printed in the cell, so colour is a shortcut, never the only
 * thing distinguishing two lessons.
 */
export function assignSubjectTones(subjects) {
    const taken = new Set()
    const tones = new Map()
    for (const subject of [...new Set(subjects.filter(Boolean))].sort()) {
        let tone = hashSubject(subject) % TONE_COUNT
        for (let i = 0; i < TONE_COUNT && taken.has(tone); i++) {
            tone = (tone + 1) % TONE_COUNT
        }
        taken.add(tone)
        tones.set(subject, tone + 1)
    }
    return tones
}

/* Titles that mark the following word as a first name rather than a surname. */
const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'fr', 'sr', 'rev', 'mme', 'mlle'])

/**
 * "Mr. Pacifique Rurangwa" → "Mr. P. Rurangwa".
 *
 * Full names are the widest thing in a cell and they repeat down the column.
 * Only names that start with a recognised title are touched — that keeps
 * group names like "All Matrons" and "Duty Staff" intact, which would
 * otherwise be mangled into "A. Matrons".
 */
export function shortTeacher(name) {
    if (!name) return name
    const parts = String(name).trim().split(/\s+/)
    if (parts.length < 3) return name
    if (!TITLES.has(parts[0].replace(/\.$/, '').toLowerCase())) return name
    const initials = parts.slice(1, -1).map(p => `${p[0].toUpperCase()}.`).join(' ')
    return `${parts[0]} ${initials} ${parts[parts.length - 1]}`
}

/**
 * The room a class sits in for most of its lessons, or null when it has no
 * clear base. Printing "Room 12" in 25 of 30 cells says nothing; printing only
 * "Lab 1" and "Lab 2" says exactly where the week differs.
 *
 * Requires a strict majority: a class that genuinely rotates between rooms has
 * no home room, and suppressing its most frequent one would hide real
 * information rather than reveal it.
 */
export function homeRoomOf(schedule) {
    if (!schedule) return null
    const counts = new Map()
    let total = 0
    for (const day of Object.values(schedule)) {
        if (!Array.isArray(day)) continue
        for (const cell of day) {
            if (!cell || cell.type === 'break' || cell.type === 'empty' || !cell.room) continue
            counts.set(cell.room, (counts.get(cell.room) || 0) + 1)
            total++
        }
    }
    if (!total) return null
    const [room, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    return count * 2 > total ? room : null
}

/**
 * Turn each period's "8:00 - 8:40" label into minutes past midnight.
 *
 * The stored times are 12-hour with no am/pm, so period 7 reads "2:00 - 2:40"
 * and would parse as two in the morning. Periods run in order, so any start
 * that lands before the previous one is an afternoon time and gets 12 hours
 * added — self-correcting, with no am/pm data to rely on.
 */
export function parsePeriodTimes(periods) {
    let previousStart = -1
    return periods.map(period => {
        const match = String(period?.time || '')
            .match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
        if (!match) return null
        const [, h1, m1, mer1, h2, m2, mer2] = match

        /* A written AM/PM is an answer, not a hint — when it is there, use it
           and skip the roll-forward guesswork below entirely. The static
           timetables write "2:00 - 2:40" meaning the afternoon and rely on
           that guesswork; the teacher's own timetable comes from the clock and
           says "2:00 PM" outright. Both have to land on the same minute. */
        let start = toMinutes(h1, m1, mer1)
        let end   = toMinutes(h2, m2, mer2 || mer1)

        if (!mer1) {
            /* 12-hour with no meridiem: a period can only start later in the
               day than the one above it, so a start that goes backwards must
               have crossed noon. */
            while (start < previousStart) { start += 720; end += 720 }
            if (end < start) end += 720
        }
        previousStart = start
        return { start, end }
    })
}

/* Hours and minutes to minutes-since-midnight, honouring a meridiem if given.
   12 AM is midnight and 12 PM is noon — the one case where the arithmetic is
   not simply "add twelve hours for PM". */
function toMinutes(h, m, meridiem) {
    let hour = Number(h)
    if (meridiem) {
        const pm = meridiem.toUpperCase() === 'PM'
        if (pm && hour !== 12) hour += 12
        if (!pm && hour === 12) hour = 0
    }
    return hour * 60 + Number(m)
}

/**
 * Index of the period happening at `nowMinutes` (minutes past midnight), or -1
 * outside the school day. Callers pass the time in so this stays pure.
 */
export function currentPeriodIndex(periods, nowMinutes) {
    const times = parsePeriodTimes(periods)
    return times.findIndex(t => t && nowMinutes >= t.start && nowMinutes < t.end)
}
