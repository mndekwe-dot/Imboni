import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { setLanguage, SUPPORTED_LANGUAGES, LANGUAGE_STORAGE_KEY } from '../i18n'
import { getMyPreferences, updateMyPreferences } from '../api/account'

const TOKEN_KEY = 'imboni_access'

/**
 * A language picked while signed out, waiting to be saved to the account.
 *
 * The preferences endpoint is authenticated, so a visitor on /login has nowhere
 * to put their choice but localStorage. That alone is not enough: every account
 * is created with `language='en'` (see UserPreferences.language), so the sync on
 * sign-in would pull that default straight over the choice they just made. This
 * key marks the choice as deliberate so the sync pushes it up instead.
 */
const PENDING_KEY = 'imboni_language_pending'

const signedIn = () => {
    try { return !!localStorage.getItem(TOKEN_KEY) } catch { return false }
}

/**
 * Current language plus a setter that also persists the choice.
 *
 * The switch is applied locally first and the server call follows. A failed
 * save must not silently strand the user in a language the server disagrees
 * with, so `change` rejects on failure and the caller surfaces it — see the
 * toast in LanguageSwitcher.
 */
export function useLanguage() {
    const { i18n } = useTranslation()
    const [saving, setSaving] = useState(false)

    const change = useCallback(async (code) => {
        const previous = i18n.language
        setLanguage(code)              // instant feedback; no wait for the network

        // Signed out: `setLanguage` has already written localStorage, which is
        // the whole story until they authenticate. Calling the authenticated
        // endpoint here would 401 and roll the choice back in front of them.
        if (!signedIn()) {
            try { localStorage.setItem(PENDING_KEY, code) } catch { /* private mode */ }
            return
        }

        setSaving(true)
        try {
            await updateMyPreferences({ language: code })
            try { localStorage.removeItem(PENDING_KEY) } catch { /* nothing to clear */ }
        } catch (err) {
            setLanguage(previous)      // roll back so the UI matches what is stored
            throw err
        } finally {
            setSaving(false)
        }
    }, [i18n.language])

    return { language: i18n.language, change, saving, languages: SUPPORTED_LANGUAGES }
}

/**
 * Reconcile the signed-in user's language with the server, once.
 *
 * Mount this ONCE, high in the authenticated tree. Skipped entirely when there
 * is no access token, so the public pages never fire an authenticated request.
 *
 * Direction depends on how we got here. A language chosen on the way in is
 * pushed up; otherwise the account's stored value is pulled down. If the stored
 * value already matches what we booted with, nothing happens — the common case
 * costs one request and no re-render.
 */
export function useSyncStoredLanguage() {
    useEffect(() => {
        if (!signedIn()) return

        let cancelled = false
        let pending = null
        try { pending = localStorage.getItem(PENDING_KEY) } catch { /* storage off */ }

        if (pending && SUPPORTED_LANGUAGES.some(l => l.code === pending)) {
            updateMyPreferences({ language: pending })
                .then(() => { try { localStorage.removeItem(PENDING_KEY) } catch { /* ignore */ } })
                .catch(() => {
                    // Keep the pending marker: the choice still applies locally
                    // and the next sign-in gets another chance to save it.
                })
            return
        }

        getMyPreferences()
            .then(prefs => {
                const code = prefs?.language
                if (cancelled || !code) return
                if (!SUPPORTED_LANGUAGES.some(l => l.code === code)) return
                if (localStorage.getItem(LANGUAGE_STORAGE_KEY) === code) return
                setLanguage(code)
            })
            .catch(() => {
                // Preferences are not worth interrupting the session for; the
                // locally detected language stays in effect.
            })

        return () => { cancelled = true }
    }, [])
}
