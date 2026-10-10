/**
 * Offline layer: response caching for reads, an outbox for queued writes,
 * and sync when connectivity returns. Wired into src/api/client.js — pages
 * only ever see `{ queued: true }` results and `__fromCache` flags.
 *
 * Four rules keep what sits on the device small, short-lived and unreadable:
 *
 *   1. Allowlist. Only the reads an offline workflow needs are kept at all.
 *      Marks, fees, health records, discipline and messages are never written
 *      to the device: what is not stored cannot leak.
 *   2. Owner. Every row belongs to the user who was signed in. Nobody else is
 *      served it, and nobody else's login sends it.
 *   3. Expiry. A cached read is good for a few days, then it is deleted,
 *      whether or not anyone signed out.
 *   4. Sealed. Rows are encrypted (see crypto.js); the URL is a keyed hash.
 */
import { db, idbAvailable } from './db'
import { blindIndex, cryptoAvailable, destroyKeys, open, seal } from './crypto'

// Whose data this is. Everything stored here is tagged with the signed-in
// user's id, so a shared computer never serves one person's cached pages to the
// next, and never sends one person's queued writes under another's login.
function currentOwner() {
    try {
        const id = JSON.parse(localStorage.getItem('imboni_user') || 'null')?.id
        return id == null ? '' : String(id)
    } catch {
        return ''
    }
}

// ── Which reads may be kept on the device ─────────────────────────────────────
// An allowlist, deliberately. The cache used to keep every successful GET, so a
// device held whatever its user had last looked at: a child's marks, a fee
// balance, a medical note. Add an endpoint here only when a workflow that must
// run without a connection cannot render without it, and say which.
const CACHEABLE = [
    // The frame every page is drawn in: without these the app cannot open at all.
    /^\/imboni\/dos\/branding\/$/,             // school name, logo, colour (already public)
    /^\/imboni\/dos\/school-config\/$/,        // years and streams, for the class pickers
    /^\/imboni\/dos\/school-settings\/$/,      // timezone, terms, currency
    /^\/imboni\/school\/modules\/$/,           // which portals this school has

    // Teacher: taking the register with no signal.
    /^\/imboni\/teacher\/my-classes\/$/,
    /^\/imboni\/teacher\/attendance\/students\/$/,
    /^\/imboni\/teacher\/attendance\/stats\/$/,

    // Matron: the medication round and the night check, in a dormitory.
    /^\/imboni\/matron\/dashboard\/$/,
    /^\/imboni\/matron\/night-check\/$/,
    /^\/imboni\/matron\/medications\/today\/$/,
]

export function isCacheable(url) {
    return CACHEABLE.some(pattern => pattern.test(url || ''))
}

// How long a cached read stays usable. Long enough to cover a weekend (loaded
// on Friday, needed on Monday morning before the network is up), short enough
// that a forgotten device does not hold a term's rosters. Override per
// deployment with VITE_OFFLINE_TTL_HOURS.
const TTL_HOURS = Number(import.meta.env?.VITE_OFFLINE_TTL_HOURS) || 72
export const READ_TTL_MS = TTL_HOURS * 60 * 60 * 1000

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

// The row's key as stored: a keyed hash of owner + URL, so the database does
// not name the class or the child a row is about. Two users get two rows.
async function storedKey(owner, url, params) {
    return blindIndex(`read|${owner}|${cacheKey(url, params)}`)
}

export async function cachePut(url, params, data) {
    if (!cryptoAvailable || !isCacheable(url)) return
    try {
        const owner = currentOwner()
        const key = await storedKey(owner, url, params)
        const sealed = await seal(data, `read|${owner}|${key}`)
        await db.apiCache.put({ key, owner, savedAt: Date.now(), ...sealed })
    } catch { /* cache is best-effort */ }
}

