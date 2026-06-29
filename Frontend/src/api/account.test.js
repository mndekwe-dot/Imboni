import { describe, it, expect, vi, beforeEach } from 'vitest'
import client from './client'
import {
  getProfile, updateProfile, changePassword, getPreferences, updatePreferences, uploadAvatar,
} from './account'

vi.mock('./client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

describe('account api', () => {
  beforeEach(() => vi.resetAllMocks())

  it('getProfile fetches the current profile', () => {
    getProfile()
    expect(client.get).toHaveBeenCalledWith('/imboni/account/profile/')
  })

  it('updateProfile patches profile data', () => {
    const data = { bio: 'hi' }
    updateProfile(data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/account/profile/', data)
  })

  it('changePassword posts the password payload', () => {
    const data = { old_password: 'a', new_password: 'b', confirm_password: 'b' }
    changePassword(data)
    expect(client.post).toHaveBeenCalledWith('/imboni/users/change_password/', data)
  })

  it('getPreferences fetches preferences for a given user id', () => {
    getPreferences(12)
    expect(client.get).toHaveBeenCalledWith('/imboni/users/12/preferences/')
  })

  it('updatePreferences patches preferences for a given user id', () => {
    const data = { email_alerts: false }
    updatePreferences(12, data)
    expect(client.patch).toHaveBeenCalledWith('/imboni/users/12/preferences/', data)
  })

  it('uploadAvatar sends FormData with multipart content-type', () => {
    const file = new File(['x'], 'avatar.png', { type: 'image/png' })
    uploadAvatar(file)

    expect(client.patch).toHaveBeenCalledTimes(1)
    const [url, form, config] = client.patch.mock.calls[0]
    expect(url).toBe('/imboni/account/avatar/')
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('avatar')).toBe(file)
    expect(config.headers['Content-Type']).toBe('multipart/form-data')
  })
})
