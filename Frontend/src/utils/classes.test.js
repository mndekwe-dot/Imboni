import { describe, it, expect } from 'vitest'
import { classesFromConfig, yearsFromConfig } from './classes'

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
