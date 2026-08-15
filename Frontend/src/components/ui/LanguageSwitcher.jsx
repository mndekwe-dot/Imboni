import { useTranslation } from 'react-i18next'

import { useLanguage } from '../../hooks/useLanguage'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import '../../styles/language.css'

/**
 * English ⇄ Kinyarwanda toggle.
 *
 * Each option is labelled in its OWN language (English / Ikinyarwanda) — a user
 * stuck in a language they cannot read still has to be able to find their way
 * out, so "Kinyarwanda" written in English would be the wrong label here.
 */
export function LanguageSwitcher({ compact = false }) {
    const { t } = useTranslation()
    const { language, change, saving, languages } = useLanguage()
    const toast = useToast()

    async function pick(code) {
        if (code === language || saving) return
        try {
            await change(code)
            toast.success(t('language.changed'))
        } catch (e) {
            toast.error(errorMessage(e, 'Could not save your language preference.'))
        }
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
