import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCurrentTerm } from './useCurrentTerm'
import { getCurrentTerm } from '../api/dos'

vi.mock('../api/dos')

describe('useCurrentTerm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('starts in a loading state with no term or error', () => {
    getCurrentTerm.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useCurrentTerm())
    expect(result.current.loading).toBe(true)
    expect(result.current.term).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('sets term and clears loading on success', async () => {
    const term = { id: 1, name: 'Term 2' }
    getCurrentTerm.mockResolvedValue(term)

    const { result } = renderHook(() => useCurrentTerm())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.term).toEqual(term)
    expect(result.current.error).toBeNull()
  })

  it('sets error message and clears loading on failure', async () => {
    getCurrentTerm.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useCurrentTerm())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('boom')
    expect(result.current.term).toBeNull()
  })
})
