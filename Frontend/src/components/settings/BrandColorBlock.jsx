import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { updateSchoolSettings } from '../../api/dos'
import { refreshSchoolBranding, useSchoolBranding } from '../../hooks/useSchoolBranding'
import { DEFAULT_BRAND, contrastWithWhite, deriveBrandTheme, isHexColor, isReadableBrand } from '../../utils/brandTheme'

// Starting points that all carry white text. A school can type any other
// colour; the hex field says if it is too light.
const PRESETS = ['#003d7a', '#0f766e', '#166534', '#7c2d12', '#9f1239', '#6b21a8', '#374151']

/**
 * The school's colour. One pick recolours the sidebar, buttons and links in
 * every portal. Saved on its own, like the logo; refused when white text would
 * not be readable on it, with the reason shown before the server has to.
 */
export function BrandColorBlock() {
    const { t } = useTranslation()
    const toast = useToast()
    const { brandColor } = useSchoolBranding()
    const [value, setValue] = useState(brandColor || DEFAULT_BRAND)
    const [busy, setBusy] = useState(false)

    useEffect(() => { setValue(brandColor || DEFAULT_BRAND) }, [brandColor])

    const valid = isHexColor(value)
    const readable = isReadableBrand(value)
    const theme = deriveBrandTheme(value)
    const saved = (brandColor || DEFAULT_BRAND).toLowerCase()
    const dirty = valid && value.toLowerCase() !== saved

    async function save(next) {
        setBusy(true)
        try {
            await updateSchoolSettings({ brand_color: next })
            await refreshSchoolBranding()
            toast.success(t(next ? 'admin.settings.colorSaved' : 'admin.settings.colorReset'))
        } catch (err) {
            toast.error(errorMessage(err, t('admin.settings.colorFailed')))
        } finally { setBusy(false) }
    }

    return (
        <div className="settings-block">
            <div className="settings-block-label">
                <p className="settings-block-title">{t('admin.settings.color')}</p>
                <p className="settings-block-desc">{t('admin.settings.colorDesc')}</p>
            </div>
            <div className="brand-color">
                <div className="brand-color-swatches" role="group" aria-label={t('admin.settings.colorPresets')}>
                    {PRESETS.map(hex => (
                        <button key={hex} type="button" className={`brand-swatch${value.toLowerCase() === hex ? ' is-on' : ''}`}
                            style={{ background: hex }} aria-label={hex} aria-pressed={value.toLowerCase() === hex}
                            onClick={() => setValue(hex)} />
                    ))}
                </div>
                <div className="brand-color-input">
                    <input type="color" className="brand-color-picker" value={valid ? value.toLowerCase() : DEFAULT_BRAND}
                        onChange={e => setValue(e.target.value)} aria-label={t('admin.settings.color')} />
                    <input className="form-input" value={value} maxLength={7} spellCheck={false}
                        onChange={e => setValue(e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value)}
                        aria-label={t('admin.settings.colorHex')} />
                </div>
                {valid && (
                    <div className="brand-color-preview" aria-hidden="true">
                        <span className="brand-preview-bar" style={{ background: theme['--chrome-from'] || value }}>{t('admin.settings.colorPreviewBar')}</span>
                        <span className="brand-preview-btn" style={{ background: theme['--primary'] || value }}>{t('admin.settings.colorPreviewButton')}</span>
                    </div>
                )}
                <p className={`brand-color-note${valid && !readable ? ' is-bad' : ''}`} role="status">
                    {!valid
                        ? t('admin.settings.colorInvalid')
                        : readable
                            ? t('admin.settings.colorReadable', { ratio: contrastWithWhite(value).toFixed(1) })
                            : t('admin.settings.colorTooLight', { ratio: contrastWithWhite(value).toFixed(1) })}
                </p>
                <div className="brand-logo-actions">
                    <button className="btn btn-primary btn-sm" disabled={busy || !dirty || !readable} onClick={() => save(value.toLowerCase())}>
                        {t('admin.settings.colorSave')}
                    </button>
                    {brandColor && (
                        <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => save('')}>
                            {t('admin.settings.colorUseDefault')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
