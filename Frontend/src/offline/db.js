import Dexie from 'dexie'

// Local store for offline support:
//   apiCache — last successful GET response per endpoint (read fallback)
//   outbox   — writes queued while offline, replayed when back online
export const db = new Dexie('imboni-offline')

db.version(1).stores({
    apiCache: 'key, savedAt',
    outbox: '++id, dedupeKey, queuedAt',
})

// jsdom (tests) has no IndexedDB unless fake-indexeddb is loaded; real
// browsers always do. Callers use this to no-op instead of throwing.
export const idbAvailable = typeof indexedDB !== 'undefined'
