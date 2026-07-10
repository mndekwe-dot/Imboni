import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5174,
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
})
