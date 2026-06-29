import { describe, it, expect, vi, beforeEach } from 'vitest'

// client.js calls axios.create() once at import time and registers its
// request/response interceptors on the returned instance. To test the
// interceptor logic directly (without a real network layer), mock axios so
// create() returns a controllable fake instance, then pull the registered
// interceptor functions out of the `.use()` mock calls and invoke them by hand.
function buildMockAxiosInstance() {
  const instance = vi.fn(config => instance._retryResponse ?? Promise.resolve({ data: 'retried' }))
  instance.interceptors = {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  }
  instance.defaults = { headers: { common: {} } }
  instance.get = vi.fn()
  instance.post = vi.fn()
  instance.patch = vi.fn()
  instance.delete = vi.fn()
  return instance
}

let mockInstance

vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => mockInstance),
      post: vi.fn(),
    },
  }
})

describe('api/client.js interceptors', () => {
  let client, axios
  let requestFulfilled, responseFulfilled, responseRejected

  beforeEach(async () => {
    vi.resetModules()
    mockInstance = buildMockAxiosInstance()
    localStorage.clear()
    delete window.location
    window.location = { href: '' }

    axios = (await import('axios')).default
    axios.create.mockReturnValue(mockInstance)
    axios.post.mockReset()

    client = (await import('./client')).default

    requestFulfilled = mockInstance.interceptors.request.use.mock.calls[0][0]
    responseFulfilled = mockInstance.interceptors.response.use.mock.calls[0][0]
    responseRejected = mockInstance.interceptors.response.use.mock.calls[0][1]
  })

  it('attaches a Bearer token from localStorage to the request', () => {
    localStorage.setItem('imboni_access', 'abc123')
    const config = requestFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer abc123')
  })

  it('does not attach an Authorization header when there is no stored token', () => {
    const config = requestFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBeUndefined()
  })

  it('unwraps response.data on success', () => {
    const result = responseFulfilled({ data: { foo: 'bar' } })
    expect(result).toEqual({ foo: 'bar' })
  })

  it('rejects with the backend error message for a non-401 error', async () => {
    const error = { response: { status: 400, data: { error: 'Invalid input' } } }
    await expect(responseRejected(error)).rejects.toThrow('Invalid input')
  })

  it('falls back to detail, then a generic message, when no error field is present', async () => {
    await expect(responseRejected({ response: { status: 400, data: { detail: 'Not found' } } })).rejects.toThrow('Not found')
    await expect(responseRejected({ response: { status: 500, data: {} } })).rejects.toThrow('Something went wrong')
  })

  it('clears localStorage and redirects to /login on 401 with no refresh token', async () => {
    localStorage.setItem('imboni_access', 'expired')
    const error = { response: { status: 401 }, config: {} }

    await expect(responseRejected(error)).rejects.toBe(error)

    expect(localStorage.getItem('imboni_access')).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('silently refreshes the access token on 401 and retries the original request', async () => {
    localStorage.setItem('imboni_refresh', 'refresh-token')
    axios.post.mockResolvedValue({ data: { access: 'new-access', refresh: 'new-refresh' } })

    const original = { headers: {}, _retry: false }
    const error = { response: { status: 401 }, config: original }

    const result = await responseRejected(error)

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/auth/token/refresh/'), { refresh: 'refresh-token' })
    expect(localStorage.getItem('imboni_access')).toBe('new-access')
    expect(localStorage.getItem('imboni_refresh')).toBe('new-refresh')
    expect(original.headers.Authorization).toBe('Bearer new-access')
    expect(original._retry).toBe(true)
    expect(result).toEqual({ data: 'retried' })
  })

  it('clears localStorage and redirects to /login if the refresh request itself fails', async () => {
    localStorage.setItem('imboni_access', 'expired')
    localStorage.setItem('imboni_refresh', 'bad-refresh')
    axios.post.mockRejectedValue(new Error('refresh failed'))

    const original = { headers: {}, _retry: false }
    const error = { response: { status: 401 }, config: original }

    await expect(responseRejected(error)).rejects.toThrow('refresh failed')

    expect(localStorage.getItem('imboni_access')).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('never retries the same request twice for a 401 (the _retry guard)', async () => {
    localStorage.setItem('imboni_refresh', 'refresh-token')
    const original = { headers: {}, _retry: true }
    const error = { response: { status: 401 }, config: original }

    await expect(responseRejected(error)).rejects.toThrow('Something went wrong')
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('queues a second concurrent 401 instead of firing a second refresh request', async () => {
    localStorage.setItem('imboni_refresh', 'refresh-token')
    let resolveRefresh
    axios.post.mockReturnValue(new Promise(resolve => { resolveRefresh = resolve }))

    const original1 = { headers: {}, _retry: false }
    const original2 = { headers: {}, _retry: false }

    const p1 = responseRejected({ response: { status: 401 }, config: original1 })
    const p2 = responseRejected({ response: { status: 401 }, config: original2 })

    expect(axios.post).toHaveBeenCalledTimes(1)

    resolveRefresh({ data: { access: 'new-access' } })
    await p1
    await p2

    expect(original2.headers.Authorization).toBe('Bearer new-access')
  })
})
