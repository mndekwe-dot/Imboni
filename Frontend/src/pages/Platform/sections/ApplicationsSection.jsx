import { useState, useEffect, useCallback } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Modal } from '../../../components/ui/Modal'
import {
    getApplications, approveApplication, rejectApplication, provisionApplication,
    operatorCan, resendInvitation,
} from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { formatDate } from '../../../utils/date'
import { SkeletonList } from '../../../components/ui/Skeleton'

const STATUS_CLS = { pending: 'warn', approved: 'info', rejected: 'bad', provisioned: 'ok' }
const FILTERS = ['', 'pending', 'approved', 'provisioned', 'rejected']

function Field({ label, value }) {
    return value ? (
        <div className="pf-field">
            <span className="pf-field-label">{label}</span>
            <span className="pf-field-value">{value}</span>
        </div>
    ) : null
}

function ReviewModal({ app, onClose, onChanged }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [notes, setNotes] = useState(app.review_notes || '')
    const [busy, setBusy]   = useState(false)
    // Set after provisioning. Note what it does NOT contain: a password. The
    // school chooses its own from a one-time link, so there is nothing here for
    // an operator to copy into an email, and nothing to leak.
    const [result, setResult] = useState(null)
    const canOperate = operatorCan('operations')
    const a = key => t(`platform.applications.${key}`)

    async function run(fn, okMsg) {
        setBusy(true)
        try {
            const updated = await fn()
            if (updated.provisioned) setResult(updated.provisioned)
            toast.success(okMsg)
            onChanged(updated)
            if (!updated.provisioned) onClose()
        } catch (e) { toast.error(errorMessage(e, t('platform.common.actionFailed'))) }
        finally { setBusy(false) }
    }

    let footer = null
    if (!result) {
        if (app.status === 'pending') {
            footer = (
                <>
                    <button className="btn btn-outline platform-danger" disabled={busy} onClick={() => run(() => rejectApplication(app.id, notes), a('rejected'))}>{a('reject')}</button>
                    <button className="btn btn-primary" disabled={busy} onClick={() => run(() => approveApplication(app.id, notes), a('approved'))}>{a('approve')}</button>
                </>
            )
        } else if (app.status === 'approved' && canOperate) {
            footer = (
                <button className="btn btn-primary" disabled={busy} onClick={() => run(() => provisionApplication(app.id), a('provisioned'))}>
                    {busy ? a('provisioning') : a('provision')}
                </button>
            )
        } else if (app.status === 'provisioned' && canOperate) {
            // The one recovery an operator needs: a link that expired, or an
            // email that bounced.
            footer = (
                <button className="btn btn-outline" disabled={busy}
                        onClick={() => run(async () => {
                            await resendInvitation(app.id)
                            return app
                        }, a('resent'))}>
                    {busy ? a('sending') : a('resend')}
                </button>
            )
        }
    }

    return (
        <Modal title={app.school_name} icon="domain_add" onClose={onClose} footer={footer}>
            <span className={`platform-chip platform-chip-${STATUS_CLS[app.status]}`}>{t(`platform.applications.status.${app.status}`, { defaultValue: app.status })}</span>

            <div className="pf-grid pf-mt pf-mb">
                <Field label={a('fields.address')} value={app.desired_subdomain} />
                <Field label={a('fields.contact')} value={app.contact_name} />
                <Field label={a('fields.email')} value={app.contact_email} />
                <Field label={a('fields.phone')} value={app.contact_phone} />
                <Field label={a('fields.location')} value={[app.city, app.country].filter(Boolean).join(', ')} />
                <Field label={a('fields.students')} value={app.student_estimate} />
                <Field label={a('fields.plan')} value={app.plan_interest && t(`platform.common.plan.${app.plan_interest}`, { defaultValue: app.plan_interest })} />
            </div>
            {app.message && <p className="pf-pre">{app.message}</p>}

            {result ? (
                <div className="pf-callout pf-mt">
                    <p className="pf-field-value pf-mb">
                        {result.invitation?.delivered ? a('deliveredNote') : a('undeliveredNote')}
                    </p>
                    <Field label={a('fields.loginUrl')} value={result.login_url} />
                    <Field label={a('fields.sentTo')} value={result.admin_email} />
                    {result.invitation?.delivered ? (
                        <p className="pf-hint">{a('linkHint')}</p>
                    ) : (
                        <p className="pf-hint platform-danger">
                            {result.invitation?.delivery_error || a('mailRefused')}
                            {' '}{a('resendHint')}
                        </p>
                    )}
                </div>
            ) : app.status === 'pending' || app.status === 'approved' ? (
                <label className="pf-field pf-mt">
                    <span className="pf-field-label">{a('notes')}</span>
                    <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={a('notesPlaceholder')} />
                </label>
            ) : app.status === 'rejected' ? (
                <p className="platform-muted pf-mt">{a('wasRejected')}</p>
            ) : null}
        </Modal>
    )
}

export function ApplicationsSection() {
    const { t } = useTranslation()
    const toast = useToast()
    const [apps, setApps]     = useState([])
    const [filter, setFilter] = useState('')
    const [loading, setLoading] = useState(true)
    const [active, setActive] = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        try { setApps(await getApplications(filter)) }
        catch (e) { toast.error(errorMessage(e, t('platform.applications.loadFailed'))) }
        finally { setLoading(false) }
    }, [toast, filter, t])
    useEffect(() => { load() }, [load])

    function onChanged(updated) {
        setApps(list => list.map(a => (a.id === updated.id ? { ...a, ...updated } : a)))
        setActive(a => (a && a.id === updated.id ? { ...a, ...updated } : a))
    }

    const statusLabel = s => t(`platform.applications.status.${s}`, { defaultValue: s })

    return (
        <div className="card">
            <div className="card-content">
                <div className="platform-panel-head">
                    <h2>{t('platform.applications.title')}</h2>
                    <select className="form-input platform-input-sm" value={filter} onChange={e => setFilter(e.target.value)}
                            aria-label={t('platform.applications.filterLabel')}>
                        {FILTERS.map(v => <option key={v} value={v}>{statusLabel(v || 'all')}</option>)}
                    </select>
                </div>

                {loading ? (
                    <SkeletonList items={3} />
                ) : apps.length === 0 ? (
                    <p className="platform-muted"><Trans i18nKey="platform.applications.empty" components={{ code: <code /> }} /></p>
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('platform.applications.cols.school')}</th><th>{t('platform.applications.cols.address')}</th>
                                    <th>{t('platform.applications.cols.contact')}</th><th>{t('platform.applications.cols.received')}</th>
                                    <th>{t('platform.applications.cols.status')}</th>
                                    <th className="platform-col-action">{t('platform.applications.cols.review')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {apps.map(a => (
                                    <tr key={a.id}>
                                        <td className="platform-strong">{a.school_name}</td>
                                        <td className="platform-muted">{a.desired_subdomain}</td>
                                        <td>{a.contact_name}<div className="platform-muted pf-subtle">{a.contact_email}</div></td>
                                        <td className="platform-muted">{formatDate(a.created_at)}</td>
                                        <td><span className={`platform-chip platform-chip-${STATUS_CLS[a.status]}`}>{statusLabel(a.status)}</span></td>
                                        <td className="platform-col-action">
                                            <button className="btn btn-outline btn-sm" onClick={() => setActive(a)}>{t('platform.applications.open')}</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {active && <ReviewModal app={active} onClose={() => setActive(null)} onChanged={onChanged} />}
        </div>
    )
}
