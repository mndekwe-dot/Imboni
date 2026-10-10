import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from './useAuth'
import { loginUser, logoutUser } from '../api/auth'
import { pendingCount, clearOfflineData } from '../offline'
import { __resetSession, getAccessToken } from '../api/session'

const mockNavigate = vi.fn()

vi.mock('../api/auth')
vi.mock('../offline')
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}))

describe('useAuth', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    __resetSession()
  })

  it('initializes user from localStorage, and is authenticated when a profile is stored', () => {
    localStorage.setItem('imboni_user', JSON.stringify({ first_name: 'A', role: 'teacher' }))

    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toEqual({ first_name: 'A', role: 'teacher' })
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('defaults to null user and isAuthenticated false when nothing stored', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('login keeps the access token in memory, stores the user, updates state, and navigates', async () => {
    const data = {
      access: 'access-tok',
      user: { first_name: 'Jean', role: 'dos' },
    }
    loginUser.mockResolvedValue(data)

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.login('jean@x.com', 'pw', 'dos', '/dashboard')
    })

    expect(loginUser).toHaveBeenCalledWith('jean@x.com', 'pw', 'dos', false)
    expect(getAccessToken()).toBe('access-tok')
    // No token of either kind is written where a script could read it later.
    expect(localStorage.getItem('imboni_access')).toBeNull()
    expect(localStorage.getItem('imboni_refresh')).toBeNull()
    expect(JSON.parse(localStorage.getItem('imboni_user'))).toEqual(data.user)
    expect(result.current.user).toEqual(data.user)
    // replace: the login form must not stay in history under the portal
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true })
  })

  it('logout clears user state and navigates to default /login', async () => {
    logoutUser.mockResolvedValue()

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.logout()
    })

    expect(logoutUser).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
    // generic /login for every role, replacing the portal page in history
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('logout navigates to a custom redirectTo when given', async () => {
    logoutUser.mockResolvedValue()
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.logout('/goodbye')
    })

    expect(mockNavigate).toHaveBeenCalledWith('/goodbye', { replace: true })
  })

  it('logout still signs out and leaves the portal when the server revoke fails', async () => {
    localStorage.setItem('imboni_refresh', 'refresh-tok')
    logoutUser.mockRejectedValue(new Error('Network Error'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('wipes what was saved for offline use when somebody logs out', async () => {
    logoutUser.mockResolvedValue()
    const { result } = renderHook(() => useAuth())
    await act(async () => { await result.current.logout() })
    expect(clearOfflineData).toHaveBeenCalled()
  })

  it('stays signed in when the person backs out of discarding unsent changes', async () => {
    pendingCount.mockResolvedValue(2)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { result } = renderHook(() => useAuth())
    await act(async () => { await result.current.logout() })
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('2 change'))
    expect(logoutUser).not.toHaveBeenCalled()
    expect(clearOfflineData).not.toHaveBeenCalled()
  })

  it('logs out and discards them once the person agrees', async () => {
    pendingCount.mockResolvedValue(2)
    logoutUser.mockResolvedValue()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { result } = renderHook(() => useAuth())
    await act(async () => { await result.current.logout() })
    expect(logoutUser).toHaveBeenCalled()
    expect(clearOfflineData).toHaveBeenCalled()
  })

  it('passes "Remember me" to the sign-in, and on to the second step for a 2FA account', async () => {
    loginUser.mockResolvedValue({ requires_2fa: true, challenge: 'c1' })
    const { result } = renderHook(() => useAuth())

    let step
    await act(async () => { step = await result.current.login('a@x.com', 'pw', 'admin', '/admin', true) })

    expect(loginUser).toHaveBeenCalledWith('a@x.com', 'pw', 'admin', true)
    expect(step).toMatchObject({ requires2fa: true, challenge: 'c1', remember: true })
  })
})
