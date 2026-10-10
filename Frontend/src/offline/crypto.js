/**
 * Encryption for what the app keeps on the device.
 *
 * Offline data used to sit in IndexedDB as plain JSON: anyone who opened the
 * browser's developer tools, or copied the profile folder off the disk, could
 * read a class list or a medication round. It is now sealed with AES-GCM, and
 * the URL it was fetched from is replaced by a keyed hash, so the store does
 * not even say whose record or which class a row is.
 *
 * The keys are generated in the browser, marked non-extractable and kept in
 * IndexedDB as CryptoKey objects. The browser will use them for this origin
 * but will not hand over their bytes, to this code or to anyone reading the
 * database file.
 *
 * What this does NOT do, stated plainly so nobody relies on it: it does not
 * stop a script running inside the app from using the keys the way the app
 * does, and it does not stop someone using a signed-in, unlocked session.
 * Those are what the Content-Security-Policy and signing out are for.
 *
 * Everything here uses the browser's own Web Crypto. No hand-written crypto.
 */
import { db, idbAvailable } from './db'

const subtle = globalThis.crypto?.subtle
const KEY_ID = 'device'
const VERSION = 1

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** False on an insecure origin (plain http that is not localhost): no Web Crypto there. */
export const cryptoAvailable = Boolean(idbAvailable && subtle)

let keysPromise = null

async function loadOrCreateKeys() {
    const stored = await db.keys.get(KEY_ID)
    if (stored?.aes && stored?.mac) return stored

    // `false` = non-extractable: usable for encrypt/decrypt and sign, never
    // exportable as bytes.
    const [aes, mac] = await Promise.all([
        subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
        subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    ])
    const fresh = { id: KEY_ID, aes, mac, createdAt: Date.now() }
    await db.keys.put(fresh)
    return fresh
}

function keys() {
    if (!cryptoAvailable) return Promise.reject(new Error('Encrypted offline storage is unavailable.'))
    keysPromise ??= loadOrCreateKeys().catch(err => { keysPromise = null; throw err })
    return keysPromise
}

/**
 * Throw the keys away. Every row sealed with them becomes unreadable at once,
 * including any copy of the database made earlier. Used when the person signs
 * out, alongside deleting the rows themselves.
 */
export async function destroyKeys() {
    keysPromise = null
    if (!idbAvailable) return
    try { await db.keys.clear() } catch { /* storage blocked: nothing to destroy */ }
}

/**
 * A stand-in for a lookup key (a URL with its parameters, a dedupe key) that
 * says nothing about it. Keyed, so it cannot be reversed by hashing a list of
 * likely URLs the way a plain SHA-256 could.
 */
export async function blindIndex(text) {
    const { mac } = await keys()
    const digest = await subtle.sign('HMAC', mac, encoder.encode(text))
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Seal a JSON-able value. `context` is bound into the seal (AES-GCM additional
 * data): a row copied onto another row's key, or onto another user, fails to
 * open instead of quietly returning someone else's data.
 */
export async function seal(value, context) {
    const { aes } = await keys()
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))   // fresh per record, always
    const ct = await subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: encoder.encode(context) },
        aes, encoder.encode(JSON.stringify(value ?? null)))
    return { v: VERSION, iv, ct }
}

/** The value back, or `undefined` when the record cannot be opened (wrong key, tampered, moved). */
export async function open(record, context) {
    if (!record || record.v !== VERSION || !record.iv || !record.ct) return undefined
    try {
        const { aes } = await keys()
        const plain = await subtle.decrypt(
            { name: 'AES-GCM', iv: record.iv, additionalData: encoder.encode(context) },
            aes, record.ct)
        return JSON.parse(decoder.decode(plain))
    } catch {
        return undefined
    }
}

/* Tests only: the key promise is module state and would outlive a cleared database. */
export function __resetKeyCache() {
    keysPromise = null
}
