import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    // Unit/component tests live under src/. Keep Vitest out of e2e/ (Playwright),
    // otherwise it would try to run the browser specs in jsdom and fail.
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
})
