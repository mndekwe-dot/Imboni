import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionUser } from './useSessionUser'
import { renderHook } from '@testing-library/react'

describe('useSessionUser', () => {
  beforeEach(() => localStorage.clear())

  it('returns generic defaults when no user is stored', () => {
    const { result } = renderHook(() => useSessionUser())
    expect(result.current.userName).toBe('User')
    expect(result.current.userInitials).toBe('U')
  })

  it('derives name, role label, and initials from the stored session', () => {
    localStorage.setItem('imboni_user', JSON.stringify({
      first_name: 'Jean', last_name: 'Mugisha', role: 'teacher',
    }))

    const { result } = renderHook(() => useSessionUser())

    expect(result.current.userName).toBe('Jean Mugisha')
    expect(result.current.userRole).toBe('Teacher')
    expect(result.current.userInitials).toBe('JM')
    expect(result.current.avatarClass).toBe('teacher-av')
  })

  it('prefers full_name over first/last when present', () => {
    localStorage.setItem('imboni_user', JSON.stringify({
      full_name: 'Dr. Ndagijimana', first_name: 'X', last_name: 'Y', role: 'dos',
    }))

    const { result } = renderHook(() => useSessionUser())

    expect(result.current.userName).toBe('Dr. Ndagijimana')
  })

  it('falls back to the role label for an unrecognized role', () => {
    localStorage.setItem('imboni_user', JSON.stringify({ role: 'mystery' }))

    const { result } = renderHook(() => useSessionUser())

    expect(result.current.userRole).toBe('mystery')
  })
})
