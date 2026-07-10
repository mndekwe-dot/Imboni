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
    expect(result.current.setting).toEqual({ timezone: 'Africa/Kigali', school_name: '' })
  })

  it('loads settings on mount and replaces the default', async () => {
    const setting = { timezone: 'America/New_York', school_name: 'Imboni HS' }
    getSchoolSettings.mockResolvedValue(setting)

    const { result } = renderHook(() => useSchoolSettings())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.setting).toEqual(setting)
    expect(result.current.error).toBeNull()
  })

  it('sets error message and clears loading on failure', async () => {
    getSchoolSettings.mockRejectedValue(new Error('settings unavailable'))

    const { result } = renderHook(() => useSchoolSettings())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('settings unavailable')
  })
})
