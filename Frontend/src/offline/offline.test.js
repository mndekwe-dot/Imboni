import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from './db'
import { __resetKeyCache } from './crypto'
import {
  cacheKey, cachePut, cacheGet, isCacheable, READ_TTL_MS,
  isQueueable, enqueue, pendingCount, flushOutbox, clearOfflineData, sweepOfflineData,
} from './index'

const CLASSES = '/imboni/teacher/my-classes/'
const STUDENTS = '/imboni/teacher/attendance/students/'
const NIGHT = '/imboni/matron/night-check/'
const MARK = '/imboni/teacher/attendance/mark/'

const signIn = id => localStorage.setItem('imboni_user', JSON.stringify({ id }))

// Everything on disk, as somebody reading the database file would see it.
const rawDump = async () => JSON.stringify(
  [...await db.apiCache.toArray(), ...await db.outbox.toArray()],
  (_k, v) => (v instanceof ArrayBuffer || ArrayBuffer.isView(v)
    ? String.fromCharCode(...new Uint8Array(v.buffer ?? v))
    : v))

beforeEach(async () => {
  localStorage.clear()
  await db.apiCache.clear()
  await db.outbox.clear()
  await db.keys.clear()
  __resetKeyCache()
})

afterEach(() => { vi.useRealTimers() })

describe('which reads may be kept', () => {
  it('keeps the reads an offline workflow needs', () => {
    expect(isCacheable(CLASSES)).toBe(true)
    expect(isCacheable(STUDENTS)).toBe(true)
    expect(isCacheable(NIGHT)).toBe(true)
    expect(isCacheable('/imboni/matron/medications/today/')).toBe(true)
  })

  it('never keeps marks, fees, health, discipline, messages or sign-in answers', () => {
    for (const url of [
      '/imboni/student/results/', '/imboni/finance/statements/', '/imboni/matron/students/',
      '/imboni/discipline/records/', '/imboni/messages/', '/imboni/auth/me/', '/imboni/parents/children/',
    ]) expect(isCacheable(url)).toBe(false)
  })

  it('writes nothing to the device for an endpoint that is not on the list', async () => {
    await cachePut('/imboni/student/results/', undefined, [{ mark: 91 }])
    expect(await db.apiCache.count()).toBe(0)
    expect(await cacheGet('/imboni/student/results/', undefined)).toBeNull()
  })
})

describe('read cache', () => {
  it('stores and retrieves a response by url + params', async () => {
    await cachePut(CLASSES, undefined, [{ id: 1 }])
    const hit = await cacheGet(CLASSES, undefined)

    expect(hit.data).toEqual([{ id: 1 }])
    expect(hit.savedAt).toBeGreaterThan(0)
  })

  it('treats different params as different cache entries', async () => {
    await cachePut(STUDENTS, { class_id: '1' }, 'A')
    await cachePut(STUDENTS, { class_id: '2' }, 'B')

    expect((await cacheGet(STUDENTS, { class_id: '1' })).data).toBe('A')
    expect((await cacheGet(STUDENTS, { class_id: '2' })).data).toBe('B')
    expect(cacheKey(STUDENTS, {})).toBe(STUDENTS)
  })

  it('returns null on a cache miss', async () => {
    expect(await cacheGet(CLASSES, undefined)).toBeNull()
  })
})

describe('what is actually on the disk', () => {
  it('holds no readable data, URL or class id: only ciphertext and a keyed hash', async () => {
    signIn(7)
    await cachePut(STUDENTS, { class_id: 'CLASS-ZEBRA' }, [{ name: 'UWASE-MARKER', allergy: 'PEANUT-MARKER' }])
    await enqueue('post', MARK, { class_id: 'CLASS-ZEBRA', records: [{ student: 'KARENZI-MARKER' }] },
      'attendance|CLASS-ZEBRA|2026-07-05')

    const raw = await rawDump()
    for (const secret of ['UWASE-MARKER', 'PEANUT-MARKER', 'KARENZI-MARKER', 'CLASS-ZEBRA', 'attendance/students', 'attendance/mark']) {
      expect(raw).not.toContain(secret)
    }
    // ...and it still opens for the person it belongs to.
    expect((await cacheGet(STUDENTS, { class_id: 'CLASS-ZEBRA' })).data[0].name).toBe('UWASE-MARKER')
  })

  it('keeps the keys non-extractable: the browser will use them but not hand them over', async () => {
    await cachePut(CLASSES, undefined, 'x')
    const { aes, mac } = await db.keys.get('device')
    expect(aes.extractable).toBe(false)
    expect(mac.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('raw', aes)).rejects.toThrow()
  })

  it('treats a tampered row as a miss, and removes it', async () => {
    await cachePut(CLASSES, undefined, [{ id: 1 }])
    const [row] = await db.apiCache.toArray()
    const bytes = new Uint8Array(row.ct.slice(0)); bytes[0] ^= 0xff
    await db.apiCache.put({ ...row, ct: bytes.buffer })

    expect(await cacheGet(CLASSES, undefined)).toBeNull()
    expect(await db.apiCache.count()).toBe(0)
  })

  it('will not open a body copied onto another row’s key', async () => {
    await cachePut(CLASSES, undefined, 'CLASSES-DATA')
    const [classesRow] = await db.apiCache.toArray()
    await cachePut(NIGHT, undefined, 'NIGHT-DATA')
    const nightRow = (await db.apiCache.toArray()).find(r => r.key !== classesRow.key)
    // Somebody with write access to the store points one URL at another's data.
    await db.apiCache.put({ ...classesRow, iv: nightRow.iv, ct: nightRow.ct })

    expect(await cacheGet(CLASSES, undefined)).toBeNull()
    expect((await cacheGet(NIGHT, undefined)).data).toBe('NIGHT-DATA')
  })

  it('is unreadable once the keys are destroyed, even from a copy taken earlier', async () => {
    await cachePut(CLASSES, undefined, [{ id: 1 }])
    const copy = await db.apiCache.toArray()          // an attacker's earlier copy of the store
    await clearOfflineData()                          // sign-out: rows and keys both go
    await db.apiCache.bulkPut(copy)                   // ...the copy is put back

    expect(await cacheGet(CLASSES, undefined)).toBeNull()
  })
})

