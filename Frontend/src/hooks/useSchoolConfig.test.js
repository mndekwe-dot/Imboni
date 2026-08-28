import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useSchoolConfig, resetSchoolConfigCache } from './useSchoolConfig'
import { getSchoolConfig, updateSchoolConfig } from '../api/dos'

vi.mock('../api/dos')

describe('useSchoolConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // The structure is cached at module scope so a page and the <ClassPicker>
    // inside it do not each fetch it. Tests must start from cold.
    resetSchoolConfigCache()
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

    expect(updateSchoolConfig).toHaveBeenCalledWith(saved, { confirm: false })
    expect(result.current.config).toEqual(saved)
  })

  it('saveConfig records the error AND rethrows it', async () => {
    // It used to swallow the failure, so the caller's catch never ran and a
    // failed save looked exactly like a successful one.
    getSchoolConfig.mockResolvedValue([])
    updateSchoolConfig.mockRejectedValue(new Error('save failed'))

    const { result } = renderHook(() => useSchoolConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(result.current.saveConfig([{ name: 'X' }])).rejects.toThrow('save failed')
    })

    expect(result.current.error).toBe('save failed')
  })

  it('saveConfig passes the confirmation flag through', async () => {
    getSchoolConfig.mockResolvedValue([])
    updateSchoolConfig.mockResolvedValue([])

    const { result } = renderHook(() => useSchoolConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.saveConfig([], { confirm: true })
    })

    expect(updateSchoolConfig).toHaveBeenCalledWith([], { confirm: true })
  })

  /* The cache is what makes <ClassPicker> able to read the school
     configuration itself without doubling every page's requests. */
  it('fetches once and serves later callers from the cache', async () => {
    getSchoolConfig.mockResolvedValue([{ name: 'O-Level', years: [] }])

    const first = renderHook(() => useSchoolConfig())
    await waitFor(() => expect(first.result.current.loading).toBe(false))

    const second = renderHook(() => useSchoolConfig())
    expect(second.result.current.config).toEqual([{ name: 'O-Level', years: [] }])
    expect(second.result.current.loading).toBe(false)
    expect(getSchoolConfig).toHaveBeenCalledTimes(1)
  })

  it('collapses two mounts in the same tick into one request', async () => {
    getSchoolConfig.mockResolvedValue([])
    renderHook(() => useSchoolConfig())
    renderHook(() => useSchoolConfig())
    await waitFor(() => expect(getSchoolConfig).toHaveBeenCalledTimes(1))
  })

  /* A failed load must not be cached, or one bad response locks every picker
     in the session into an empty list. */
  it('retries after a failed load rather than caching the failure', async () => {
    getSchoolConfig.mockRejectedValueOnce(new Error('offline'))
    const first = renderHook(() => useSchoolConfig())
    await waitFor(() => expect(first.result.current.error).toBe('offline'))

    getSchoolConfig.mockResolvedValue([{ name: 'A-Level', years: [] }])
    const second = renderHook(() => useSchoolConfig())
    await waitFor(() => expect(second.result.current.config).toEqual([{ name: 'A-Level', years: [] }]))
    expect(getSchoolConfig).toHaveBeenCalledTimes(2)
  })

  it('saveConfig refills the cache so other pickers see the new structure', async () => {
    getSchoolConfig.mockResolvedValue([])
    const saved = [{ name: 'A-Level', years: [] }]
    updateSchoolConfig.mockResolvedValue(saved)

    const settings = renderHook(() => useSchoolConfig())
    await waitFor(() => expect(settings.result.current.loading).toBe(false))
    await act(async () => { await settings.result.current.saveConfig(saved) })

    const picker = renderHook(() => useSchoolConfig())
    expect(picker.result.current.config).toEqual(saved)
    expect(getSchoolConfig).toHaveBeenCalledTimes(1)
  })
})
