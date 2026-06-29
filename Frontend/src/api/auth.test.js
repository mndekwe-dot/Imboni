import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import client from './client'
import {
  loginUser, logoutUser, requestPasswordReset, confirmPasswordReset,
  sendInvitation, verifyInvitation, completeRegistration,
  getInvitations, resendInvitation, cancelInvitation,
} from './auth'

vi.mock('axios')
vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

const BASE = 'http://localhost:8000'

describe('auth api', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
  })

  describe('loginUser', () => {
    it('posts credentials via plain axios and returns response data', async () => {
      axios.post.mockResolvedValue({ data: { access: 'a', refresh: 'r', user: {} } })

      const result = await loginUser('a@b.com', 'pw', 'teacher')

      expect(axios.post).toHaveBeenCalledWith(`${BASE}/imboni/auth/login/`, {
        email: 'a@b.com', password: 'pw', portal: 'teacher',
      })
      expect(result).toEqual({ access: 'a', refresh: 'r', user: {} })
    })

    it('throws the backend error message on failure', async () => {
      axios.post.mockRejectedValue({ response: { data: { error: 'Invalid credentials' } } })

      await expect(loginUser('a@b.com', 'wrong', 'teacher')).rejects.toThrow('Invalid credentials')
    })

    it('falls back to detail then generic message', async () => {
      axios.post.mockRejectedValue({ response: { data: { detail: 'Account locked' } } })
      await expect(loginUser('a@b.com', 'wrong', 'teacher')).rejects.toThrow('Account locked')

      axios.post.mockRejectedValue({ response: {} })
      await expect(loginUser('a@b.com', 'wrong', 'teacher')).rejects.toThrow('Something went wrong')
    })
  })

  describe('logoutUser', () => {
    it('does nothing when no refresh token is stored', async () => {
      await logoutUser()
      expect(client.post).not.toHaveBeenCalled()
    })

    it('posts the refresh token and clears session storage on success', async () => {
      localStorage.setItem('imboni_refresh', 'r-tok')
      localStorage.setItem('imboni_access', 'a-tok')
      localStorage.setItem('imboni_user', '{}')
      client.post.mockResolvedValue({})

      await logoutUser()

      expect(client.post).toHaveBeenCalledWith('/imboni/auth/logout/', { refresh: 'r-tok' })
      expect(localStorage.getItem('imboni_access')).toBeNull()
      expect(localStorage.getItem('imboni_refresh')).toBeNull()
      expect(localStorage.getItem('imboni_user')).toBeNull()
    })
  })

  it('requestPasswordReset posts the email via plain axios', () => {
    requestPasswordReset('a@b.com')
    expect(axios.post).toHaveBeenCalledWith(`${BASE}/imboni/auth/password-reset/`, { email: 'a@b.com' })
  })

  describe('confirmPasswordReset', () => {
    it('posts uid/token/new_password and returns data', async () => {
      axios.post.mockResolvedValue({ data: { success: true } })

      const result = await confirmPasswordReset('uid1', 'tok1', 'newpw')

      expect(axios.post).toHaveBeenCalledWith(`${BASE}/imboni/auth/password-reset/confirm/`, {
        uid: 'uid1', token: 'tok1', new_password: 'newpw',
      })
      expect(result).toEqual({ success: true })
    })

    it('throws backend error message on failure', async () => {
      axios.post.mockRejectedValue({ response: { data: { error: 'Invalid token' } } })
      await expect(confirmPasswordReset('uid1', 'bad', 'pw')).rejects.toThrow('Invalid token')
    })
  })

  it('sendInvitation posts via client (authenticated)', () => {
    const data = { email: 'invitee@b.com' }
    sendInvitation(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/auth/invite/', data)
  })

  it('verifyInvitation gets the public verification link via plain axios', () => {
    verifyInvitation('uid1', 'tok1')
    expect(axios.get).toHaveBeenCalledWith(`${BASE}/imboni/auth/register/verify/uid1/tok1/`)
  })

  it('completeRegistration posts via plain axios', () => {
    const data = { password: 'pw' }
    completeRegistration(data)
    expect(axios.post).toHaveBeenCalledWith(`${BASE}/imboni/auth/register/complete/`, data)
  })

  it('getInvitations fetches the invite list via client', () => {
    getInvitations()
    expect(client.get).toHaveBeenCalledWith('/imboni/auth/invite/list/')
  })

  it('resendInvitation posts to the resend endpoint via client', () => {
    resendInvitation(7)
    expect(client.post).toHaveBeenCalledWith('/imboni/auth/invite/resend/7/')
  })

  it('cancelInvitation deletes via client', () => {
    cancelInvitation(7)
    expect(client.delete).toHaveBeenCalledWith('/imboni/auth/invite/7/cancel/')
  })
})
