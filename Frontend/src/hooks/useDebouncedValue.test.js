import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts with the value it is given, so the first load does not wait', () => {
    const { result } = renderHook(() => useDebouncedValue('abc', 300))
    expect(result.current).toBe('abc')
  })

  it('holds the old value until typing pauses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: '' } })
    rerender({ v: 'a' })
    act(() => { vi.advanceTimersByTime(299) })
    expect(result.current).toBe('')
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBe('a')
  })

  it('restarts the wait on every keystroke, so a burst is one change', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: '' } })
    for (const v of ['a', 'am', 'ami', 'amin', 'amina']) {
      rerender({ v })
      act(() => { vi.advanceTimersByTime(200) })
    }
    expect(result.current).toBe('')            // never paused long enough yet
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('amina')
  })

  it('does not set state after it unmounts', () => {
    const { rerender, unmount } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: '' } })
    rerender({ v: 'x' })
    unmount()
    expect(() => act(() => { vi.advanceTimersByTime(500) })).not.toThrow()
  })
})
