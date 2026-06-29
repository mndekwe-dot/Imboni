import { describe, it, expect, vi, afterEach } from 'vitest'
import { getNow, getThisMonday, formatWeekLabel, isThisWeek, getTodayDayIndex } from './dateUtils'

describe('dateUtils', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('getThisMonday returns the Monday of the current week', () => {
    // Wed, Apr 16 2026 (Rwanda time, UTC+2 -> use a UTC time safely inside the day)
    vi.setSystemTime(new Date('2026-04-16T10:00:00Z'))
    const monday = getThisMonday()
    expect(monday.getDay()).toBe(1) // Monday
    expect(monday.getDate()).toBe(13)
  })

  it('formatWeekLabel builds a "Mon D – Mon D, YYYY" label', () => {
    const monday = new Date('2026-04-13T00:00:00')
    expect(formatWeekLabel(monday)).toBe('Apr 13 – Apr 19, 2026')
  })

  it('isThisWeek is true for a date within the current week and false otherwise', () => {
    vi.setSystemTime(new Date('2026-04-16T10:00:00Z'))
    expect(isThisWeek(new Date('2026-04-14T00:00:00Z'))).toBe(true)
    expect(isThisWeek(new Date('2026-04-25T00:00:00Z'))).toBe(false)
  })

  it('getTodayDayIndex returns -1 when the given Monday is not the current week', () => {
    vi.setSystemTime(new Date('2026-04-16T10:00:00Z'))
    const otherMonday = new Date('2026-04-06T00:00:00')
    expect(getTodayDayIndex(otherMonday)).toBe(-1)
  })

  it('getTodayDayIndex maps Monday..Sunday to 0..6 for the current week', () => {
    // Wednesday Apr 15 2026 UTC -> Rwanda time (UTC+2) is still Apr 15 Wed in the afternoon
    vi.setSystemTime(new Date('2026-04-15T10:00:00Z'))
    const monday = getThisMonday()
    expect(getTodayDayIndex(monday)).toBe(2) // Wed = index 2
  })

  it('getNow returns a Date object', () => {
    expect(getNow()).toBeInstanceOf(Date)
  })
})
