import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright end-to-end tests — real Chromium against the running app.
 *
 * These cover what jsdom unit tests can't: real routing, the actual bundle,
 * localStorage/session flow, and browser behaviour. The current suite mocks the
 * backend at the network layer (page.route) so it runs with no Django/MySQL —
 * a future suite can point at a seeded backend for true full-stack coverage.
 *
 * Run:  npm run e2e          (headless)
 *       npm run e2e:ui       (interactive)
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,      // a stray test.only fails CI instead of silently narrowing the run
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

    use: {
        baseURL: 'http://localhost:5174',
        trace: 'on-first-retry',        // capture a trace only when a test is retried
    },

    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],

    // Boot the Vite dev server for the tests, and reuse a running one locally.
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5174',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
})
