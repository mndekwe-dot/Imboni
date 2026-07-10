import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from './useAuth'
import { loginUser, logoutUser } from '../api/auth'

const mockNavigate = vi.fn()

vi.mock('../api/auth')
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}))

describe('useAuth', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
  })

  it('initializes user from localStorage and isAuthenticated from access token presence', () => {
    localStorage.setItem('imboni_user', JSON.stringify({ first_name: 'A', role: 'teacher' }))
    localStorage.setItem('imboni_access', 'tok')

    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toEqual({ first_name: 'A', role: 'teacher' })
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('defaults to null user and isAuthenticated false when nothing stored', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('login stores tokens and user, updates state, and navigates', async () => {
    const data = {
      access: 'access-tok',
      refresh: 'refresh-tok',
      user: { first_name: 'Jean', role: 'dos' },
    }
    loginUser.mockResolvedValue(data)

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.login('jean@x.com', 'pw', 'dos', '/dashboard')
    })

    expect(loginUser).toHaveBeenCalledWith('jean@x.com', 'pw', 'dos')
    expect(localStorage.getItem('imboni_access')).toBe('access-tok')
    expect(localStorage.getItem('imboni_refresh')).toBe('refresh-tok')
    expect(JSON.parse(localStorage.getItem('imboni_user'))).toEqual(data.user)
    expect(result.current.user).toEqual(data.user)
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('logout clears user state and navigates to default /login', async () => {
    localStorage.setItem('imboni_refresh', 'refresh-tok')
    logoutUser.mockResolvedValue()

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.logout()
    })

    expect(logoutUser).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('logout navigates to a custom redirectTo when given', async () => {
    logoutUser.mockResolvedValue()
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.logout('/goodbye')
    })

    expect(mockNavigate).toHaveBeenCalledWith('/goodbye')
  })
})
