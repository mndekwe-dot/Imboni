/**
 * Offline layer: response caching for reads, an outbox for queued writes,
 * and sync when connectivity returns. Wired into src/api/client.js — pages
 * only ever see `{ queued: true }` results and `__fromCache` flags.
 */
import { db, idbAvailable } from './db'

// ── Which writes may be queued offline ────────────────────────────────────────
// Only idempotent endpoints belong here: replaying them after reconnect must
// be safe (attendance/medication use upserts keyed on natural keys).
// dedupeKey collapses repeated offline saves of the same thing so only the
// latest version is replayed.
const QUEUEABLE = [
    {
        pattern: /^\/imboni\/teacher\/attendance\/mark\/$/,
        dedupeKey: (url, body) => `attendance|${body?.class_id}|${body?.date}`,
    },
    {
        pattern: /^\/imboni\/matron\/medications\/[^/]+\/administer\/$/,
        dedupeKey: (url, body) => `medication|${url}|${body?.date || 'today'}|${body?.time}`,
    },
    {
        pattern: /^\/imboni\/matron\/night-check\/$/,
        dedupeKey: (url, body) => `nightcheck|${body?.date || 'today'}`,
    },
]

export function isQueueable(method, url) {
    if ((method || '').toLowerCase() !== 'post') return null
    return QUEUEABLE.find(q => q.pattern.test(url)) || null
}

// ── Read cache ────────────────────────────────────────────────────────────────

export function cacheKey(url, params) {
    return params && Object.keys(params).length ? `${url}?${JSON.stringify(params)}` : url
}

export async function cachePut(url, params, data) {
    if (!idbAvailable) return
    try {
        await db.apiCache.put({ key: cacheKey(url, params), data, savedAt: Date.now() })
    } catch { /* cache is best-effort */ }
}

export async function cacheGet(url, params) {
    if (!idbAvailable) return null
    try {
        return await db.apiCache.get(cacheKey(url, params)) || null
    } catch {
        return null
    }
}

// ── Outbox ────────────────────────────────────────────────────────────────────

function emitPending() {
    pendingCount().then(count => {
        try {
            window.dispatchEvent(new CustomEvent('imboni:offline-pending', { detail: { count } }))
        } catch { /* non-browser env */ }
    })
}

export async function enqueue(method, url, body, dedupeKey) {
    if (!idbAvailable) throw new Error('Offline storage unavailable.')
    if (dedupeKey) {
        await db.outbox.where('dedupeKey').equals(dedupeKey).delete()
    }
    await db.outbox.add({
        method, url, body: body ?? null,
        dedupeKey: dedupeKey || `once|${url}|${Date.now()}`,
        queuedAt: Date.now(),
    })
    emitPending()
}

export async function pendingCount() {
    if (!idbAvailable) return 0
    try {
        return await db.outbox.count()
    } catch {
        return 0
    }
}

/**
 * Replay queued writes in FIFO order using the given axios client.
 *  - success            → remove from outbox
 *  - network error      → still offline; stop, keep everything
 *  - 401                → token problem; stop, keep everything (retry after login)
 *  - other 4xx/5xx      → server rejected it; drop so the queue can't jam
 * Returns { sent, failed, remaining }.
 */
export async function flushOutbox(client) {
    if (!idbAvailable) return { sent: 0, failed: 0, remaining: 0 }

    const items = await db.outbox.orderBy('queuedAt').toArray()
    let sent = 0
    let failed = 0

    for (const item of items) {
        try {
            await client.request({
                method: item.method,
                url: item.url,
                data: item.body,
                _skipOfflineQueue: true,   // don't re-enqueue while replaying
            })
            await db.outbox.delete(item.id)
            sent += 1
        } catch (err) {
            const status = err?.response?.status
            if (!status || status === 401) {
                break            // offline again, or needs a fresh login — keep the item
            }
            await db.outbox.delete(item.id)   // permanent rejection — drop it
            failed += 1
        }
    }

    emitPending()
    const remaining = await pendingCount()
    return { sent, failed, remaining }
}

// ── Wiring ────────────────────────────────────────────────────────────────────

let _initialised = false

/** Called once from client.js: flush on startup and whenever we come back online. */
export function initOfflineSync(client) {
    if (_initialised || typeof window === 'undefined') return
    _initialised = true
    window.addEventListener('online', () => { flushOutbox(client) })
    if (navigator.onLine) {
        // Fire-and-forget on app start in case something was left queued
        setTimeout(() => { flushOutbox(client) }, 3000)
    }
}
