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
  let client, axios, session
  let requestFulfilled, responseFulfilled, responseRejected

  // Signed in, as far as the page can tell: a stored profile. The tokens are
  // not in localStorage any more (see session.js).
  const signIn = () => localStorage.setItem('imboni_user', JSON.stringify({ id: 1, role: 'teacher' }))
  const OURS = { withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest' } }

  beforeEach(async () => {
    vi.resetModules()
    mockInstance = buildMockAxiosInstance()
    localStorage.clear()
    sessionStorage.clear()
    delete window.location
    window.location = { href: '' }

    axios = (await import('axios')).default
    axios.create.mockReturnValue(mockInstance)
    axios.post.mockReset()

    client = (await import('./client')).default
    session = await import('./session')

    requestFulfilled = mockInstance.interceptors.request.use.mock.calls[0][0]
    responseFulfilled = mockInstance.interceptors.response.use.mock.calls[0][0]
    responseRejected = mockInstance.interceptors.response.use.mock.calls[0][1]
  })

  it('drops the JSON content type for a FormData body so it goes as multipart', async () => {
    const form = new FormData()
    form.append('file', new Blob(['x']), 'notes.pdf')
    const config = await requestFulfilled({ data: form, headers: { 'Content-Type': 'application/json' } })
    expect(config.headers['Content-Type']).toBeUndefined()
  })

  it('keeps the JSON content type for an ordinary body', async () => {
    const config = await requestFulfilled({ data: { title: 'x' }, headers: { 'Content-Type': 'application/json' } })
    expect(config.headers['Content-Type']).toBe('application/json')
  })

  it('attaches the access token it holds in memory', async () => {
    session.setAccessToken('abc123')
    const config = await requestFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer abc123')
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('sends nothing and asks for nothing when nobody is signed in', async () => {
    const config = await requestFulfilled({ headers: {} })
    expect(config.headers.Authorization).toBeUndefined()
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('a page that has just loaded fetches an access token before its first request', async () => {
    signIn()
    axios.post.mockResolvedValue({ data: { access: 'fresh' } })

    const config = await requestFulfilled({ headers: {} })

    // Bought with the cookie: nothing in the body, the cookie rides along, and
    // the header the server insists on is there.
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/auth/token/refresh/'), {}, OURS)
    expect(config.headers.Authorization).toBe('Bearer fresh')
  })

  it('offline at load, the request goes out bare so the offline layer can answer it', async () => {
    signIn()
    axios.post.mockRejectedValue(new Error('Network Error'))     // no .response: unreachable

    const config = await requestFulfilled({ headers: {} })

    expect(config.headers.Authorization).toBeUndefined()
    expect(localStorage.getItem('imboni_user')).not.toBeNull()    // still signed in
    expect(window.location.href).toBe('')
  })

  it('never puts a token in localStorage or sessionStorage', async () => {
    signIn()
    axios.post.mockResolvedValue({ data: { access: 'SECRET-ACCESS-TOKEN' } })
    await requestFulfilled({ headers: {} })

    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })
    expect(stored).not.toContain('SECRET-ACCESS-TOKEN')
    expect(localStorage.getItem('imboni_access')).toBeNull()
    expect(localStorage.getItem('imboni_refresh')).toBeNull()
  })

  it('unwraps response.data on success', () => {
    const result = responseFulfilled({ data: { foo: 'bar' } })
    expect(result).toEqual({ foo: 'bar' })
  })

  it('rejects with the backend error message for a non-401 error', async () => {
    const error = { response: { status: 400, data: { error: 'Invalid input' } } }
    await expect(responseRejected(error)).rejects.toThrow('Invalid input')
  })

  it('puts the status and body on the error, not only on error.response', async () => {
    /*
     * Twenty-odd pages are written as `if (e?.status !== 402)` so they stay
     * quiet when the school's plan does not include that portal. `.status` was
     * never set, so the comparison was always true and every one of them
     * showed "could not load" over the upgrade notice it was meant to leave
     * room for.
     */
    const error = { response: { status: 402, data: { detail: 'Upgrade required' } } }
    await expect(responseRejected(error)).rejects.toMatchObject({
      status: 402,
      data: { detail: 'Upgrade required' },
    })
  })

  it('leaves status undefined when there was no response at all', async () => {
    // A network failure has no status, and a caller branching on one must see
    // undefined rather than a number it can misread.
    await expect(responseRejected({ message: 'Network Error' })).rejects.toMatchObject({
      status: undefined,
    })
  })

  it('falls back to detail, then a generic message, when no error field is present', async () => {
    await expect(responseRejected({ response: { status: 400, data: { detail: 'Not found' } } })).rejects.toThrow('Not found')
    await expect(responseRejected({ response: { status: 500, data: {} } })).rejects.toThrow('Something went wrong')
  })

  it('a 401 with nobody signed in goes to the sign-in page', async () => {
    const error = { response: { status: 401 }, config: {} }

    await expect(responseRejected(error)).rejects.toBe(error)

    expect(axios.post).not.toHaveBeenCalled()
    expect(window.location.href).toBe('/login')
  })

  it('silently renews the access token on 401 and retries the original request', async () => {
    signIn()
    axios.post.mockResolvedValue({ data: { access: 'new-access' } })

    const original = { headers: {}, _retry: false }
    const error = { response: { status: 401 }, config: original }

    const result = await responseRejected(error)

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/auth/token/refresh/'), {}, OURS)
    expect(session.getAccessToken()).toBe('new-access')
    expect(original.headers.Authorization).toBe('Bearer new-access')
    expect(original._retry).toBe(true)
    expect(result).toEqual({ data: 'retried' })
  })

  it('signs the browser out when the server says the session is over', async () => {
    signIn()
    const ended = Object.assign(new Error('ended'), { response: { status: 401 } })
    axios.post.mockRejectedValue(ended)

    const error = { response: { status: 401 }, config: { headers: {}, _retry: false } }
    await expect(responseRejected(error)).rejects.toThrow('ended')

    expect(localStorage.getItem('imboni_user')).toBeNull()
    expect(session.getAccessToken()).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('does NOT sign out when the renewal simply could not reach the server', async () => {
    // A dropped connection in the middle of a 401 is not the end of a session.
    // It used to be treated as one, and threw a teacher out mid-register.
    signIn()
    axios.post.mockRejectedValue(new Error('Network Error'))

    const error = { response: { status: 401 }, config: { headers: {}, _retry: false } }
    await expect(responseRejected(error)).rejects.toThrow('Network Error')

    expect(localStorage.getItem('imboni_user')).not.toBeNull()
    expect(window.location.href).toBe('')
  })

  it('a support session cannot be renewed: a 401 ends it', async () => {
    signIn()
    session.startSupportSession('support-token')

    const error = { response: { status: 401 }, config: { headers: {} } }
    await expect(responseRejected(error)).rejects.toBe(error)

    expect(axios.post).not.toHaveBeenCalled()
    expect(session.getAccessToken()).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('never retries the same request twice for a 401 (the _retry guard)', async () => {
    signIn()
    const original = { headers: {}, _retry: true }
    const error = { response: { status: 401 }, config: original }

    await expect(responseRejected(error)).rejects.toThrow('Something went wrong')
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('makes one renewal for any number of 401s that arrive together', async () => {
    signIn()
    let resolveRefresh
    axios.post.mockReturnValue(new Promise(resolve => { resolveRefresh = resolve }))

    const original1 = { headers: {}, _retry: false }
    const original2 = { headers: {}, _retry: false }

    const p1 = responseRejected({ response: { status: 401 }, config: original1 })
    const p2 = responseRejected({ response: { status: 401 }, config: original2 })
    await Promise.resolve()

    expect(axios.post).toHaveBeenCalledTimes(1)

    resolveRefresh({ data: { access: 'new-access' } })
    await p1
    await p2

    expect(original1.headers.Authorization).toBe('Bearer new-access')
    expect(original2.headers.Authorization).toBe('Bearer new-access')
  })
})
