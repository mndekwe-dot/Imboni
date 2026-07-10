# Offline Guide — PWA, Caching & Sync

Imboni works with unreliable connectivity in three layers:

1. **PWA app shell** — the app itself opens with no network and is installable on phones
2. **Read cache** — the last good copy of every GET is served when offline
3. **Write outbox** — attendance and medication saves are queued offline and synced automatically

---

## 1. How it fits together

```
              ┌── online ──▶  Django API  ──▶ response also saved to IndexedDB
Page ─▶ client.js
              └── offline ─▶  GET  → last cached copy (marked __fromCache)
                             POST → outbox (only allowlisted endpoints)
                                     └─▶ replayed on the browser 'online' event
```

| Piece | File |
|---|---|
| Service worker / manifest / icons | `vite.config.js` (`VitePWA`), `public/icon-*.png` |
| IndexedDB stores (Dexie) | `src/offline/db.js` — `apiCache` + `outbox` |
| Cache, queue, sync logic | `src/offline/index.js` |
| Wiring into every API call | `src/api/client.js` (interceptors) |
| Connectivity + queue state hook | `src/hooks/useOfflineStatus.js` |
| Status pill for offline pages | `src/components/ui/OfflineIndicator.jsx` |

The service worker only caches **static assets** (JS/CSS/fonts/icons). API data
is deliberately handled in `client.js` + Dexie instead, where it's testable and
we control staleness per endpoint.

## 2. What works offline today

**Reads (everything):** any GET that succeeded once is cached, so rosters,
timetables, results and announcements all render from the last known copy.
Cached responses carry non-enumerable `__fromCache` / `__cachedAt` markers.

**Writes (allowlisted only):**

| Action | Why it's safe to queue |
|---|---|
| Teacher: save attendance register | Backend upserts on (student, date) — replays are idempotent |
| Matron: mark medication dose given | Idempotent on (schedule, date, time) |
| Matron: night check | One record per date |

Repeated offline saves of the *same* register are **deduped** — only the
latest version replays (`dedupeKey` in `src/offline/index.js`).

Everything else (messages, approvals, quizzes, finance) fails normally offline
— by design. Don't queue anything whose replay isn't idempotent or whose
decision shouldn't be made against stale data.

## 3. Sync rules (flushOutbox)

Replay happens on app start and on the browser `online` event, in FIFO order:

- **success** → removed from the queue
- **network error** → still offline; stop, keep everything
- **401** → token expired while offline; stop, keep everything, user logs in and the next flush retries
- **other 4xx/5xx** → the server permanently rejected it; the item is dropped so the queue can't jam

Conflict model: **last write wins** per natural key, matching the backend's
`update_or_create` semantics.

## 4. Making another action offline-capable

1. Make sure the backend endpoint is **idempotent** (upsert on a natural key).
2. Add it to `QUEUEABLE` in `src/offline/index.js` with a `dedupeKey`.
3. In the page, handle the queued result:
   ```js
   const res = await saveThing(data)
   if (res?.queued) {
       // show "saved offline" + update local state optimistically
   }
   ```
4. Drop `<OfflineIndicator />` somewhere visible on the page.

## 5. Developing & testing

- **Dev server**: the service worker only registers in production builds.
  Test the PWA with `npm run build && npm run preview`, then DevTools →
  Application → Service Workers. Use the Network tab's "Offline" throttle to
  simulate connectivity loss.
- **Unit tests**: import `'fake-indexeddb/auto'` as the *first* line of any
  test touching Dexie. See `src/offline/offline.test.js` and
  `src/api/client.offline.test.js` for the patterns (the client tests invoke
  the interceptors by hand with a mocked axios).
- **Installing on a phone**: serve the production build over HTTPS (or
  localhost), open in Chrome → "Add to Home Screen".

## 6. Gotchas

- **Tokens expire offline.** A teacher offline past the refresh window gets a
  401 on flush — the queue is preserved and retried after they log in again.
- **The outbox survives reloads but not "Clear site data".** It's IndexedDB.
- **Workbox precache is ~2.5 MB** — fine for school Wi-Fi, first load still
  needs a connection.
- **Don't cache auth endpoints.** `client.js` has a `NEVER_CACHE` guard —
  keep `/auth/` out of the cache and the outbox.
- **A new deploy updates automatically** (`registerType: 'autoUpdate'`) — the
  new service worker takes over on the next navigation.
