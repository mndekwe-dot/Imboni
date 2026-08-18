/**
 * i18n bootstrap — English and Kinyarwanda.
 *
 * Language is a per-user preference (`UserPreferences.language` on the backend).
 * Resolution order, first hit wins:
 *   1. `imboni_language` in localStorage — set when the user picks a language,
 *      and refreshed from the server profile on sign-in.
 *   2. The browser's own language, if it is one we support.
 *   3. English.
 *
 * localStorage is read first so the very first paint after a reload is already
 * in the right language; waiting for the profile request would flash English.
 *
 * Translations live in `en.json` / `rw.json`, keyed by dotted paths that mirror
 * the app structure (`student.results.title`). Keys are stable identifiers, not
 * English text, so rewording English never silently drops the Kinyarwanda.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './en.json'
import rw from './rw.json'

export const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English',    nativeLabel: 'English'     },
    { code: 'rw', label: 'Kinyarwanda', nativeLabel: 'Ikinyarwanda' },
]

export const LANGUAGE_STORAGE_KEY = 'imboni_language'
const FALLBACK = 'en'

const isSupported = code => SUPPORTED_LANGUAGES.some(l => l.code === code)

export function detectLanguage() {
    try {
        const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
        if (stored && isSupported(stored)) return stored
    } catch {
        // Private mode / storage disabled — fall through to the browser locale.
    }
    // navigator.language is e.g. "rw-RW" or "en-GB"; we only key off the prefix.
    const browser = (navigator?.language || '').split('-')[0]
    return isSupported(browser) ? browser : FALLBACK
}

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        rw: { translation: rw },
    },
    lng: detectLanguage(),
    fallbackLng: FALLBACK,
    // A missing Kinyarwanda key falls back to the English string rather than
    // rendering the raw key at the user.
    returnEmptyString: false,
    interpolation: {
        // React already escapes rendered values.
        escapeValue: false,
    },
})

/**
 * Switch language and remember it. Persisting to the server is the caller's
 * job (see `useLanguage`), so this stays usable before sign-in.
 */
export function setLanguage(code) {
    if (!isSupported(code)) return
    i18n.changeLanguage(code)
    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, code)
    } catch { /* storage unavailable — the in-memory change still applies */ }
    document.documentElement.setAttribute('lang', code)
}

document.documentElement.setAttribute('lang', i18n.language || FALLBACK)

export default i18n