/** `{ data, savedAt }` for a usable cached copy, else null. */
export async function cacheGet(url, params) {
    if (!cryptoAvailable || !isCacheable(url)) return null
    try {
        const owner = currentOwner()
        const key = await storedKey(owner, url, params)
        const row = await db.apiCache.get(key)
        if (!row) return null
        if ((row.owner ?? '') !== owner || Date.now() - row.savedAt > READ_TTL_MS) {
            await db.apiCache.delete(key)
            return null
        }
        const data = await open(row, `read|${owner}|${key}`)
        if (data === undefined) {
            // Unreadable: sealed with keys that are gone, or tampered with.
            await db.apiCache.delete(key)
            return null
        }
        return { data, savedAt: row.savedAt }
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
    if (!cryptoAvailable) throw new Error('Offline storage unavailable.')
    const owner = currentOwner()
    const blind = await blindIndex(`write|${owner}|${dedupeKey || `once|${url}|${Date.now()}`}`)
    if (dedupeKey) {
        await db.outbox.where('dedupeKey').equals(blind).delete()
    }
    // The request itself (which class, which pupils, what was marked) is the
    // sensitive part, so it is the part that is sealed.
    const sealed = await seal({ method, url, body: body ?? null }, `write|${owner}|${blind}`)
    await db.outbox.add({ dedupeKey: blind, queuedAt: Date.now(), owner, ...sealed })
    emitPending()
}

/**
 * Forget what was saved for offline use.
 *
 * `reads` is the cached pages, which must not outlive the sign-in that fetched
 * them. `writes` is the outbox of unsent changes: dropped only when the person
 * has been told and agreed, or when the next person to sign in is somebody
 * else. Clearing both also destroys the keys, so even a copy of the database
 * taken beforehand can no longer be opened.
 */
export async function clearOfflineData({ reads = true, writes = true } = {}) {
    if (!idbAvailable) return
    try {
        if (reads) await db.apiCache.clear()
        if (writes) await db.outbox.clear()
        if (reads && writes) await destroyKeys()
    } catch { /* best-effort: nothing useful to do if storage is blocked */ }
    emitPending()
}

/**
 * Housekeeping, run at startup and each time the app returns to the front, so
 * nothing depends on somebody remembering to sign out: a closed laptop, a
 * crashed browser and an expired session all end up clean.
 */
export async function sweepOfflineData() {
    if (!idbAvailable) return
    try {
        const owner = currentOwner()
        // Expired reads.
        await db.apiCache.where('savedAt').below(Date.now() - READ_TTL_MS).delete()
        // Reads that belong to somebody other than whoever is here now (nobody,
        // if signed out), and anything left from before rows were encrypted.
        await db.apiCache.filter(row => (row.owner ?? '') !== owner || row.v === undefined).delete()
    } catch { /* best-effort */ }
}

export async function pendingCount() {
    if (!idbAvailable) return 0
    try {
        return await db.outbox.count()
    } catch {
        return 0
    }
}

// A queued write back in the clear. Rows queued before encryption carry their
// request as plain fields and are still honoured: they are somebody's unsent
// register. `null` means the row cannot be opened and can never be sent.
async function readQueued(row) {
    if (row.v === undefined) return row.method ? { method: row.method, url: row.url, body: row.body } : null
    const request = await open(row, `write|${row.owner ?? ''}|${row.dedupeKey}`)
    return request === undefined ? null : request
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

    const me = currentOwner()
    let items = await db.outbox.orderBy('queuedAt').toArray()
    if (me) {
        // Signed in as somebody: another user's leftovers are never sent as
        // them. They are deleted, not kept for a login that may never come.
        const foreign = items.filter(i => (i.owner ?? '') !== me)
        if (foreign.length) await db.outbox.bulkDelete(foreign.map(i => i.id))
        items = items.filter(i => (i.owner ?? '') === me)
    } else {
        // Signed out (an expired session): only untagged items go; the signed-out
        // user's own wait for them to sign back in.
        items = items.filter(i => !i.owner)
    }
    let sent = 0
    let failed = 0

    for (const item of items) {
        const request = await readQueued(item)
        if (!request) {
            await db.outbox.delete(item.id)   // sealed with keys that no longer exist
            failed += 1
            continue
        }
        try {
            await client.request({
                method: request.method,
                url: request.url,
                data: request.body,
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

/** Called once from client.js: clean up, then flush on startup and whenever we come back online. */
export function initOfflineSync(client) {
    if (_initialised || typeof window === 'undefined') return
    _initialised = true
    sweepOfflineData()
    // Again whenever the app comes back to the front: a tab left open for days
    // is exactly the one that needs its old rows removed. An event, not a
    // timer, so a backgrounded tab costs nothing.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') sweepOfflineData()
    })
    window.addEventListener('online', () => { flushOutbox(client) })
    if (navigator.onLine) {
        // Fire-and-forget on app start in case something was left queued
        setTimeout(() => { flushOutbox(client) }, 3000)
    }
}
