import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useSchoolConfig } from './useSchoolConfig'
import { getSchoolConfig, updateSchoolConfig } from '../api/dos'

vi.mock('../api/dos')

describe('useSchoolConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('starts with an empty config array while loading', () => {
    getSchoolConfig.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSchoolConfig())
    expect(result.current.loading).toBe(true)
    expect(result.current.config).toEqual([])
  })

  it('loads config on mount', async () => {
    const config = [{ name: 'O-Level', years: [] }]
    getSchoolConfig.mockResolvedValue(config)

    const { result } = renderHook(() => useSchoolConfig())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.config).toEqual(config)
    expect(result.current.error).toBeNull()
  })

  it('sets error message when initial load fails', async () => {
    getSchoolConfig.mockRejectedValue(new Error('failed to load'))

    const { result } = renderHook(() => useSchoolConfig())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('failed to load')
  })

  it('saveConfig updates config on success', async () => {
    getSchoolConfig.mockResolvedValue([])
    const saved = [{ name: 'A-Level', years: [] }]
    updateSchoolConfig.mockResolvedValue(saved)

    const { result } = renderHook(() => useSchoolConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.saveConfig(saved)
    })

    expect(updateSchoolConfig).toHaveBeenCalledWith(saved)
    expect(result.current.config).toEqual(saved)
  })

  it('saveConfig sets error message on failure without throwing', async () => {
    getSchoolConfig.mockResolvedValue([])
    updateSchoolConfig.mockRejectedValue(new Error('save failed'))

    const { result } = renderHook(() => useSchoolConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.saveConfig([{ name: 'X' }])
    })

    expect(result.current.error).toBe('save failed')
  })
})
