import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { sendFeeReminders, getAutoReminders, updateAutoReminders } from '../../api/finance'
import { formatDate } from '../../utils/date'
import { Money } from './FinanceShell'

/**
 * The same reminder, sent on a schedule. Saves the moment it is changed, so
 * there is no second Save to forget; a failed save puts the control back and
 * says why.
 */
function AutoReminders() {
    const { t } = useTranslation()
    const toast = useToast()
    const [auto, setAuto] = useState(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        let alive = true
        getAutoReminders()
            .then(r => { if (alive) setAuto(r) })
            .catch(e => toast.error(errorMessage(e, t('finance.reminders.auto.loadFailed'))))
        return () => { alive = false }
        // toast and t are stable enough; loading once is the point.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function change(patch) {
        const before = auto
        setAuto({ ...auto, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v])) })
        setBusy(true)
        try {
            setAuto(await updateAutoReminders(patch))
            toast.success(t('finance.reminders.auto.saved'))
        } catch (e) {
            setAuto(before)
            toast.error(errorMessage(e, t('finance.reminders.auto.saveFailed')))
        } finally { setBusy(false) }
    }

    if (!auto) return null
    return (
        <section className="card mt-1-5" aria-label={t('finance.reminders.auto.title')}>
            <div className="card-content">
                <h4>{t('finance.reminders.auto.title')}</h4>
                <p className="u-muted u-sm">{t('finance.reminders.auto.desc')}</p>
                <label className="form-check">
                    <input type="checkbox" checked={auto.enabled} disabled={busy}
                        onChange={e => change({ enabled: e.target.checked })} />
                    <span>{t('finance.reminders.auto.enabled')}</span>
                </label>
                {auto.enabled && (
                    <div className="form-grid mt-1">
                        <label className="form-group">
                            <span className="form-label">{t('finance.reminders.auto.min')}</span>
                            <input className="form-input" type="number" min="0" max="100"
                                defaultValue={auto.min_percent} disabled={busy}
                                onBlur={e => e.target.value !== String(auto.min_percent)
                                    && change({ min_percent: Number(e.target.value) })} />
                        </label>
                        <label className="form-group">
                            <span className="form-label">{t('finance.reminders.auto.every')}</span>
                            <input className="form-input" type="number" min="1" max="90"
                                defaultValue={auto.every_days} disabled={busy}
                                onBlur={e => e.target.value !== String(auto.every_days)
                                    && change({ every_days: Number(e.target.value) })} />
                        </label>
                    </div>
                )}
                {auto.enabled && (
                    <p className="u-muted u-sm mt-1">
                        {auto.last_sent
                            ? t('finance.reminders.auto.lastSent', { when: formatDate(auto.last_sent) })
                            : t('finance.reminders.auto.neverSent')}
                    </p>
                )}
            </div>
        </section>
    )
}

/**
 * Remind every family past a threshold in one go.
 *
 * The bursar looks before sending: Preview says how many families and how much
 * they owe, and shows the first message as it will read. Change anything and
 * the preview is cleared, so what is sent is always what was last looked at.
 */
export function RemindersModal({ params, onClose }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [form, setForm] = useState({
        min_percent: '50', min_amount: '0', sms: true, message: t('finance.reminders.defaultMessage'),
    })
    const [preview, setPreview] = useState(null)
    const [busy, setBusy] = useState(false)

    function set(key, value) {
        setForm(f => ({ ...f, [key]: value }))
        setPreview(null)
    }

    const body = dry => ({ ...params, ...form, dry_run: dry })

    async function look() {
        setBusy(true)
        try {
            setPreview(await sendFeeReminders(body(true)))
        } catch (e) {
            toast.error(errorMessage(e, t('finance.reminders.previewFailed')))
        } finally { setBusy(false) }
    }

    async function send() {
        setBusy(true)
        try {
            const r = await sendFeeReminders(body(false))
            toast.success(t('finance.reminders.sent', { reached: r.reached, unreachable: r.unreachable }))
            onClose()
        } catch (e) {
            toast.error(errorMessage(e, t('finance.reminders.sendFailed')))
        } finally { setBusy(false) }
    }

    return (
        <Modal title={t('finance.reminders.title')} icon="sms" onClose={onClose}
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-outline" onClick={look} disabled={busy}>
                        {t('finance.reminders.preview')}
                    </button>
                    <button className="btn btn-primary" onClick={send}
                        disabled={busy || !preview || preview.families === 0}>
                        {t('finance.reminders.send', { count: preview?.families ?? 0 })}
                    </button>
                </>
            }>
            <div className="form-grid">
                <label className="form-group">
                    <span className="form-label">{t('finance.reminders.minPercent')}</span>
                    <input className="form-input" type="number" min="0" max="100" value={form.min_percent}
                        onChange={e => set('min_percent', e.target.value)} />
                </label>
                <label className="form-group">
                    <span className="form-label">{t('finance.reminders.minAmount')}</span>
                    <input className="form-input" type="number" min="0" step="1000" value={form.min_amount}
                        onChange={e => set('min_amount', e.target.value)} />
                </label>
                <label className="form-group form-col-full">
                    <span className="form-label">{t('finance.reminders.message')}</span>
                    <textarea className="form-input form-textarea" rows="4" value={form.message}
                        onChange={e => set('message', e.target.value)} />
                    <span className="text-xs-muted">{t('finance.reminders.placeholders')}</span>
                </label>
            </div>
            <label className="form-check mt-1">
                <input type="checkbox" checked={form.sms} onChange={e => set('sms', e.target.checked)} />
                <span>{t('finance.reminders.alsoSms')}</span>
            </label>

            <AutoReminders />

            {preview && (
                <div className="card mt-1-5" role="status">
                    <div className="card-content">
                        {preview.families === 0 ? (
                            <p>{t('finance.reminders.nobody')}</p>
                        ) : (
                            <>
                                <p><strong>{t('finance.familyCount', { count: preview.families })}</strong>
                                    {' · '}<Money value={preview.total} /></p>
                                <p className="u-muted u-sm">{t('finance.reminders.sample')}</p>
                                <blockquote>{preview.sample}</blockquote>
                            </>
                        )}
                    </div>
                </div>
            )}
        </Modal>
    )
}
