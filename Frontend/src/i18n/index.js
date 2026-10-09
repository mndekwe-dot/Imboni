/**
 * i18n bootstrap — English, Kinyarwanda, and French.
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
 * Translations live one file per domain under `translations/{lang}/` and are
 * imported through that language's barrel. Those files are what ships: there is
 * no generated bundle in between, so reading `translations/fr/teacher.json` is
 * reading exactly what the teacher pages render.
 *
 * Keys are stable identifiers, not English text, so rewording English never
 * silently drops the other languages.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// English is the fallback every other language leans on, so it ships in the
// main bundle. Kinyarwanda and French are fetched only when someone uses them:
// they are ~130 KB gzipped that an English-only school never needs.
import en from './translations/en'

const LAZY = {
    rw: () => import('./translations/rw'),
    fr: () => import('./translations/fr'),
}

export const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English',     nativeLabel: 'English'     },
    { code: 'rw', label: 'Kinyarwanda', nativeLabel: 'Ikinyarwanda' },
    { code: 'fr', label: 'French',      nativeLabel: 'Français'     },
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
    resources: { en: { translation: en } },
    lng: FALLBACK,
    fallbackLng: FALLBACK,
    // A missing translation key falls back to the English string rather than
    // rendering the raw key at the user.
    returnEmptyString: false,
    interpolation: {
        // React already escapes rendered values.
        escapeValue: false,
    },
})

/** Fetch a language's strings once. English is already there. */
export async function loadLanguage(code) {
    if (!LAZY[code] || i18n.hasResourceBundle(code, 'translation')) return
    const mod = await LAZY[code]()
    i18n.addResourceBundle(code, 'translation', mod.default, true, true)
}

/** Resolves once the starting language is ready, so the first paint is not English. */
export const i18nReady = loadLanguage(detectLanguage())
    .catch(() => {})
    .then(() => i18n.changeLanguage(detectLanguage()))
    .then(() => document.documentElement.setAttribute('lang', i18n.language || FALLBACK))

/**
 * Switch language and remember it. Persisting to the server is the caller's
 * job (see `useLanguage`), so this stays usable before sign-in.
 */
export function setLanguage(code) {
    if (!isSupported(code)) return
    // Bundles already loaded switch at once; otherwise load first, then switch.
    if (i18n.hasResourceBundle(code, 'translation')) i18n.changeLanguage(code)
    else loadLanguage(code).then(() => i18n.changeLanguage(code)).catch(() => {})
    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, code)
    } catch { /* storage unavailable — the in-memory change still applies */ }
    document.documentElement.setAttribute('lang', code)
}

document.documentElement.setAttribute('lang', i18n.language || FALLBACK)

export default i18n
