import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Initialise i18next for every test. Components call t() directly, and without
// this an untranslated instance returns the raw key ('nav.dashboard') instead of
// the English string, so any test asserting on visible text fails. Tests run in
// English because that is i18n's fallback and no stored preference exists.
import i18n from '../i18n'
import rw from '../i18n/translations/rw'
import fr from '../i18n/translations/fr'

// In production Kinyarwanda and French load on demand. Tests switch language
// synchronously, so they get them up front.
i18n.addResourceBundle('rw', 'translation', rw, true, true)
i18n.addResourceBundle('fr', 'translation', fr, true, true)

// The school structure is cached at module scope so that a page and the
// <ClassPicker> inside it do not each fetch it. A module cache outlives a
// test, so without the reset below a test that mocks getSchoolConfig to return
// [] is served whatever the previous test in the same file loaded.
//
// Imported from the leaf cache module, NOT from the hook: importing the hook
// here would pull api/dos (and axios) into the graph before any test file's
// vi.mock could register, and every mocked test would make a real request.
import { resetSchoolConfigCache } from '../hooks/schoolConfigCache'
import { resetLibraryFeatureCache } from '../hooks/libraryFeatureCache'
import { resetSchoolModulesCache } from '../hooks/schoolModulesCache'
import { resetFinanceFeatureCache } from '../hooks/financeFeatureCache'
import { resetSubscriptionStatus } from '../api/subscriptionState'

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

// The app asks "are you sure" through confirmDialog (a real dialog). Most tests
// only care about the answer, so they stub window.confirm; route the app's
// dialog through it. utils/confirm.test.jsx exercises the real one.
vi.mock('../utils/confirm', () => ({
  confirmDialog: message => Promise.resolve(window.confirm(message)),
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
  resetSchoolConfigCache()
  // Same reason: whether the school's plan includes the library is cached at
  // module scope, so without this a test that mocks it as enabled leaves the
  // next one unable to see the upgrade notice.
  resetLibraryFeatureCache()
  resetSchoolModulesCache()
  // Whether the plan includes the finance portal is cached the same way.
  resetFinanceFeatureCache()
  // The school's billing standing is module-scope too, and it is set from a
  // response header, so a test whose fixture returned 'read_only' would leave
  // the banner up for every test after it.
  resetSubscriptionStatus()
})