describe('expiry', () => {
  it('stops serving a read once it is older than the limit, and deletes it', async () => {
    await cachePut(CLASSES, undefined, [{ id: 1 }])
    const [row] = await db.apiCache.toArray()
    await db.apiCache.put({ ...row, savedAt: Date.now() - READ_TTL_MS - 1000 })

    expect(await cacheGet(CLASSES, undefined)).toBeNull()
    expect(await db.apiCache.count()).toBe(0)
  })

  it('the sweep removes expired rows without anyone asking for them', async () => {
    await cachePut(CLASSES, undefined, 'old')
    await cachePut(NIGHT, undefined, 'fresh')
    const rows = await db.apiCache.toArray()
    await db.apiCache.put({ ...rows[0], savedAt: Date.now() - READ_TTL_MS - 1000 })

    await sweepOfflineData()
    expect(await db.apiCache.count()).toBe(1)
  })

  it('the sweep removes reads left by whoever was here before', async () => {
    signIn(1)
    await cachePut(CLASSES, undefined, 'teacher one')
    signIn(2)
    await sweepOfflineData()
    expect(await db.apiCache.count()).toBe(0)
  })

  it('the sweep removes every signed-in read once nobody is signed in', async () => {
    signIn(1)
    await cachePut(CLASSES, undefined, 'teacher one')
    localStorage.clear()                // the browser was closed; the session has gone
    await sweepOfflineData()
    expect(await db.apiCache.count()).toBe(0)
  })

  it('the sweep removes rows written before encryption', async () => {
    await db.apiCache.put({ key: CLASSES, data: [{ id: 1 }], savedAt: Date.now(), owner: '' })
    await sweepOfflineData()
    expect(await db.apiCache.count()).toBe(0)
  })
})

describe('isQueueable', () => {
  it('allows only the idempotent offline endpoints, POST only', () => {
    expect(isQueueable('post', MARK)).toBeTruthy()
    expect(isQueueable('post', '/imboni/matron/medications/abc-123/administer/')).toBeTruthy()
    expect(isQueueable('post', NIGHT)).toBeTruthy()

    expect(isQueueable('get',  MARK)).toBeNull()
    expect(isQueueable('post', '/imboni/dos/results/bulk-approve/')).toBeNull()
    expect(isQueueable('post', '/imboni/messages/')).toBeNull()
  })
})

