import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatSchoolDate } from './date'

describe('formatSchoolDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats the current date using the given timezone with full weekday/month', () => {
    const result = formatSchoolDate('Africa/Kigali')
    expect(result).toBe('Monday, June 29, 2026')
  })

  it('defaults to Africa/Kigali timezone when none is given', () => {
    const withDefault = formatSchoolDate()
    const withExplicit = formatSchoolDate('Africa/Kigali')
    expect(withDefault).toBe(withExplicit)
  })

  it('matches the expected shape: Weekday, Month DD, YYYY', () => {
    const result = formatSchoolDate('UTC')
    expect(result).toMatch(/^[A-Za-z]+, [A-Za-z]+ \d{2}, \d{4}$/)
  })

  it('respects a different timezone producing a valid date string', () => {
    const result = formatSchoolDate('America/New_York')
    expect(result).toMatch(/^[A-Za-z]+, [A-Za-z]+ \d{2}, \d{4}$/)
  })
})
