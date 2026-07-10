import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from './db'
import {
  cacheKey, cachePut, cacheGet,
  isQueueable, enqueue, pendingCount, flushOutbox,
} from './index'

beforeEach(async () => {
  await db.apiCache.clear()
  await db.outbox.clear()
})

describe('read cache', () => {
  it('stores and retrieves a response by url + params', async () => {
    await cachePut('/imboni/teacher/my-classes/', undefined, [{ id: 1 }])
    const hit = await cacheGet('/imboni/teacher/my-classes/', undefined)

    expect(hit.data).toEqual([{ id: 1 }])
    expect(hit.savedAt).toBeGreaterThan(0)
  })

  it('treats different params as different cache entries', async () => {
    await cachePut('/imboni/x/', { class_id: '1' }, 'A')
    await cachePut('/imboni/x/', { class_id: '2' }, 'B')

    expect((await cacheGet('/imboni/x/', { class_id: '1' })).data).toBe('A')
    expect((await cacheGet('/imboni/x/', { class_id: '2' })).data).toBe('B')
    expect(cacheKey('/imboni/x/', {})).toBe('/imboni/x/')
  })

  it('returns null on a cache miss', async () => {
    expect(await cacheGet('/imboni/never-seen/', undefined)).toBeNull()
  })
})

describe('isQueueable', () => {
  it('allows only the idempotent offline endpoints, POST only', () => {
    expect(isQueueable('post', '/imboni/teacher/attendance/mark/')).toBeTruthy()
    expect(isQueueable('post', '/imboni/matron/medications/abc-123/administer/')).toBeTruthy()
    expect(isQueueable('post', '/imboni/matron/night-check/')).toBeTruthy()

    expect(isQueueable('get',  '/imboni/teacher/attendance/mark/')).toBeNull()
    expect(isQueueable('post', '/imboni/dos/results/bulk-approve/')).toBeNull()
    expect(isQueueable('post', '/imboni/messages/')).toBeNull()
  })
})

describe('outbox', () => {
  it('enqueues writes and counts them', async () => {
    await enqueue('post', '/imboni/matron/night-check/', { date: '2026-07-05' }, 'nightcheck|2026-07-05')
    expect(await pendingCount()).toBe(1)
  })

  it('dedupes repeated saves of the same register — only the latest survives', async () => {
    const key = 'attendance|class1|2026-07-05'
    await enqueue('post', '/imboni/teacher/attendance/mark/', { records: [{ status: 'absent' }] }, key)
    await enqueue('post', '/imboni/teacher/attendance/mark/', { records: [{ status: 'present' }] }, key)

    expect(await pendingCount()).toBe(1)
    const [item] = await db.outbox.toArray()
    expect(item.body.records[0].status).toBe('present')
  })

  it('flushes queued items in FIFO order and clears them on success', async () => {
    await enqueue('post', '/imboni/matron/night-check/', { n: 1 }, 'a')
    await enqueue('post', '/imboni/teacher/attendance/mark/', { n: 2 }, 'b')
    const client = { request: vi.fn().mockResolvedValue({}) }

    const result = await flushOutbox(client)

    expect(result).toEqual({ sent: 2, failed: 0, remaining: 0 })
    expect(client.request).toHaveBeenCalledTimes(2)
    expect(client.request.mock.calls[0][0].data).toEqual({ n: 1 })
    // Replays must not re-enqueue themselves if they fail
    expect(client.request.mock.calls[0][0]._skipOfflineQueue).toBe(true)
  })

  it('stops and keeps everything on a network error (still offline)', async () => {
    await enqueue('post', '/imboni/matron/night-check/', { n: 1 }, 'a')
    await enqueue('post', '/imboni/matron/night-check/', { n: 2 }, 'b')
    const client = { request: vi.fn().mockRejectedValue(new Error('Network Error')) }

    const result = await flushOutbox(client)

    expect(result.sent).toBe(0)
    expect(result.remaining).toBe(2)
    expect(client.request).toHaveBeenCalledTimes(1)   // stopped after the first failure
  })

  it('stops and keeps everything on a 401 (needs a fresh login)', async () => {
    await enqueue('post', '/imboni/matron/night-check/', { n: 1 }, 'a')
    const err = new Error('unauthorized'); err.response = { status: 401 }
    const client = { request: vi.fn().mockRejectedValue(err) }

    const result = await flushOutbox(client)

    expect(result.remaining).toBe(1)
  })

  it('drops an item the server permanently rejects so the queue cannot jam', async () => {
    await enqueue('post', '/imboni/matron/night-check/', { n: 1 }, 'a')
    await enqueue('post', '/imboni/matron/night-check/', { n: 2 }, 'b')
    const bad = new Error('bad request'); bad.response = { status: 400 }
    const client = {
      request: vi.fn()
        .mockRejectedValueOnce(bad)     // first item rejected
        .mockResolvedValueOnce({}),     // second succeeds
    }

    const result = await flushOutbox(client)

    expect(result).toEqual({ sent: 1, failed: 1, remaining: 0 })
  })
})
