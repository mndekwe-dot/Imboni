import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../offline/db'

// Same mock-axios technique as client.test.js: capture the interceptors and
// invoke them by hand — but with fake-indexeddb loaded so the real Dexie
// offline layer is exercised end to end.
function buildMockAxiosInstance() {
  const instance = vi.fn(() => Promise.resolve({ data: 'retried' }))
  instance.interceptors = {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  }
  instance.defaults = { headers: { common: {} } }
  return instance
}

let mockInstance

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockInstance),
    post: vi.fn(),
  },
}))

describe('client.js offline behaviour', () => {
  let responseFulfilled, responseRejected

  beforeEach(async () => {
    vi.resetModules()
    mockInstance = buildMockAxiosInstance()
    localStorage.clear()
    await db.apiCache.clear()
    await db.outbox.clear()

    const axios = (await import('axios')).default
    axios.create.mockReturnValue(mockInstance)
    await import('./client')

    responseFulfilled = mockInstance.interceptors.response.use.mock.calls[0][0]
    responseRejected = mockInstance.interceptors.response.use.mock.calls[0][1]
  })

  it('caches successful GET responses', async () => {
    responseFulfilled({
      data: [{ id: 1, name: 'S1A' }],
      config: { method: 'get', url: '/imboni/dos/classes/' },
    })
    // cachePut is fire-and-forget — give it a tick
    await new Promise(r => setTimeout(r, 20))

    const cached = await db.apiCache.get('/imboni/dos/classes/')
    expect(cached.data).toEqual([{ id: 1, name: 'S1A' }])
  })

  it('never caches auth responses', async () => {
    responseFulfilled({
      data: { access: 'tok' },
      config: { method: 'get', url: '/imboni/auth/me/' },
    })
    await new Promise(r => setTimeout(r, 20))

    expect(await db.apiCache.get('/imboni/auth/me/')).toBeUndefined()
  })

  it('serves a cached copy when a GET fails with no response (offline)', async () => {
    await db.apiCache.put({
      key: '/imboni/teacher/my-classes/',
      data: [{ class_id: 'c1' }],
      savedAt: 1234,
    })

    const result = await responseRejected({
      config: { method: 'get', url: '/imboni/teacher/my-classes/' },
      // no .response → network failure
    })

    expect(result).toEqual([{ class_id: 'c1' }])
    expect(result.__fromCache).toBe(true)
    expect(result.__cachedAt).toBe(1234)
  })

  it('queues an offline attendance save and resolves {queued: true}', async () => {
    const result = await responseRejected({
      config: {
        method: 'post',
        url: '/imboni/teacher/attendance/mark/',
        data: JSON.stringify({ class_id: 'c1', date: '2026-07-05', records: [] }),
      },
    })

    expect(result).toEqual({ queued: true, offline: true })
    const items = await db.outbox.toArray()
    expect(items).toHaveLength(1)
    expect(items[0].dedupeKey).toBe('attendance|c1|2026-07-05')
  })

  it('does not queue non-offline endpoints — they fail normally', async () => {
    await expect(responseRejected({
      config: { method: 'post', url: '/imboni/dos/results/bulk-approve/', data: '{}' },
    })).rejects.toThrow('Something went wrong')

    expect(await db.outbox.count()).toBe(0)
  })

  it('preserves err.response on wrapped errors so 409 conflict handling works', async () => {
    const conflicts = [{ type: 'teacher', message: 'Double-booked.' }]
    try {
      await responseRejected({
        config: { method: 'post', url: '/imboni/dos/timetable/' },
        response: { status: 409, data: { error: 'Scheduling conflict.', conflicts } },
      })
      throw new Error('should have rejected')
    } catch (err) {
      expect(err.message).toBe('Scheduling conflict.')
      expect(err.response.status).toBe(409)
      expect(err.response.data.conflicts).toEqual(conflicts)
    }
  })
})
