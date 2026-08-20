import { describe, it, expect } from 'vitest'
import {
    assignSubjectTones, shortTeacher, homeRoomOf, parsePeriodTimes, currentPeriodIndex, TONE_COUNT,
} from './timetableDisplay'

describe('assignSubjectTones', () => {
    it('gives every distinct subject its own tone when they fit the palette', () => {
        const subjects = ['Mathematics', 'English', 'Chemistry', 'History', 'Geography', 'Physics', 'Biology', 'C.R.E']
        const tones = assignSubjectTones(subjects)
        expect(tones.size).toBe(8)
        expect(new Set(tones.values()).size).toBe(8)   // no two subjects share a tone
    })

    it('keeps tones inside the range the stylesheet defines', () => {
        const tones = assignSubjectTones(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'])
        for (const tone of tones.values()) {
            expect(tone).toBeGreaterThanOrEqual(1)
            expect(tone).toBeLessThanOrEqual(TONE_COUNT)
        }
    })

    it('is stable regardless of the order the cells were read in', () => {
        const a = assignSubjectTones(['Physics', 'Biology', 'Mathematics'])
        const b = assignSubjectTones(['Mathematics', 'Physics', 'Biology', 'Physics'])
        expect(a.get('Physics')).toBe(b.get('Physics'))
        expect(a.get('Biology')).toBe(b.get('Biology'))
    })

    it('treats punctuation and case as the same subject', () => {
        const tones = assignSubjectTones(['C.R.E'])
        const other = assignSubjectTones(['cre'])
        expect(tones.get('C.R.E')).toBe(other.get('cre'))
    })

    it('ignores null and empty entries from break rows', () => {
        expect(assignSubjectTones([null, '', 'Physics', undefined]).size).toBe(1)
    })
})

describe('shortTeacher', () => {
    it('abbreviates the first name after a recognised title', () => {
        expect(shortTeacher('Mr. Pacifique Rurangwa')).toBe('Mr. P. Rurangwa')
        expect(shortTeacher('Dr. Immaculée Nsabimana')).toBe('Dr. I. Nsabimana')
    })

    it('abbreviates every middle name', () => {
        expect(shortTeacher('Ms. Claudine Marie Umutoni')).toBe('Ms. C. M. Umutoni')
    })

    it('leaves group names alone — they have no title to key off', () => {
        expect(shortTeacher('All Matrons')).toBe('All Matrons')
        expect(shortTeacher('Duty Staff')).toBe('Duty Staff')
        expect(shortTeacher('Sports Department Team')).toBe('Sports Department Team')
    })

    it('leaves a name that is already short alone', () => {
        expect(shortTeacher('Mr. X')).toBe('Mr. X')
    })

    it('passes empty values straight through', () => {
        expect(shortTeacher('')).toBe('')
        expect(shortTeacher(undefined)).toBe(undefined)
    })
})

describe('homeRoomOf', () => {
    it('finds the room a class uses for most of its lessons', () => {
        const schedule = {
            Monday: [{ room: 'Room 12' }, { room: 'Room 12' }, { room: 'Lab 1' }],
            Tuesday: [{ room: 'Room 12' }, { room: 'Lab 2' }, { room: 'Room 12' }],
        }
        expect(homeRoomOf(schedule)).toBe('Room 12')
    })

    it('returns null when no room holds a strict majority', () => {
        const schedule = { Monday: [{ room: 'Room 12' }, { room: 'Room 12' }, { room: 'Lab 1' }, { room: 'Lab 2' }] }
        expect(homeRoomOf(schedule)).toBeNull()
    })

    it('does not count break or empty slots', () => {
        const schedule = {
            Monday: [{ room: 'Room 12' }, { type: 'break', room: 'x' }, { type: 'empty' }, null],
        }
        expect(homeRoomOf(schedule)).toBe('Room 12')
    })

    it('returns null for an empty or missing schedule', () => {
        expect(homeRoomOf(null)).toBeNull()
        expect(homeRoomOf({})).toBeNull()
        expect(homeRoomOf({ Monday: [null, null] })).toBeNull()
    })
})

describe('parsePeriodTimes', () => {
    it('reads afternoon periods as afternoon despite the 12-hour labels', () => {
        // Periods 7 and 8 read "2:00" and "2:40" but run after lunch.
        const periods = [
            { time: '8:00 - 8:40' },
            { time: '11:40 - 12:20' },
            { time: '2:00 - 2:40' },
            { time: '2:40 - 3:20' },
        ]
        const times = parsePeriodTimes(periods)
        expect(times[0].start).toBe(8 * 60)
        expect(times[1].start).toBe(11 * 60 + 40)
        expect(times[2].start).toBe(14 * 60)
        expect(times[3].start).toBe(14 * 60 + 40)
    })

    it('yields null for a period with no parsable time', () => {
        expect(parsePeriodTimes([{ time: '' }, { label: 'Break' }])).toEqual([null, null])
    })
})

describe('currentPeriodIndex', () => {
    const periods = [
        { time: '8:00 - 8:40' },
        { time: '8:40 - 9:20' },
        { time: '2:00 - 2:40' },
    ]

    it('finds the period containing the given time', () => {
        expect(currentPeriodIndex(periods, 8 * 60 + 10)).toBe(0)
        expect(currentPeriodIndex(periods, 9 * 60)).toBe(1)
        expect(currentPeriodIndex(periods, 14 * 60 + 30)).toBe(2)
    })

    it('is inclusive of the start and exclusive of the end', () => {
        expect(currentPeriodIndex(periods, 8 * 60)).toBe(0)
        expect(currentPeriodIndex(periods, 8 * 60 + 40)).toBe(1)
    })

    it('returns -1 outside the school day', () => {
        expect(currentPeriodIndex(periods, 6 * 60)).toBe(-1)
        expect(currentPeriodIndex(periods, 20 * 60)).toBe(-1)
    })
})
