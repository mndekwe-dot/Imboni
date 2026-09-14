/// <reference lib="webworker" />
/*
 * Imboni service worker.
 *
 * This file replaces vite-plugin-pwa's generated worker. The plugin ran in
 * `generateSW` mode, which cannot host custom event handlers, and Web Push
 * needs exactly that: a `push` listener that runs when the app is closed.
 *
 * Everything the generated worker used to do is reproduced below, deliberately
 * one-for-one, so switching strategies changes what the worker CAN do without
 * changing what it DOES for offline:
 *
 *   precache + globPatterns/globIgnores  -> precacheAndRoute(self.__WB_MANIFEST)
 *   navigateFallback: '/index.html'      -> NavigationRoute(createHandlerBoundToURL)
 *   navigateFallbackDenylist             -> the `denylist` option below
 *   runtimeCaching: google fonts         -> registerRoute(... CacheFirst)
 *   registerType: 'autoUpdate'           -> skipWaiting + clientsClaim
 *
 * API calls are still never touched here — the Dexie layer in src/offline owns
 * them, and the denylist keeps SPA navigation fallback away from /imboni/ too.
 */
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'

// autoUpdate: take over as soon as a new worker is installed, rather than
// waiting for every tab to close. Matches the previous registerType.
self.skipWaiting()
clientsClaim()

// Injected at build time by vite-plugin-pwa from the injectManifest config.
precacheAndRoute(self.__WB_MANIFEST)

// SPA navigation fallback. The denylist keeps API and Django-admin URLs going
// to the network — serving index.html for /imboni/... would break every fetch.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/imboni\//, /^\/admin\//],
  })
)

// Google Fonts (Inter + Material Symbols) — needed for offline icons.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com'
    || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

/* ------------------------------------------------------------------ *
 * Web Push
 * ------------------------------------------------------------------ */

// The backend sends JSON: { title, body, path, tag }. Anything else is treated
// as a plain string body so a malformed payload still surfaces something rather
// than throwing inside the worker and showing nothing at all.
function readPayload(event) {
  if (!event.data) return { title: 'Imboni', body: '' }
  try {
    return event.data.json()
  } catch {
    return { title: 'Imboni', body: event.data.text() }
  }
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event)

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Imboni', {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Same tag replaces an earlier notice instead of stacking five of them
      // on a parent's lock screen.
      tag: payload.tag || 'imboni',
      renotify: false,
      data: { path: payload.path || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification?.data?.path || '/'
  const target = new URL(path, self.location.origin).href

  // Focus an already-open tab if there is one; only open a new one otherwise.
  // Parents tap these on phones where a second tab is a real annoyance.
  event.waitUntil(
    // type defaults to window, so it is not written out: the icon-subset test
    // reads any quoted word that names an icon as one, and window is an icon.
    self.clients.matchAll({ includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === target && 'focus' in client) return client.focus()
        }
        for (const client of clientList) {
          if ('navigate' in client && 'focus' in client) {
            return client.navigate(target).then((c) => c && c.focus())
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target)
        return undefined
      })
  )
})
