import { describe, it, expect } from 'vitest'
import { isSameDay } from 'date-fns'
import { formatDateWithWeekday } from '../../utils/date'
import {
    allDaysFor, visibleDaysFor, snapToVisible, step, rangeLabel, isAtToday, shadedRange,
    dayIndexOf, mondayOf,
} from './timetableNav'

// Local dates, so the arithmetic under test is not shifted by a timezone.
const d = (y, m, day) => new Date(y, m - 1, day)
const ACADEMIC = [0, 1, 2, 3, 4, 5]
const WEEKDAYS = [0, 1, 2, 3, 4]
const ALL      = [0, 1, 2, 3, 4, 5, 6]

describe('which days a timetable shows', () => {
    it('gives the academic week Mon–Sat and the boarding routine all seven days', () => {
        expect(allDaysFor('academic')).toEqual(ACADEMIC)
        expect(allDaysFor('teacher')).toEqual(ACADEMIC)
        expect(allDaysFor('extracurricular')).toEqual(ALL)
    })

    it('drops Saturday and Sunday when weekends are hidden, for both grids', () => {
        expect(visibleDaysFor('academic', false)).toEqual(WEEKDAYS)
        expect(visibleDaysFor('extracurricular', false)).toEqual(WEEKDAYS)
        expect(visibleDaysFor('academic', true)).toEqual(ACADEMIC)
    })

    it('numbers days from Monday, not Sunday', () => {
        expect(dayIndexOf(d(2026, 9, 14))).toBe(0)   // Monday
        expect(dayIndexOf(d(2026, 9, 20))).toBe(6)   // Sunday
        expect(isSameDay(mondayOf(d(2026, 9, 20)), d(2026, 9, 14))).toBe(true)
    })
})

describe('snapToVisible', () => {
    it('leaves a day the grid shows alone', () => {
        expect(isSameDay(snapToVisible(d(2026, 9, 16), ACADEMIC), d(2026, 9, 16))).toBe(true)
    })

    it('moves Sunday on the academic grid forward to Monday', () => {
        expect(isSameDay(snapToVisible(d(2026, 9, 20), ACADEMIC, 1), d(2026, 9, 21))).toBe(true)
    })

    it('moves a hidden Saturday back to Friday when stepping backwards', () => {
        expect(isSameDay(snapToVisible(d(2026, 9, 19), WEEKDAYS, -1), d(2026, 9, 18))).toBe(true)
    })
})

describe('step', () => {
    it('moves a whole week in Week and Schedule view', () => {
        expect(isSameDay(step(d(2026, 9, 16), 'week', ACADEMIC, 1), d(2026, 9, 23))).toBe(true)
        expect(isSameDay(step(d(2026, 9, 16), 'schedule', ACADEMIC, -1), d(2026, 9, 9))).toBe(true)
    })

    it('in Day view goes from Saturday straight to Monday, skipping the academic Sunday', () => {
        expect(isSameDay(step(d(2026, 9, 19), 'day', ACADEMIC, 1), d(2026, 9, 21))).toBe(true)
    })

    it('in Day view with weekends hidden goes from Monday back to Friday', () => {
        expect(isSameDay(step(d(2026, 9, 21), 'day', WEEKDAYS, -1), d(2026, 9, 18))).toBe(true)
    })
})

describe('rangeLabel', () => {
    it('labels the days actually on screen, not the calendar week', () => {
        // Mon–Sat, so it ends on the 19th rather than Sunday the 20th.
        expect(rangeLabel(d(2026, 9, 16), 'week', ACADEMIC, formatDateWithWeekday))
            .toBe('Sep 14 – Sep 19, 2026')
        expect(rangeLabel(d(2026, 9, 16), 'week', WEEKDAYS, formatDateWithWeekday))
            .toBe('Sep 14 – Sep 18, 2026')
    })

    it('gives both ends a year when the week crosses New Year', () => {
        expect(rangeLabel(d(2025, 12, 31), 'week', WEEKDAYS, formatDateWithWeekday))
            .toBe('Dec 29, 2025 – Jan 2, 2026')
    })

    it('names the single day in Day view', () => {
        expect(rangeLabel(d(2026, 9, 14), 'day', ACADEMIC, formatDateWithWeekday))
            .toBe('Monday, September 14, 2026')
    })
})

describe('isAtToday', () => {
    const now = d(2026, 9, 16)   // a Wednesday

    it('is true anywhere in the current week for Week view', () => {
        expect(isAtToday(d(2026, 9, 14), 'week', ACADEMIC, now)).toBe(true)
        expect(isAtToday(d(2026, 9, 21), 'week', ACADEMIC, now)).toBe(false)
    })

    it('needs the exact day in Day view', () => {
        expect(isAtToday(d(2026, 9, 16), 'day', ACADEMIC, now)).toBe(true)
        expect(isAtToday(d(2026, 9, 15), 'day', ACADEMIC, now)).toBe(false)
    })

    it('treats a Sunday "today" as the Monday the grid would open on', () => {
        const sunday = d(2026, 9, 20)
        expect(isAtToday(d(2026, 9, 21), 'day', ACADEMIC, sunday)).toBe(true)
    })
})

describe('shadedRange', () => {
    it('covers the visible days through the end of the last one', () => {
        const r = shadedRange(d(2026, 9, 16), 'week', WEEKDAYS)
        expect(isSameDay(r.start, d(2026, 9, 14))).toBe(true)
        expect(isSameDay(r.end, d(2026, 9, 18))).toBe(true)
        expect(r.end.getHours()).toBe(23)
    })

    it('shades nothing in Day view', () => {
        expect(shadedRange(d(2026, 9, 16), 'day', WEEKDAYS)).toBeNull()
    })
})
