# End-to-end tests (Playwright)

Real-browser tests that cover what the jsdom unit tests can't: actual routing,
the real bundle, `localStorage`/session flow, and the protected-route redirect.

## Run

```bash
npm run e2e         # headless (starts the dev server automatically)
npm run e2e:ui      # interactive UI mode
```

First time on a machine, install the browser once:

```bash
npx playwright install chromium
```

Playwright starts `npm run dev` (port 5174) itself and reuses an already-running
dev server locally.

## What's covered

- `smoke.spec.js` — the app boots: landing page, a portal login form, the 404 page.
- `login.spec.js` — valid login → redirect to the dashboard + token persisted;
  invalid login → server error shown, stays put; unauthenticated access to a
  protected route → redirect to `/login`.

## How the backend is handled

The current suite **stubs the backend at the network layer** (`page.route` on
`**/imboni/**`), so it runs with no Django/MySQL. That keeps it fast and
deterministic and still exercises the real front end end-to-end.

## Next E2E to add

The high-value flow still to cover is **offline attendance sync** — go offline,
mark attendance (queues to the Dexie outbox), come back online, and assert it
syncs. That one needs the built app with its service worker (`npm run build` +
`npm run preview`) and ideally a seeded backend to sync against, so it belongs
in a follow-up suite pointed at a real API rather than the mocked one here.
