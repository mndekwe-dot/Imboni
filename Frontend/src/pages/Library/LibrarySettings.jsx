import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListSection } from '../../components/ui/ListSection'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { getLibrarySettings, saveLibrarySettings } from '../../api/library'
import { LibraryShell } from './LibraryShell'

/**
 * The library's own rules.
 *
 * Changing the daily fine here affects fines raised from now on and no others:
 * the amount is frozen on the Fine row when a book comes back late, so a fine
 * already handed to a student does not change because the school later decided
 * lateness costs more.
 */
const FIELDS = [
    { key: 'loan_period_days',      type: 'number', min: 1  },
    { key: 'max_books_student',     type: 'number', min: 1  },
    { key: 'max_books_staff',       type: 'number', min: 1  },
    { key: 'renewals_allowed',      type: 'number', min: 0  },
    { key: 'reservation_hold_days', type: 'number', min: 1  },
    { key: 'fine_per_day',          type: 'number', min: 0, step: '0.01' },
    { key: 'currency',              type: 'text'            },
]

export function LibrarySettings() {
    const { t } = useTranslation()
    const toast = useToast()

    const [form, setForm]     = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        getLibrarySettings()
            .then(setForm)
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('library.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    async function save() {
        setSaving(true)
        try {
            const saved = await saveLibrarySettings(form)
            setForm(saved)
            toast.success(t('common.saved'))
        } catch (e) {
            toast.error(errorMessage(e, t('library.saveFailed')))
        } finally {
            setSaving(false)
        }
    }

    return (
        <LibraryShell title={t('library.settings.title')} subtitle={t('library.settings.subtitle')}>
            <ListSection icon="settings" title={t('library.settings.rules')}>
                {loading || !form ? (
                    <p className="u-muted">{t('common.loading')}</p>
                ) : (
                    <>
                        <div className="lib-form-grid">
                            {FIELDS.map(field => (
                                <div key={field.key}>
                                    <label className="form-label" htmlFor={`ls-${field.key}`}>
                                        {t(`library.settings.${field.key}`)}
                                    </label>
                                    <input
                                        id={`ls-${field.key}`}
                                        type={field.type}
                                        min={field.min}
                                        step={field.step}
                                        className="form-input"
                                        value={form[field.key] ?? ''}
                                        onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                                    />
                                    <p className="text-xs-muted">
                                        {t(`library.settings.${field.key}Hint`)}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="settings-save-row">
                            <button className="btn btn-primary" onClick={save} disabled={saving}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">save</span>
                                {saving ? t('common.saving') : t('common.save')}
                            </button>
                        </div>
                    </>
                )}
            </ListSection>
        </LibraryShell>
    )
}
