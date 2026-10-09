import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  trackTransfer, withTransfer, getTransfers, subscribeTransfers,
  dismissTransfer, percentOf, resetTransfers,
} from './transfers'

describe('percentOf', () => {
  it('turns bytes into a percentage', () => {
    expect(percentOf({ loaded: 25, total: 100 })).toBe(25)
    expect(percentOf({ loaded: 1, total: 3 })).toBe(33)
  })
  it('is null when the size is unknown, so the bar says "working" rather than 0%', () => {
    expect(percentOf({ loaded: 500 })).toBeNull()
    expect(percentOf({ loaded: 500, total: 0 })).toBeNull()
    expect(percentOf(undefined)).toBeNull()
  })
  it('never exceeds 100', () => {
    expect(percentOf({ loaded: 120, total: 100 })).toBe(100)
  })
})

describe('trackTransfer', () => {
  beforeEach(() => { vi.useFakeTimers(); resetTransfers() })
  afterEach(() => { vi.useRealTimers() })

  it('appears as an active transfer at 0%', () => {
    trackTransfer({ direction: 'upload', name: 'photo.png' })
    expect(getTransfers()).toMatchObject([{ direction: 'upload', name: 'photo.png', percent: 0, status: 'active' }])
  })

  it('follows progress events', () => {
    const t = trackTransfer({ direction: 'upload', name: 'a' })
    t.onProgress({ loaded: 50, total: 200 })
    expect(getTransfers()[0].percent).toBe(25)
  })

  it('completes at 100% and then leaves on its own', () => {
    const t = trackTransfer({ direction: 'download', name: 'a' })
    t.done()
    expect(getTransfers()[0]).toMatchObject({ status: 'done', percent: 100 })
    vi.advanceTimersByTime(2200)
    expect(getTransfers()[0].leaving).toBe(true)
    vi.advanceTimersByTime(300)
    expect(getTransfers()).toHaveLength(0)
  })

  it('keeps a failure on screen longer than a success', () => {
    const t = trackTransfer({ direction: 'upload', name: 'a' })
    t.fail()
    vi.advanceTimersByTime(2500)
    expect(getTransfers()).toHaveLength(1)           // a success would be gone by now
    expect(getTransfers()[0].status).toBe('error')
    vi.advanceTimersByTime(5000)
    expect(getTransfers()).toHaveLength(0)
  })

  it('ignores progress that arrives after it has finished', () => {
    const t = trackTransfer({ direction: 'upload', name: 'a' })
    t.done()
    t.onProgress({ loaded: 1, total: 100 })
    expect(getTransfers()[0].percent).toBe(100)
  })

  it('cannot be finished twice, or finished and then failed', () => {
    const t = trackTransfer({ direction: 'upload', name: 'a' })
    t.done()
    t.fail()
    expect(getTransfers()[0].status).toBe('done')
  })

  it('can be dismissed by hand', () => {
    const t = trackTransfer({ direction: 'upload', name: 'a' })
    t.fail()
    dismissTransfer(t.id)
    vi.advanceTimersByTime(300)
    expect(getTransfers()).toHaveLength(0)
  })

  it('tells subscribers when anything changes, and stops when unsubscribed', () => {
    const listener = vi.fn()
    const off = subscribeTransfers(listener)
    const t = trackTransfer({ direction: 'upload', name: 'a' })
    t.onProgress({ loaded: 1, total: 2 })
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    t.done()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('tracks several at once', () => {
    trackTransfer({ direction: 'upload', name: 'a' })
    trackTransfer({ direction: 'download', name: 'b' })
    expect(getTransfers().map(i => i.name)).toEqual(['a', 'b'])
  })
})

describe('withTransfer', () => {
  beforeEach(() => { vi.useFakeTimers(); resetTransfers() })
  afterEach(() => { vi.useRealTimers() })

  it('hands the request an upload progress handler and returns its result untouched', async () => {
    const send = vi.fn(async opts => {
      opts.onUploadProgress({ loaded: 5, total: 10 })
      return { ok: true }
    })
    const result = await withTransfer({ direction: 'upload', name: 'f' }, send)
    expect(result).toEqual({ ok: true })
    expect(send.mock.calls[0][0]).toHaveProperty('onUploadProgress')
    expect(getTransfers()[0].status).toBe('done')
  })

  it('uses the download handler for a download', async () => {
    const send = vi.fn(async () => 'blob')
    await withTransfer({ direction: 'download', name: 'f' }, send)
    expect(send.mock.calls[0][0]).toHaveProperty('onDownloadProgress')
    expect(send.mock.calls[0][0]).not.toHaveProperty('onUploadProgress')
  })

  it('shows a failure in the tray and still throws it to the caller', async () => {
    const boom = new Error('413')
    await expect(withTransfer({ direction: 'upload', name: 'f' }, async () => { throw boom }))
      .rejects.toBe(boom)
    expect(getTransfers()[0].status).toBe('error')
  })
})
