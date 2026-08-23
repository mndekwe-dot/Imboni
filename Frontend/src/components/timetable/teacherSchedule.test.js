import { describe, it, expect } from 'vitest'
import { teacherSlotsToSchedule, normTime, fmtTime } from './teacherSchedule'

const SLOTS = [
    { day: 'monday',  start_time: '08:00:00', end_time: '09:00:00', subject_name: 'Mathematics', class_name: 'S4A', room_number: 'Room 12' },
    { day: 'tuesday', start_time: '08:00:00', end_time: '09:00:00', subject_name: 'English',     class_name: 'S4B', room_number: 'Room 5'  },
]

describe('normTime', () => {
    it('trims seconds off a time the API sent in full', () => {
        expect(normTime('08:00:00')).toBe('08:00')
    })

    it('leaves a time that is already short alone', () => {
        expect(normTime('08:00')).toBe('08:00')
    })

    it('returns empty rather than throwing on a missing time', () => {
        expect(normTime(null)).toBe('')
        expect(normTime(undefined)).toBe('')
    })
})

describe('fmtTime', () => {
    it('renders on the 12-hour clock the static timetables already use', () => {
        // No meridiem, to match "8:00 - 8:40" / "2:00 - 2:40" in the static
        // data - the period column is sized for exactly that width.
        expect(fmtTime('08:00')).toBe('8:00')
        expect(fmtTime('14:30')).toBe('2:30')
    })

    it('gets the two hours the 12-hour clock always gets wrong', () => {
        // Midnight and noon are both "12", never "0".
        expect(fmtTime('00:15')).toBe('12:15')
        expect(fmtTime('12:05')).toBe('12:05')
    })

    it('returns empty for a time it cannot read', () => {
        expect(fmtTime('')).toBe('')
        expect(fmtTime('not a time')).toBe('')
    })
})

describe('teacherSlotsToSchedule', () => {
    it('makes one period row per distinct start time', () => {
        // Both lessons start at 08:00, so they share a row - a teacher does not
        // have two first periods just because they teach two classes.
        const { periods } = teacherSlotsToSchedule(SLOTS)

        expect(periods).toHaveLength(1)
        expect(periods[0]).toMatchObject({ label: 'Period 1', time: '8:00 - 9:00' })
    })

    it('orders rows by the clock, not by the order the API sent them', () => {
        const { periods } = teacherSlotsToSchedule([
            { day: 'monday', start_time: '14:00', end_time: '15:00', subject_name: 'Art'     },
            { day: 'monday', start_time: '08:00', end_time: '09:00', subject_name: 'Maths'   },
            { day: 'monday', start_time: '10:00', end_time: '11:00', subject_name: 'Biology' },
        ])

        expect(periods.map(p => p.label)).toEqual(['Period 1', 'Period 2', 'Period 3'])
        expect(periods.map(p => p.time)).toEqual([
            '8:00 - 9:00', '10:00 - 11:00', '2:00 - 3:00',
        ])
    })

    it('files each lesson under its own capitalised day', () => {
        const { schedule } = teacherSlotsToSchedule(SLOTS)

        expect(schedule.Monday[0]).toMatchObject({ subject: 'Mathematics', meta: 'S4A', room: 'Room 12' })
        expect(schedule.Tuesday[0]).toMatchObject({ subject: 'English',     meta: 'S4B', room: 'Room 5'  })
    })

    it('puts the class on the second line, not the teacher', () => {
        /* The whole grid is this teacher's own week, so naming them in every
           cell says nothing. Which class they are in front of does. */
        const { schedule } = teacherSlotsToSchedule(SLOTS)

        expect(schedule.Monday[0].meta).toBe('S4A')
        expect(schedule.Monday[0].teacher).toBeUndefined()
    })

    it('marks an unfilled slot free rather than blank', () => {
        // Nothing on Wednesday at 08:00 - for a teacher that is a free period,
        // which is information, not a gap in the data.
        const { schedule } = teacherSlotsToSchedule(SLOTS, { freeLabel: 'Free' })

        expect(schedule.Wednesday[0]).toEqual({ type: 'empty', label: 'Free' })
    })

    it('gives every weekday a row of the same length', () => {
        /* The grid renders Mon-Sat and indexes cells by period, so a short day
           array would silently drop columns. */
        const { periods, schedule } = teacherSlotsToSchedule(SLOTS)

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        expect(Object.keys(schedule)).toEqual(days)
        for (const day of days) {
            expect(schedule[day]).toHaveLength(periods.length)
        }
    })

    it('leaves Sunday out, as the academic grid does', () => {
        const { schedule } = teacherSlotsToSchedule([
            ...SLOTS,
            { day: 'sunday', start_time: '08:00', end_time: '09:00', subject_name: 'Chapel' },
        ])

        expect(schedule.Sunday).toBeUndefined()
    })

    it('returns an empty timetable rather than throwing on no data', () => {
        for (const input of [[], null, undefined]) {
            const { periods, schedule } = teacherSlotsToSchedule(input)
            expect(periods).toEqual([])
            expect(schedule.Monday).toEqual([])
        }
    })

    it('skips a row the API sent without a usable day or time', () => {
        /* One malformed row must not take the whole timetable down with it. */
        const { periods, schedule } = teacherSlotsToSchedule([
            ...SLOTS,
            { day: 'someday', start_time: '09:00', subject_name: 'Nonsense' },
            { day: 'monday',  start_time: null,    subject_name: 'Nonsense' },
        ])

        expect(periods).toHaveLength(2)          // 08:00 and the orphan 09:00 row
        expect(schedule.Monday[1]).toEqual({ type: 'empty', label: 'Free' })
    })

    it('fills missing subject, class and room with empty strings', () => {
        // The cell renders these directly; undefined would print "undefined".
        const { schedule } = teacherSlotsToSchedule([{ day: 'monday', start_time: '08:00', end_time: '09:00' }])

        expect(schedule.Monday[0]).toEqual({ type: 'academic', subject: '', meta: '', room: '' })
    })
})