describe('outbox', () => {
  it('enqueues writes and counts them', async () => {
    await enqueue('post', NIGHT, { date: '2026-07-05' }, 'nightcheck|2026-07-05')
    expect(await pendingCount()).toBe(1)
  })

  it('dedupes repeated saves of the same register: only the latest survives', async () => {
    const key = 'attendance|class1|2026-07-05'
    await enqueue('post', MARK, { records: [{ status: 'absent' }] }, key)
    await enqueue('post', MARK, { records: [{ status: 'present' }] }, key)

    expect(await pendingCount()).toBe(1)
    const client = { request: vi.fn().mockResolvedValue({}) }
    await flushOutbox(client)
    expect(client.request.mock.calls[0][0].data.records[0].status).toBe('present')
  })

  it('flushes queued items in FIFO order and clears them on success', async () => {
    await enqueue('post', NIGHT, { n: 1 }, 'a')
    await enqueue('post', MARK, { n: 2 }, 'b')
    const client = { request: vi.fn().mockResolvedValue({}) }

    const result = await flushOutbox(client)

    expect(result).toEqual({ sent: 2, failed: 0, remaining: 0 })
    expect(client.request).toHaveBeenCalledTimes(2)
    expect(client.request.mock.calls[0][0]).toMatchObject({ method: 'post', url: NIGHT, data: { n: 1 } })
    // Replays must not re-enqueue themselves if they fail
    expect(client.request.mock.calls[0][0]._skipOfflineQueue).toBe(true)
  })

  it('stops and keeps everything on a network error (still offline)', async () => {
    await enqueue('post', NIGHT, { n: 1 }, 'a')
    await enqueue('post', NIGHT, { n: 2 }, 'b')
    const client = { request: vi.fn().mockRejectedValue(new Error('Network Error')) }

    const result = await flushOutbox(client)

    expect(result.sent).toBe(0)
    expect(result.remaining).toBe(2)
    expect(client.request).toHaveBeenCalledTimes(1)   // stopped after the first failure
  })

  it('stops and keeps everything on a 401 (needs a fresh login)', async () => {
    await enqueue('post', NIGHT, { n: 1 }, 'a')
    const err = new Error('unauthorized'); err.response = { status: 401 }
    const client = { request: vi.fn().mockRejectedValue(err) }

    const result = await flushOutbox(client)

    expect(result.remaining).toBe(1)
  })

  it('drops an item the server permanently rejects so the queue cannot jam', async () => {
    await enqueue('post', NIGHT, { n: 1 }, 'a')
    await enqueue('post', NIGHT, { n: 2 }, 'b')
    const bad = new Error('bad request'); bad.response = { status: 400 }
    const client = {
      request: vi.fn()
        .mockRejectedValueOnce(bad)     // first item rejected
        .mockResolvedValueOnce({}),     // second succeeds
    }

    const result = await flushOutbox(client)

    expect(result).toEqual({ sent: 1, failed: 1, remaining: 0 })
  })

  it('still sends a register that was queued before rows were encrypted', async () => {
    await db.outbox.add({ method: 'post', url: MARK, body: { n: 9 }, dedupeKey: 'old', queuedAt: 1 })
    const client = { request: vi.fn().mockResolvedValue({}) }

    expect((await flushOutbox(client)).sent).toBe(1)
    expect(client.request.mock.calls[0][0]).toMatchObject({ url: MARK, data: { n: 9 } })
  })

  it('drops a queued write it can no longer open instead of jamming on it', async () => {
    await enqueue('post', NIGHT, { n: 1 }, 'a')
    await db.keys.clear(); __resetKeyCache()          // the keys are gone
    const client = { request: vi.fn().mockResolvedValue({}) }

    const result = await flushOutbox(client)
    expect(client.request).not.toHaveBeenCalled()
    expect(result.remaining).toBe(0)
  })
})

describe('shared computers', () => {
  it('never serves a user’s cached pages to the next user', async () => {
    signIn(1)
    await cachePut(CLASSES, undefined, [{ id: 1 }])
    expect((await cacheGet(CLASSES, undefined)).data).toEqual([{ id: 1 }])
    signIn(2)
    expect(await cacheGet(CLASSES, undefined)).toBeNull()
  })

  it('does not send queued writes under another login, and drops them', async () => {
    signIn(1)
    await enqueue('post', NIGHT, { n: 1 }, 'a')
    signIn(2)
    const client = { request: vi.fn().mockResolvedValue({}) }
    const result = await flushOutbox(client)
    expect(client.request).not.toHaveBeenCalled()
    expect(result.remaining).toBe(0)
  })

  it('keeps unsent writes of a signed-out user for when they sign back in', async () => {
    signIn(1)
    await enqueue('post', NIGHT, { n: 1 }, 'a')
    localStorage.clear()            // session expired
    const client = { request: vi.fn().mockResolvedValue({}) }
    await flushOutbox(client)
    expect(client.request).not.toHaveBeenCalled()
    expect(await pendingCount()).toBe(1)
    signIn(1)
    expect((await flushOutbox(client)).sent).toBe(1)
  })

  it('clears the cache and the outbox on request, or only the cache', async () => {
    await cachePut(CLASSES, undefined, 'A')
    await enqueue('post', NIGHT, { n: 1 }, 'a')
    await clearOfflineData({ writes: false })
    expect(await cacheGet(CLASSES, undefined)).toBeNull()
    expect(await pendingCount()).toBe(1)
    // The outbox survived, so its keys must have too.
    const client = { request: vi.fn().mockResolvedValue({}) }
    expect((await flushOutbox(client)).sent).toBe(1)

    await enqueue('post', NIGHT, { n: 2 }, 'b')
    await clearOfflineData()
    expect(await pendingCount()).toBe(0)
    expect(await db.keys.count()).toBe(0)
  })
})
