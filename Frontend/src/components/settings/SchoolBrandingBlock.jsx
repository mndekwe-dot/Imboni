import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { setSchoolLogo, removeSchoolLogo } from '../../api/branding'
import { refreshSchoolBranding, useSchoolBranding } from '../../hooks/useSchoolBranding'
import logoFallback from '../../assets/images/imboni-logo.webp'

// The same rules the server enforces, checked first so a 6 MB photo is refused
// in the browser rather than after a slow upload.
const TYPES = ['image/jpeg', 'image/png']
const MAX_BYTES = 2 * 1024 * 1024

/**
 * The school's mark: shown in the sidebar, on its sign-in screens, in the
 * browser tab and at the head of everything it prints. Saves on its own,
 * straight away, because an upload is not something to hold until a Save
 * button elsewhere on the page is pressed.
 */
export function SchoolBrandingBlock() {
    const { t } = useTranslation()
    const toast = useToast()
    const { logo } = useSchoolBranding()
    const input = useRef(null)
    const [busy, setBusy] = useState(false)

    async function pick(e) {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        if (!TYPES.includes(file.type)) { toast.error(t('admin.settings.logoWrongType')); return }
        if (file.size > MAX_BYTES) { toast.error(t('admin.settings.logoTooBig')); return }
        setBusy(true)
        try {
            await setSchoolLogo(file)
            await refreshSchoolBranding()
            toast.success(t('admin.settings.logoSaved'))
        } catch (err) {
            toast.error(errorMessage(err, t('admin.settings.logoFailed')))
        } finally { setBusy(false) }
    }

    async function remove() {
        setBusy(true)
        try {
            await removeSchoolLogo()
            await refreshSchoolBranding()
            toast.success(t('admin.settings.logoRemoved'))
        } catch (err) {
            toast.error(errorMessage(err, t('admin.settings.logoFailed')))
        } finally { setBusy(false) }
    }

    return (
        <div className="settings-block">
            <div className="settings-block-label">
                <p className="settings-block-title">{t('admin.settings.logo')}</p>
                <p className="settings-block-desc">{t('admin.settings.logoDesc')}</p>
            </div>
            <div className="settings-block-input-row brand-logo-row">
                <img className="brand-logo-preview" src={logo || logoFallback} alt={t('admin.settings.logoPreviewAlt')} />
                <div className="brand-logo-actions">
                    <input ref={input} type="file" accept="image/png,image/jpeg" hidden onChange={pick}
                        aria-label={t('admin.settings.logo')} />
                    <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => input.current?.click()}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">upload_file</span>
                        {logo ? t('admin.settings.logoReplace') : t('admin.settings.logoUpload')}
                    </button>
                    {logo && (
                        <button className="btn btn-outline btn-sm" disabled={busy} onClick={remove}>
                            {t('admin.settings.logoRemove')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
