import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { setLanguage, SUPPORTED_LANGUAGES, LANGUAGE_STORAGE_KEY } from '../i18n'
import { getMyPreferences, updateMyPreferences } from '../api/account'

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
        setSaving(true)
        try {
            await updateMyPreferences({ language: code })
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
 * Pull the signed-in user's stored language once and apply it.
 *
 * Mount this ONCE, high in the authenticated tree. Skipped entirely when there
 * is no access token, so the public pages never fire an authenticated request.
 * If the stored value already matches what we booted with, nothing happens —
 * the common case costs one request and no re-render.
 */
export function useSyncStoredLanguage() {
    useEffect(() => {
        if (!localStorage.getItem('imboni_access')) return

        let cancelled = false
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
