import { describe, it, expect } from 'vitest'
import {
  classesFromConfig, yearsFromConfig, streamsForYear, allStreams,
  classLabel, yearLabel,
} from './classes'

describe('classesFromConfig', () => {
  it('flattens sections/years/streams into class names', () => {
    const sections = [
      { name: 'O-Level', years: [{ name: 'S1', streams: ['A', 'B'] }] },
    ]
    expect(classesFromConfig(sections)).toEqual(['S1A', 'S1B'])
  })

  it('handles multiple years and sections', () => {
    const sections = [
      { name: 'O-Level', years: [
        { name: 'S1', streams: ['A'] },
        { name: 'S2', streams: ['A', 'B'] },
      ] },
      { name: 'A-Level', years: [{ name: 'S5', streams: ['Sci'] }] },
    ]
    expect(classesFromConfig(sections)).toEqual(['S1A', 'S2A', 'S2B', 'S5Sci'])
  })

  it('returns an empty array for no input', () => {
    expect(classesFromConfig()).toEqual([])
    expect(classesFromConfig([])).toEqual([])
  })
})

describe('yearsFromConfig', () => {
  it('returns unique year names across sections', () => {
    const sections = [
      { name: 'O-Level', years: [{ name: 'S1', streams: ['A'] }, { name: 'S2', streams: ['A'] }] },
      { name: 'A-Level', years: [{ name: 'S5', streams: ['A'] }] },
    ]
    expect(yearsFromConfig(sections)).toEqual(['S1', 'S2', 'S5'])
  })

  it('deduplicates repeated year names', () => {
    const sections = [
      { name: 'A', years: [{ name: 'S1', streams: ['A'] }] },
      { name: 'B', years: [{ name: 'S1', streams: ['B'] }] },
    ]
    expect(yearsFromConfig(sections)).toEqual(['S1'])
  })

  it('returns an empty array for no input', () => {
    expect(yearsFromConfig()).toEqual([])
  })
})

describe('streamsForYear', () => {
  const sections = [
    { name: 'O-Level', years: [{ name: 'S1', streams: ['A', 'B'] }] },
    { name: 'A-Level', years: [{ name: 'S4', streams: ['MPG', 'PCB'] }] },
  ]

  it('returns the streams of that year only', () => {
    // Streams are per-year: an A-Level combination is not a stream in S1.
    expect(streamsForYear(sections, 'S1')).toEqual(['A', 'B'])
    expect(streamsForYear(sections, 'S4')).toEqual(['MPG', 'PCB'])
  })

  it('falls back to the section streams when the year has none', () => {
    const flat = [{ name: 'Primary', streams: ['Red'], years: [{ name: 'P1' }] }]
    expect(streamsForYear(flat, 'P1')).toEqual(['Red'])
  })

  it('returns an empty array for an unknown year', () => {
    expect(streamsForYear(sections, 'P3')).toEqual([])
    expect(streamsForYear(undefined, 'S1')).toEqual([])
  })
})

describe('allStreams', () => {
  it('collects every stream once', () => {
    const sections = [
      { name: 'A', years: [{ name: 'S1', streams: ['A', 'B'] }, { name: 'S2', streams: ['B'] }] },
    ]
    expect(allStreams(sections)).toEqual(['A', 'B'])
  })

  it('handles a school whose streams are not single letters', () => {
    const sections = [{ name: 'Primary', years: [{ name: 'P1', streams: ['Red', 'Blue'] }] }]
    expect(allStreams(sections)).toEqual(['Red', 'Blue'])
  })
})

describe('classLabel', () => {
  it('prefers the class own name', () => {
    expect(classLabel('P3', 'Red', 'Sunflower')).toBe('Sunflower')
  })

  it('falls back to year plus stream', () => {
    expect(classLabel('S3', 'A')).toBe('S3A')
    expect(classLabel('P3', 'Red', '   ')).toBe('P3Red')
  })

  it('adds no prefix of its own', () => {
    // The stored code says what it is. Prefixing produced 'SS3' and 'Grade S3A'.
    expect(classLabel('S3', 'A')).not.toContain('SS')
    expect(classLabel('P3', 'Red')).toBe('P3Red')
  })

  it('tolerates missing parts', () => {
    expect(classLabel('S3')).toBe('S3')
    expect(classLabel()).toBe('')
  })
})

describe('yearLabel', () => {
  it('returns the code unchanged', () => {
    expect(yearLabel('S3')).toBe('S3')
    expect(yearLabel('P3')).toBe('P3')
  })

  it('returns an empty string for nothing', () => {
    expect(yearLabel(null)).toBe('')
    expect(yearLabel(undefined)).toBe('')
  })
})
