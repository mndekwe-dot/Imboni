import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSchoolSettings } from './useSchoolSetting'
import { getSchoolSettings } from '../api/dos'

vi.mock('../api/dos')

describe('useSchoolSettings', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('starts with the default timezone/school_name while loading', () => {
    getSchoolSettings.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSchoolSettings())
    expect(result.current.loading).toBe(true)
    expect(result.current.setting.timezone).toBe('Africa/Kigali')
    expect(result.current.setting.school_name).toBe('')
  })

  it('defaults to the familiar three terms until the school says otherwise', () => {
    // A school that has configured nothing must behave exactly as before.
    getSchoolSettings.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSchoolSettings())
    expect(result.current.setting.terms.map(t => t.code)).toEqual(['term1', 'term2', 'term3'])
  })

  it('loads settings on mount and replaces the default', async () => {
    const setting = { timezone: 'America/New_York', school_name: 'Imboni HS' }
    getSchoolSettings.mockResolvedValue(setting)

    const { result } = renderHook(() => useSchoolSettings())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.setting.timezone).toBe('America/New_York')
    expect(result.current.setting.school_name).toBe('Imboni HS')
    expect(result.current.error).toBeNull()
  })

  it('keeps a school its own terms when it has configured them', async () => {
    getSchoolSettings.mockResolvedValue({
      timezone: 'America/New_York',
      school_name: 'Riverside',
      terms: [
        { code: 'fall', label: 'Fall Semester', order: 1 },
        { code: 'spring', label: 'Spring Semester', order: 2 },
      ],
    })

    const { result } = renderHook(() => useSchoolSettings())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.setting.terms.map(t => t.label))
      .toEqual(['Fall Semester', 'Spring Semester'])
  })

  it('sets error message and clears loading on failure', async () => {
    getSchoolSettings.mockRejectedValue(new Error('settings unavailable'))

    const { result } = renderHook(() => useSchoolSettings())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('settings unavailable')
  })
})
