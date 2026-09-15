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
/**
 * The monthly PAYE table: each band's rate applies to the slice of pay inside
 * it. The top band is open-ended, so it has no limit box; adding a band
 * inserts it below the top.
 */
function PayeBands({ bands, onChange }) {
    const { t } = useTranslation()
    const setBand = (index, key, value) =>
        onChange(bands.map((band, i) => (i === index ? { ...band, [key]: value } : band)))
    const addBand = () => {
        const top = bands.length - 1
        const below = top > 0 ? Number(bands[top - 1].upto) || 0 : 0
        onChange([...bands.slice(0, top), { upto: below + 100000, rate: 0 }, ...bands.slice(top)])
    }
    const removeBand = index => onChange(bands.filter((_, i) => i !== index))

    return (
        <fieldset className="fin-paye mt-1-5">
            <legend className="form-label">{t('finance.settings.payeTitle')}</legend>
            <p className="text-xs-muted">{t('finance.settings.payeHint')}</p>
            <div className="data-table-wrap framed">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('finance.settings.payeUpTo')}</th>
                            <th>{t('finance.settings.payeRate')}</th>
                            <th><span className="sr-only">{t('common.actions')}</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {bands.map((band, index) => {
                            const top = index === bands.length - 1
                            return (
                                <tr key={index}>
                                    <td>
                                        {top ? (
                                            <span className="text-muted">{t('finance.settings.payeAbove')}</span>
                                        ) : (
                                            <input type="number" min="0" step="1" className="form-input"
                                                aria-label={t('finance.settings.payeUpTo')}
                                                value={band.upto ?? ''}
                                                onChange={e => setBand(index, 'upto', e.target.value)} />
                                        )}
                                    </td>
                                    <td>
                                        <input type="number" min="0" max="100" step="0.01" className="form-input"
                                            aria-label={t('finance.settings.payeRate')}
                                            value={band.rate ?? ''}
                                            onChange={e => setBand(index, 'rate', e.target.value)} />
                                    </td>
                                    <td className="action-cell">
                                        {!top && (
                                            <button type="button" className="btn btn-ghost btn-sm"
                                                onClick={() => removeBand(index)}>
                                                {t('common.remove')}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            <button type="button" className="btn btn-outline btn-sm mt-1" onClick={addBand}>
                <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                {t('finance.settings.payeAdd')}
            </button>
        </fieldset>
    )
}

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
                        <PayeBands
                            bands={form.paye_bands || []}
                            onChange={paye_bands => setForm(f => ({ ...f, paye_bands }))} />
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
