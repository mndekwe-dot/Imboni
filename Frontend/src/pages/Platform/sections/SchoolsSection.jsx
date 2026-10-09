import { useState, useEffect, useCallback } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
    getPlatformSchools, operatorCan, reactivateSchool, restrictSchool, suspendSchool,
} from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { SchoolOverviewModal } from './SchoolOverviewModal'
import { confirmDialog } from '../../../utils/confirm'

const STATUS_CLASS = {
    active:    'ok',
    trial:     'info',
    past_due:  'warn',
    // Between past due and suspended: everything still opens and exports, but
    // nothing new can be saved.
    read_only: 'warn',
    suspended: 'bad',
}

const ACTIONS = {
    restrict:   restrictSchool,
    suspend:    suspendSchool,
    reactivate: reactivateSchool,
}

export function StatusChip({ status }) {
    const { t } = useTranslation()
    const label = t(`platform.common.status.${status}`, { defaultValue: status })
    return <span className={`platform-chip platform-chip-${STATUS_CLASS[status] || 'info'}`}>{label}</span>
}

const num = v => (v === null || v === undefined ? '-' : v)

export function SchoolsSection() {
    const { t } = useTranslation()
    const toast = useToast()
    const [schools, setSchools] = useState([])
    const [loading, setLoading] = useState(true)
    const [busyId,  setBusyId]  = useState(null)
    const [openId,  setOpenId]  = useState(null)   // school being viewed in the modal

    const patchRow = (u) => setSchools(list => list.map(s => (s.id === u.id ? { ...s, ...u } : s)))

    const load = useCallback(async () => {
        setLoading(true)
        try { setSchools(await getPlatformSchools()) }
        catch (e) { toast.error(errorMessage(e, t('platform.schools.loadFailed'))) }
        finally { setLoading(false) }
    }, [toast, t])
    useEffect(() => { load() }, [load])

    const canOperate = operatorCan('operations')

    // Suspending is the one that stops a teacher taking a register on Monday
    // morning, so it asks first. Restricting and reactivating do not: one is
    // reversible in a click and the other is the recovery.
    async function act(school, kind) {
        if (kind === 'suspend' && !await confirmDialog(
            t('platform.schools.confirmSuspend', { name: school.name }), { danger: true })) return

        setBusyId(school.id)
        try {
            const updated = await ACTIONS[kind](school.id)
            setSchools(list => list.map(s => (s.id === school.id ? { ...s, ...updated } : s)))
            toast.success(t(`platform.schools.done.${kind}`, { name: school.name }))
        } catch (e) { toast.error(errorMessage(e, t(`platform.schools.failed.${kind}`, { name: school.name }))) }
        finally { setBusyId(null) }
    }

    return (
        <div className="card">
            <div className="card-content">
                <div className="platform-panel-head">
                    <h2>{t('platform.schools.title')}</h2>
                    <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
                        {loading ? t('platform.common.refreshing') : t('platform.common.refresh')}
                    </button>
                </div>

                {loading ? (
                    <p className="platform-muted">{t('platform.schools.loading')}</p>
                ) : schools.length === 0 ? (
                    <p className="platform-muted"><Trans i18nKey="platform.schools.empty" components={{ code: <code /> }} /></p>
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('platform.schools.cols.school')}</th><th>{t('platform.schools.cols.domain')}</th>
                                    <th>{t('platform.schools.cols.plan')}</th><th>{t('platform.schools.cols.status')}</th>
                                    <th>{t('platform.schools.cols.students')}</th><th>{t('platform.schools.cols.staff')}</th>
                                    <th className="platform-col-action">{t('platform.schools.cols.action')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schools.map(s => {
                                    const stopped = s.status === 'suspended'
                                    const restricted = s.status === 'read_only'
                                    const busy = busyId === s.id
                                    return (
                                        <tr key={s.id}>
                                            <td>
                                                <button className="platform-linkish" onClick={() => setOpenId(s.id)}>{s.name}</button>
                                            </td>
                                            <td className="platform-muted">{s.primary_domain || s.schema_name}</td>
                                            <td className="pf-capitalize">{s.plan}</td>
                                            <td><StatusChip status={s.status} /></td>
                                            <td>{num(s.usage?.students)}</td>
                                            <td>{num(s.usage?.staff)}</td>
                                            <td className="platform-col-action pf-nowrap">
                                                <button className="btn btn-outline btn-sm" onClick={() => setOpenId(s.id)}>{t('platform.common.view')}</button>

                                                {/* Hidden rather than disabled for anyone below
                                                    Operations: a greyed-out Suspend invites a
                                                    support agent to ask why they cannot use it.
                                                    The server refuses it regardless. */}
                                                {canOperate && (stopped || restricted ? (
                                                    <button className="btn btn-sm btn-primary pf-ml"
                                                            disabled={busy}
                                                            onClick={() => act(s, 'reactivate')}>
                                                        {busy ? '…' : t('platform.schools.reactivate')}
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button className="btn btn-sm btn-outline pf-ml"
                                                                disabled={busy}
                                                                title={t('platform.schools.restrictHint')}
                                                                onClick={() => act(s, 'restrict')} aria-label={t('platform.schools.restrictHint')}>
                                                            {busy ? '…' : t('platform.schools.restrict')}
                                                        </button>
                                                        <button className="btn btn-sm btn-outline platform-danger pf-ml"
                                                                disabled={busy}
                                                                onClick={() => act(s, 'suspend')}>
                                                            {t('platform.schools.suspend')}
                                                        </button>
                                                    </>
                                                ))}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {openId && (
                <SchoolOverviewModal
                    schoolId={openId}
                    onClose={() => setOpenId(null)}
                    onStatusChange={patchRow}
                />
            )}
        </div>
    )
}
