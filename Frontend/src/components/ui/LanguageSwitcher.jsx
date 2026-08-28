import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useLanguage } from '../../hooks/useLanguage'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import '../../styles/language.css'

/**
 * Language toggle — English, Ikinyarwanda, Français.
 *
 * Each option is labelled in its OWN language — a user stuck in a language they
 * cannot read still has to be able to find their way out, so "Kinyarwanda"
 * written in English would be the wrong label here.
 *
 * Works signed out: `useLanguage` skips the authenticated save and keeps the
 * choice in localStorage until sign-in. That matters on the login pages, where
 * someone who cannot read the form has to be able to switch before filling it.
 *
 * Three variants, one behaviour:
 *
 *   'menu' (default)  a globe + the current code, opening a labelled menu.
 *                     This is what every portal header uses. Three pills side
 *                     by side spelled out "English Ikinyarwanda Français" in
 *                     the middle of the header — the widest thing in the bar,
 *                     and it pushed the user block towards the edge on a
 *                     laptop. One small control replaces it.
 *   'buttons'         the three pills, for wide public surfaces (footer, nav).
 *                     `compact` drops the visible "Language" label.
 *   'dropdown'        a native <select>, for the sign-in card — it opens as
 *                     the platform's own picker on a phone.
 */
export function LanguageSwitcher({ compact = false, variant = 'menu' }) {
    const { t, i18n } = useTranslation()
    const { language, change, saving, languages } = useLanguage()
    const toast = useToast()

    async function pick(code) {
        if (code === language || saving) return
        try {
            await change(code)
            // `t` here is the one captured when the button rendered, so it is
            // still bound to the language we just left — it would confirm the
            // switch to Kinyarwanda in English. `i18n.t` reads the live one.
            toast.success(i18n.t('language.changed'))
        } catch (e) {
            toast.error(errorMessage(e, 'Could not save your language preference.'))
        }
    }

    if (variant === 'menu') {
        return (
            <LanguageMenu
                language={language}
                languages={languages}
                saving={saving}
                onPick={pick}
                label={t('language.label')}
            />
        )
    }

    if (variant === 'dropdown') {
        return (
            <div className="lang-select-wrap">
                <span className="material-symbols-rounded lang-select-icon" aria-hidden="true">translate</span>
                <select
                    className="lang-select"
                    value={language}
                    disabled={saving}
                    aria-label={t('language.label')}
                    onChange={e => pick(e.target.value)}
                >
                    {languages.map(l => (
                        // Labelled in its own language: someone stuck in a
                        // language they cannot read still has to find the way out.
                        <option key={l.code} value={l.code} lang={l.code}>{l.nativeLabel}</option>
                    ))}
                </select>
                <span className="material-symbols-rounded lang-select-caret" aria-hidden="true">expand_more</span>
            </div>
        )
    }

    return (
        <div className={`lang-switch${compact ? ' lang-switch--compact' : ''}`}>
            {!compact && <span className="lang-switch-label">{t('language.label')}</span>}
            <div className="lang-switch-options" role="group" aria-label={t('language.label')}>
                {languages.map(l => (
                    <button
                        key={l.code}
                        type="button"
                        lang={l.code}
                        className={`lang-switch-btn${language === l.code ? ' active' : ''}`}
                        aria-pressed={language === l.code}
                        disabled={saving}
                        onClick={() => pick(l.code)}
                    >
                        {l.nativeLabel}
                    </button>
                ))}
            </div>
        </div>
    )
}

/**
 * The menu variant.
 *
 * A <button> plus an absolutely positioned list rather than a native <select>,
 * because the closed state has to read as a globe and a two-letter code while
 * the open state has to show each language written out in full. A <select>
 * shows the same string in both.
 *
 * So everything the native picker would have given for free is written out
 * here: Escape closes, an outside click closes, focus returns to the trigger,
 * and the open list is a `listbox` whose options carry `aria-selected`.
 */
function LanguageMenu({ language, languages, saving, onPick, label }) {
    const [open, setOpen] = useState(false)
    const wrapRef = useRef(null)
    const triggerRef = useRef(null)

    useEffect(() => {
        if (!open) return
        function onDocPointer(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
        }
        function onKey(e) {
            if (e.key !== 'Escape') return
            setOpen(false)
            triggerRef.current?.focus()
        }
        document.addEventListener('mousedown', onDocPointer)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onDocPointer)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const current = languages.find(l => l.code === language) || languages[0]

    return (
        <div className="lang-menu" ref={wrapRef}>
            <button
                ref={triggerRef}
                type="button"
                className={`lang-menu-trigger${open ? ' open' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={label}
                disabled={saving}
                onClick={() => setOpen(o => !o)}
            >
                <span className="material-symbols-rounded lang-menu-globe" aria-hidden="true">language</span>
                <span className="lang-menu-code">{current?.code.toUpperCase()}</span>
                <span className="material-symbols-rounded lang-menu-caret" aria-hidden="true">expand_more</span>
            </button>

            {open && (
                <ul className="lang-menu-list" role="listbox" aria-label={label}>
                    {languages.map(l => {
                        const active = l.code === language
                        return (
                            <li key={l.code} role="option" aria-selected={active}>
                                <button
                                    type="button"
                                    lang={l.code}
                                    className={`lang-menu-item${active ? ' active' : ''}`}
                                    disabled={saving}
                                    onClick={() => { setOpen(false); onPick(l.code) }}
                                >
                                    <span className="lang-menu-item-code">{l.code.toUpperCase()}</span>
                                    <span className="lang-menu-item-label">{l.nativeLabel}</span>
                                    {active && (
                                        <span className="material-symbols-rounded lang-menu-check" aria-hidden="true">check</span>
                                    )}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
