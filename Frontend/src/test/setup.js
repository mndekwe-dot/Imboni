import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Initialise i18next for every test. Components call t() directly, and without
// this an untranslated instance returns the raw key ('nav.dashboard') instead of
// the English string, so any test asserting on visible text fails. Tests run in
// English because that is i18n's fallback and no stored preference exists.
import '../i18n'

// jsdom implements neither Element.scrollTo nor window.scrollTo. Components that
// scroll a list/window (e.g. dashboard "load more") call it from a post-render
// timer, which otherwise throws an unhandled TypeError during tests. No-op it.
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {}
if (!window.scrollTo) window.scrollTo = () => {}

// jsdom doesn't implement the native <dialog> methods our shared Modal uses.
// Polyfill them so any component that opens a Modal can be tested.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { this.open = true }
  }
  if (!HTMLDialogElement.prototype.show) {
    HTMLDialogElement.prototype.show = function () { this.open = true }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
  }
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})
