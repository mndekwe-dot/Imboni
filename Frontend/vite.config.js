import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Which Django to proxy to, and which school to ask it for.
  //
  // django-tenants picks the school from the Host header, so a request arriving
  // as `localhost` resolves to the `public` schema — the tenant registry, which
  // has no `users` table. A login there does not 404, it 500s on
  // `relation "users" does not exist`. Every API call has to carry the school's
  // own host instead.
  //
  // Override either of these in Frontend/.env if your school subdomain or
  // backend port differs.
  const devApiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8001'
  const devTenantHost = env.VITE_DEV_TENANT_HOST || 'demo.localhost'

  // Rewrites Host on the way out. Set as a `configure` hook rather than
  // `changeOrigin`, which would set Host to the *target* (127.0.0.1:8001) — the
  // wrong value — and rather than a plain `headers` entry, which http-proxy
  // applies before it writes its own Host and so gets overwritten.
  const useTenantHost = proxy => {
    proxy.on('proxyReq', proxyReq => proxyReq.setHeader('Host', devTenantHost))
  }

  return {
  server: {
    port: 5174,
    // Same-origin API in dev, matching the container build where nginx serves
    // the SPA and proxies /imboni on the school's own subdomain. Two things
    // fall out of that: no CORS involved at all (so dev does not depend on
    // DEBUG leaving it wide open), and no reliance on the browser resolving
    // *.localhost, which Windows DNS does not always do.
    //
    // Requires VITE_API_BASE to be empty in Frontend/.env — see api/client.js:
    // undefined means :8000, '' means same origin, anything else is used as-is.
    proxy: {
      '/imboni': {
        target: devApiTarget,
        changeOrigin: false,
        // Notifications open ws://<origin>/imboni/ws/notifications/, so the
        // same rule has to carry the upgrade or the socket silently falls back
        // to polling.
        ws: true,
        configure: useTenantHost,
      },
      // Django admin and the static files it pulls in.
      '/admin': { target: devApiTarget, changeOrigin: false, configure: useTenantHost },
      '/static': { target: devApiTarget, changeOrigin: false, configure: useTenantHost },
      '/media': { target: devApiTarget, changeOrigin: false, configure: useTenantHost },
    },
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['imboni-logo.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Imboni School',
        short_name: 'Imboni',
        description: 'School management portals for students, parents and staff',
        start_url: '/',
        display: 'standalone',
        theme_color: '#003d7a',
        background_color: '#ffffff',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell so Imboni opens with no network
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        // API calls are handled by the Dexie layer in src/offline — never by
        // the service worker (denylist keeps SPA navigation fallback away too)
        navigateFallbackDenylist: [/^\/imboni\//, /^\/admin\//],
        runtimeCaching: [
          {
            // Google Fonts (Inter + Material Symbols) — needed for offline icons
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  }
})
