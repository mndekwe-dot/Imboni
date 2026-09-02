import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListSection } from '../../components/ui/ListSection'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { getFinanceSettings, saveFinanceSettings } from '../../api/finance'
import { FinanceShell } from './FinanceShell'

const FIELDS = [
    { key: 'currency',         type: 'text'   },
    { key: 'receipt_prefix',   type: 'text'   },
    { key: 'late_fee_percent', type: 'number', min: 0, step: '0.01' },
    { key: 'grace_days',       type: 'number', min: 0 },
]

/**
 * The office's own settings.
 *
 * The receipt prefix is the one to be careful with: receipt numbers are unique
 * and sequential, so changing it mid-term leaves two prefixes in one book. The
 * hint says so rather than the field refusing the change — a school that
 * rebrands has a real reason to.
 */
export function FinanceSettings() {
    const { t } = useTranslation()
    const toast = useToast()
    const [form, setForm]       = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving]   = useState(false)

    useEffect(() => {
        getFinanceSettings()
            .then(setForm)
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    async function save() {
        setSaving(true)
        try {
            setForm(await saveFinanceSettings(form))
            toast.success(t('common.saved'))
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        } finally {
            setSaving(false)
        }
    }

    return (
        <FinanceShell title={t('finance.settings.title')} subtitle={t('finance.settings.subtitle')}>
            <ListSection icon="settings" title={t('finance.settings.office')}>
                {loading || !form ? (
                    <p className="u-muted">{t('common.loading')}</p>
                ) : (
                    <>
                        <div className="form-grid">
                            {FIELDS.map(field => (
                                <div key={field.key}>
                                    <label className="form-label" htmlFor={`fs-${field.key}`}>
                                        {t(`finance.settings.${field.key}`)}
                                    </label>
                                    <input
                                        id={`fs-${field.key}`}
                                        type={field.type}
                                        min={field.min}
                                        step={field.step}
                                        className="form-input"
                                        value={form[field.key] ?? ''}
                                        onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                                    />
                                    <p className="text-xs-muted">
                                        {t(`finance.settings.${field.key}Hint`)}
                                    </p>
                                </div>
                            ))}
                            <div className="form-col-full">
                                <label className="form-label" htmlFor="fs-bank">
                                    {t('finance.settings.bank_details')}
                                </label>
                                <textarea id="fs-bank" className="form-input form-textarea" rows="3"
                                    value={form.bank_details ?? ''}
                                    onChange={e => setForm(f => ({ ...f, bank_details: e.target.value }))} />
                                <p className="text-xs-muted">
                                    {t('finance.settings.bank_detailsHint')}
                                </p>
                            </div>
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
        </FinanceShell>
    )
}
