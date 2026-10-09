/*
 * Uploads and downloads in flight, as a small store anything can report into.
 *
 * The API layer knows when bytes move; the tray knows how to show it. Keeping
 * the state here, outside React, lets an api/ helper start a transfer without
 * importing a component, and lets the tray show one that began on another page.
 *
 *   const t = trackTransfer({ direction: 'upload', name: file.name })
 *   await client.post(url, form, { onUploadProgress: t.onProgress })
 *   t.done()          // or t.fail() in a catch
 *
 * Finished and failed transfers leave the tray on their own. A failed one stays
 * a little longer: it is the one the person needs to notice.
 */

const DONE_MS = 2200
const FAIL_MS = 7000
const LEAVE_MS = 240

let items = []
let nextId = 1
const listeners = new Set()

function emit() { listeners.forEach(l => l()) }

function patch(id, change) {
    items = items.map(i => (i.id === id ? { ...i, ...change } : i))
    emit()
}

function leaveLater(id, after) {
    setTimeout(() => {
        patch(id, { leaving: true })
        setTimeout(() => { items = items.filter(i => i.id !== id); emit() }, LEAVE_MS)
    }, after)
}

export function subscribeTransfers(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export const getTransfers = () => items

/** Percent 0-100 from an axios progress event, or null when the size is unknown. */
export function percentOf(event) {
    const total = event?.total
    if (!total || !Number.isFinite(total)) return null
    return Math.min(100, Math.round((event.loaded / total) * 100))
}

export function trackTransfer({ direction = 'upload', name = '' } = {}) {
    const id = nextId++
    items = [...items, { id, direction, name, percent: 0, status: 'active', leaving: false }]
    emit()

    let finished = false
    return {
        id,
        onProgress(event) {
            if (finished) return
            patch(id, { percent: percentOf(event) })
        },
        done() {
            if (finished) return
            finished = true
            patch(id, { status: 'done', percent: 100 })
            leaveLater(id, DONE_MS)
        },
        fail() {
            if (finished) return
            finished = true
            patch(id, { status: 'error' })
            leaveLater(id, FAIL_MS)
        },
    }
}

/** Dismiss one by hand (the tray's close button). */
export function dismissTransfer(id) { leaveLater(id, 0) }

/**
 * Run a request as a tracked transfer. `send` receives the axios options that
 * report progress and returns the request's promise; the result passes through
 * untouched and a failure is re-thrown after the tray has shown it.
 */
export async function withTransfer(meta, send) {
    const t = trackTransfer(meta)
    const key = meta?.direction === 'download' ? 'onDownloadProgress' : 'onUploadProgress'
    try {
        const result = await send({ [key]: t.onProgress })
        t.done()
        return result
    } catch (err) {
        t.fail()
        throw err
    }
}

/** Test seam: forget everything. */
export function resetTransfers() {
    items = []
    nextId = 1
    emit()
}
