# Offline-First Study Guide — Learn the Tools from Scratch

This is a **teaching** guide. It explains the ideas and tools behind Imboni's
offline support so you understand *why* each piece exists, not just where it
lives. For the "how our code is wired" reference, see `OFFLINE_GUIDE.md`.

Read this once top-to-bottom; it builds up one concept at a time.

---

## Table of Contents

1. [The core problem](#1-the-core-problem)
2. [Mental model: three layers](#2-mental-model-three-layers)
3. [Tool 1 — Progressive Web Apps (PWA)](#3-tool-1--progressive-web-apps-pwa)
4. [Tool 2 — Service Workers](#4-tool-2--service-workers)
5. [Tool 3 — Workbox & vite-plugin-pwa](#5-tool-3--workbox--vite-plugin-pwa)
6. [Tool 4 — IndexedDB & Dexie](#6-tool-4--indexeddb--dexie)
7. [The read-cache pattern](#7-the-read-cache-pattern)
8. [The outbox pattern (offline writes)](#8-the-outbox-pattern-offline-writes)
9. [Conflict resolution: last-write-wins](#9-conflict-resolution-last-write-wins)
10. [Why only *some* actions go offline](#10-why-only-some-actions-go-offline)
11. [Testing offline code](#11-testing-offline-code)
12. [Cheat sheet](#12-cheat-sheet)
13. [Exercises](#13-exercises)

---

## 1. The core problem

A normal web app assumes the network is always there. Every button press does
`fetch()` → wait → show result. Take the network away and the whole thing
falls over: blank screens, spinners that never end, lost work.

For a school in Rwanda, the network is the *unreliable* part. A teacher marking
a register in a classroom with no Wi-Fi shouldn't lose the register. That's the
job of "offline-first": **treat the network as an enhancement, not a
requirement.**

Three things break when the network goes away, and each needs a different fix:

| What breaks | Fix | Tool |
|---|---|---|
| The app won't even load | Cache the app's own files | Service worker (PWA) |
| Pages have no data to show | Cache the last API responses | IndexedDB read cache |
| Saving fails and work is lost | Queue the save, send it later | IndexedDB outbox |

## 2. Mental model: three layers

Picture offline support as three independent layers. You can build them in
order, and each is useful on its own.

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: App shell   → the app opens with no network     │  ← service worker
├─────────────────────────────────────────────────────────┤
│ Layer 2: Read cache  → pages show last-known data        │  ← IndexedDB
├─────────────────────────────────────────────────────────┤
│ Layer 3: Write sync  → saves queue and sync later        │  ← IndexedDB + logic
└─────────────────────────────────────────────────────────┘
```

Layer 1 is "the app loads." Layer 2 is "you can read." Layer 3 is "you can
write." Layer 3 is by far the hardest because writing offline creates the
possibility of **conflicts** — two people (or the same person on two devices)
changing the same thing while disconnected.

## 3. Tool 1 — Progressive Web Apps (PWA)

A **PWA** is just a website that meets a few criteria, letting the browser
treat it like an installed app:

1. Served over **HTTPS** (localhost counts, for development)
2. Has a **web app manifest** — a JSON file describing name, icons, colors
3. Registers a **service worker** — a script that can intercept network requests

Meet those and the browser offers "Add to Home Screen." The installed app has
no address bar, its own icon, and — crucially — can work offline.

**The manifest** (in Imboni, generated from `vite.config.js`):

```json
{
  "name": "Imboni School",
  "short_name": "Imboni",
  "start_url": "/",
  "display": "standalone",          // no browser chrome — looks native
  "theme_color": "#003d7a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512-maskable.png", "sizes": "512x512", "purpose": "maskable" }
  ]
}
```

> **maskable icons**: Android may crop your icon into a circle/squircle. A
> "maskable" icon keeps its important content inside a safe zone (~80% center)
> so cropping doesn't cut off the logo. That's why we generate a separate
> `-maskable` icon with extra padding.

## 4. Tool 2 — Service Workers

This is the key idea, and the one most people find strange at first.

A **service worker** is a JavaScript file that the browser runs **in the
background, separate from your page**. It sits between your app and the
network like a programmable proxy:

```
Your page  ──fetch()──▶  [ Service Worker ]  ──▶  Network
                              │
                              └─▶ can answer from cache instead
```

Every network request your page makes can be intercepted by the service
worker, which decides: fetch from network, serve from cache, or both. Because
it runs even when your page is closed, it's also what powers push
notifications and background sync in other apps.

Key facts that trip people up:

- **It only runs in production / over HTTPS.** `npm run dev` does *not*
  register it. You test with `npm run build && npm run preview`. This is
  deliberate — you don't want a stale cached app while developing.
- **It has its own lifecycle**: install → activate → controls pages. A new
  version won't take over until the old one is released (we use
  `registerType: 'autoUpdate'` so it swaps on the next navigation).
- **It can't touch the DOM.** It's a separate thread with no `window` or
  `document`. It communicates via events and messages.
- **Caching strategies** are the vocabulary you'll see:
  - *Cache First* — check cache, only hit network on a miss (great for fonts,
    logos — things that never change)
  - *Network First* — try network, fall back to cache (good for data you want
    fresh but can tolerate stale)
  - *Stale While Revalidate* — serve cache immediately, update it in the
    background for next time

In Imboni the service worker only handles **static assets** (JS, CSS, fonts,
icons). API data is handled by our own IndexedDB layer instead — because we
want per-endpoint control and testable logic, which is awkward inside a
service worker.

## 5. Tool 3 — Workbox & vite-plugin-pwa

Writing a service worker by hand is fiddly and error-prone. **Workbox** is
Google's library that generates one for you from a config. **vite-plugin-pwa**
wraps Workbox so it plugs into a Vite build — which Imboni already uses.

At build time the plugin:

1. Generates the manifest from your config
2. Generates a service worker (`dist/sw.js`) that **precaches** every built file
3. Injects the registration code into your HTML

The config you care about (`vite.config.js`):

```js
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],  // what to precache
    navigateFallback: '/index.html',      // SPA routing works offline
    navigateFallbackDenylist: [/^\/imboni\//],  // don't hijack API URLs
    runtimeCaching: [{                     // cache things fetched at runtime
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
      handler: 'CacheFirst',
    }],
  },
})
```

Two subtle but important lines:

- **`navigateFallback`** — In a single-page app, `/teacher/attendance` isn't a
  real file; React Router renders it client-side. Offline, the browser would
  ask the server for that path and fail. `navigateFallback` says "for any
  navigation, serve `index.html`" so the SPA boots and routes itself.
- **`navigateFallbackDenylist`** — but you must *exclude* API paths from that
  fallback, or a failed `GET /imboni/...` would return the HTML page instead of
  letting our IndexedDB layer handle it.

## 6. Tool 4 — IndexedDB & Dexie

`localStorage` (which Imboni uses for tokens) is a tiny key→string store: ~5MB,
strings only, synchronous. Not enough for caching API responses or a write
queue.

**IndexedDB** is the browser's real database: large (hundreds of MB),
asynchronous, stores structured objects, supports indexes and transactions.
But its raw API is famously clunky — everything is events and request objects.

**Dexie** is a thin, pleasant wrapper over IndexedDB with a Promise-based API.
Imboni's whole local store is one Dexie file:

```js
// src/offline/db.js
import Dexie from 'dexie'

export const db = new Dexie('imboni-offline')

db.version(1).stores({
  apiCache: 'key, savedAt',        // primary key 'key', index on savedAt
  outbox:   '++id, dedupeKey, queuedAt',  // ++id = auto-increment primary key
})
```

That string syntax (`'key, savedAt'`) is Dexie's schema: the first field is the
primary key, the rest are indexes. Then you get a clean async API:

```js
await db.apiCache.put({ key: '/imboni/x/', data: {...}, savedAt: Date.now() })
const row = await db.apiCache.get('/imboni/x/')
await db.outbox.add({ ... })
await db.outbox.where('dedupeKey').equals(key).delete()
```

Two tables, two jobs:
- **`apiCache`** — the read cache (Layer 2). Key = endpoint URL, value = last
  response.
- **`outbox`** — the write queue (Layer 3). Each row is a POST waiting to be
  sent.

## 7. The read-cache pattern

The trick: don't scatter caching logic across 50 pages. Do it **once**, in the
axios response interceptor (`src/api/client.js`), so every existing API call
gets it for free.

The logic is four lines of English:

```
On a successful GET      → save response to apiCache (keyed by URL + params)
On a failed GET (offline)→ return the cached copy if we have one
On any auth endpoint     → never cache (security)
Mark cached data         → __fromCache flag, so the UI can show "stale" if it wants
```

In code (simplified):

```js
client.interceptors.response.use(
  response => {
    if (response.config.method === 'get') {
      cachePut(response.config.url, response.config.params, response.data)
    }
    return response.data
  },
  async error => {
    // No error.response means the request never reached the server → offline
    if (!error.response && error.config?.method === 'get') {
      const cached = await cacheGet(error.config.url, error.config.params)
      if (cached) return markFromCache(cached.data)  // pages get last-known data
    }
    // ... otherwise normal error handling
  }
)
```

Because the interceptor is central, a teacher's class list, a student's
results, a parent's announcements — all cached with zero page changes.

**Why key by URL + params?** `/students/?class_id=1` and `/students/?class_id=2`
are different data. The cache key includes params so they don't overwrite each
other.

**Why `__fromCache` is non-enumerable:** we attach it with
`Object.defineProperty(..., { enumerable: false })` so it doesn't show up when
the data is spread (`{...data}`) or JSON-stringified — it's metadata, not part
of the payload.

## 8. The outbox pattern (offline writes)

This is Layer 3, the hard one. The idea comes from messaging apps: when you
can't send now, put the message in an **outbox** and send it when you can.

The flow:

```
Teacher taps "Save"
      │
      ▼
POST /attendance/mark/  ──▶ fails (offline)
      │
      ▼
Is this endpoint allowlisted for offline?  ── no ──▶ show normal error
      │ yes
      ▼
Save the request to the outbox table       ──▶ return { queued: true }
      │
      ▼
UI shows "Saved offline — will sync"

... later, the browser fires an 'online' event ...
      │
      ▼
flushOutbox(): replay every queued request in order
```

The replay function is where all the care goes. Here are its rules and *why*
each exists:

```js
for (const item of queuedItems) {
  try {
    await client.request(item)   // resend it
    await db.outbox.delete(item.id)   // success → remove
  } catch (err) {
    const status = err.response?.status
    if (!status || status === 401) break   // ← STOP, keep everything
    await db.outbox.delete(item.id)         // ← DROP this one, continue
  }
}
```

| Case | What we do | Why |
|---|---|---|
| Success | Delete from queue | It's saved on the server now |
| No response (network error) | **Stop**, keep all | We're offline again — try the whole queue later |
| 401 Unauthorized | **Stop**, keep all | Token expired while offline; user logs in, next flush retries |
| Other 4xx/5xx | **Drop just this one**, continue | Server permanently rejected it — if we didn't drop it, it would block every item behind it forever ("poison message") |

The last row is the subtle one. If a bad request stayed in the queue, `flush`
would try it first, fail, stop, and **nothing after it would ever sync.** One
corrupt item would jam the whole outbox. Dropping permanent rejections keeps
the queue flowing.

**Dedupe keys.** If a teacher edits the register three times while offline, you
don't want three queued saves — you want the *latest*. Each queueable endpoint
defines a `dedupeKey`:

```js
{
  pattern: /attendance\/mark\/$/,
  dedupeKey: (url, body) => `attendance|${body.class_id}|${body.date}`,
}
```

Before adding to the outbox, we delete any existing item with the same key. So
"class 1, today" only ever has one queued version — the newest.

## 9. Conflict resolution: last-write-wins

The moment you allow offline writes, you invite conflicts. Two teachers mark
the same class; a matron edits on her phone and the office edits on a desktop.
Whose version wins?

Imboni uses **last-write-wins per natural key**, and it works *because the
backend was built for it*. `MarkAttendanceView` does:

```python
AttendanceRecord.objects.update_or_create(
    student_id=..., date=...,      # the natural key
    defaults={'status': ...},      # overwrite whatever was there
)
```

So replaying a queued register is **idempotent** — running it once or twice
gives the same result — and the last save to arrive wins for each
(student, date). That's a simple, predictable rule everyone can reason about.

The deeper lesson: **offline sync is only as easy as your backend's idempotency
lets it be.** If an endpoint did `INSERT` instead of upsert, replaying it twice
would create duplicates and the whole scheme would fall apart. Design the
endpoint for replay *first*, then adding offline is nearly free.

Fancier strategies exist (operational transforms, CRDTs, version vectors with
merge UI) but they're enormous complexity. For a school register,
last-write-wins is the right amount of engineering.

## 10. Why only *some* actions go offline

A tempting mistake is "make everything offline." Don't. Each offline action is
a promise that a stale, replayed write is *safe*. That's only true for some
things.

**Good offline candidates** (in Imboni):
- Teacher attendance — idempotent upsert, small bounded data, worst Wi-Fi is
  exactly where it's used (classrooms)
- Medication doses / night checks — idempotent, dormitory = bad signal

**Deliberately NOT offline:**
- Messaging — needs real-time; a queued message minutes late is confusing
- Online quizzes — server-timed and server-graded; can't trust a client clock
- Result approvals, finance — decisions against stale data are dangerous; you
  don't approve grades or record payments you can't verify are current
- Anything admin-structural — term rollover, staff invites — low frequency, high
  stakes, no reason to risk it

The checklist before making an action offline-capable:
1. Is the endpoint **idempotent** (safe to replay)?
2. Is **last-write-wins** an acceptable conflict rule here?
3. Is the data **small and bounded**?
4. Is offline access **actually valuable** for this action?

All four yes → good candidate. Any no → leave it online-only.

## 11. Testing offline code

You can't rely on a real browser database in unit tests, and you don't want to.
Two techniques:

**`fake-indexeddb`** — a pure-JS, in-memory implementation of IndexedDB. Import
it as the *first line* and Dexie works in Node/jsdom exactly as in a browser:

```js
import 'fake-indexeddb/auto'   // MUST be first
import { db } from './db'

beforeEach(async () => {
  await db.apiCache.clear()    // fresh DB each test
  await db.outbox.clear()
})
```

**Invoke interceptors by hand** — to test the client's offline branch without a
real network, mock axios so `.create()` returns a fake, then pull the
registered interceptor functions out and call them with hand-built error
objects:

```js
// Simulate "GET failed offline, but we have a cached copy"
const result = await responseRejected({
  config: { method: 'get', url: '/imboni/teacher/my-classes/' },
  // no .response property → looks like a network failure
})
expect(result.__fromCache).toBe(true)
```

See `src/offline/offline.test.js` (the store + sync logic) and
`src/api/client.offline.test.js` (the interceptor integration) for the full
patterns — 26 assertions covering cache hits/misses, dedupe, FIFO flush, and
every failure branch of the outbox.

## 12. Cheat sheet

**Concepts**

| Term | One-liner |
|---|---|
| PWA | A website the browser can install like an app |
| Manifest | JSON describing name/icons/colors for install |
| Service worker | Background script that intercepts network requests |
| Precache | Files cached at install so the app opens offline |
| Runtime cache | Files cached the first time they're fetched |
| IndexedDB | The browser's real (async, large) database |
| Dexie | A friendly Promise wrapper over IndexedDB |
| Outbox | Queue of writes to send when back online |
| Dedupe key | Collapses repeated saves of the same thing to the latest |
| Idempotent | Safe to run more than once (upserts are) |
| Last-write-wins | Newest save to arrive wins per key |

**Caching strategies**

| Strategy | Use for |
|---|---|
| Cache First | Fonts, logos — never change |
| Network First | Data you want fresh, tolerate stale |
| Stale While Revalidate | Show cache now, update for next time |

**Outbox flush rules**

| Result | Action |
|---|---|
| Success | Delete from queue |
| Network error | Stop, keep all (still offline) |
| 401 | Stop, keep all (re-login then retry) |
| Other 4xx/5xx | Drop that item, continue (poison message) |

**Commands**

```bash
npm run build && npm run preview   # the only way to test the service worker
# DevTools → Application → Service Workers   (inspect / unregister)
# DevTools → Network → "Offline"             (simulate no connection)
# DevTools → Application → IndexedDB          (inspect apiCache / outbox)
```

## 13. Exercises

Work through these to check you actually understand it:

1. **Trace a read.** A student opens their results page offline. Walk through
   exactly what happens: which interceptor branch runs, what key is looked up,
   what the page receives. (Answer: GET fails → no `error.response` → `cacheGet`
   by URL → returns cached data marked `__fromCache`.)

2. **Why does `npm run dev` not show offline behavior?** (The service worker
   only registers in production builds — by design, so you never debug against
   a stale cache.)

3. **Break the outbox on purpose.** What would happen if we *didn't* drop items
   on a 400 error? (The bad item sits at the front of the queue forever, `flush`
   stops on it every time, nothing behind it ever syncs — a poison message.)

4. **Add a new offline action (design only).** Say we wanted offline "mark
   homework submitted." Run the four-question checklist from section 10. Is the
   endpoint idempotent? What would the `dedupeKey` be?

5. **Explain the dependency.** Why is offline attendance easy but offline
   finance hard, in terms of the *backend*, not the frontend? (Attendance
   upserts on a natural key so replays are safe; finance records shouldn't be
   created against stale balances, and last-write-wins on money is wrong.)

---

**Where to go next:** read `OFFLINE_GUIDE.md` for the exact file-by-file
mapping in Imboni, then open `src/offline/index.js` — with this guide's mental
model, the code should read like prose.
