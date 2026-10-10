import Dexie from 'dexie'

// Local store for offline support:
//   apiCache — last successful GET response per allowlisted endpoint (read fallback)
//   outbox   — writes queued while offline, replayed when back online
//   keys     — the device's encryption keys (see crypto.js); never the data
//
// What is in apiCache and outbox is ciphertext. The only fields left readable
// are the ones the store has to query by: whose row it is, when it was saved,
// and a keyed hash standing in for the URL.
export const db = new Dexie('imboni-offline')

db.version(1).stores({
    apiCache: 'key, savedAt',
    outbox: '++id, dedupeKey, queuedAt',
})

// v2 adds the key store. The cached reads from v1 were plain JSON, so they are
// dropped here rather than left on disk next to their encrypted successors;
// they are only a cache and refill on the next request. The outbox is NOT
// dropped: those are someone's unsent attendance, and index.js still knows how
// to send a v1 row.
db.version(2).stores({
    apiCache: 'key, savedAt',
    outbox: '++id, dedupeKey, queuedAt',
    keys: 'id',
}).upgrade(tx => tx.table('apiCache').clear())

// jsdom (tests) has no IndexedDB unless fake-indexeddb is loaded; real
// browsers always do. Callers use this to no-op instead of throwing.
export const idbAvailable = typeof indexedDB !== 'undefined'
