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
 * `compact` drops the visible "Language" label for tight rows (navs, sidebar);
 * the group keeps its aria-label either way.
 *
 * `variant="dropdown"` collapses the three buttons into a select. Three pills
 * side by side need most of the width of a 400px sign-in card, which left the
 * card's own content squeezed. A native <select> is used rather than a custom
 * menu: it is keyboard-navigable and screen-reader-labelled without any work,
 * and it opens as the platform's own picker on a phone.
 */
export function LanguageSwitcher({ compact = false, variant = 'buttons' }) {
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
