import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom implements neither Element.scrollTo nor window.scrollTo. Components that
// scroll a list/window (e.g. dashboard "load more") call it from a post-render
// timer, which otherwise throws an unhandled TypeError during tests. No-op it.
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {}
if (!window.scrollTo) window.scrollTo = () => {}

afterEach(() => {
  cleanup()
  localStorage.clear()
})
