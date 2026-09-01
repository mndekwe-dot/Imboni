import { useState, useEffect, useCallback } from 'react'
import {
    getPlatformSchools, operatorCan, reactivateSchool, restrictSchool, suspendSchool,
} from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { SchoolOverviewModal } from './SchoolOverviewModal'

const STATUS_META = {
    active:    { label: 'Active',    cls: 'ok'   },
    trial:     { label: 'Trial',     cls: 'info' },
    past_due:  { label: 'Past due',  cls: 'warn' },
    // Between past due and suspended: everything still opens and exports, but
    // nothing new can be saved.
    read_only: { label: 'Read-only', cls: 'warn' },
    suspended: { label: 'Suspended', cls: 'bad'  },
}

const ACTIONS = {
    restrict:   { fn: restrictSchool,   past: 'is now read-only' },
    suspend:    { fn: suspendSchool,    past: 'suspended' },
    reactivate: { fn: reactivateSchool, past: 'reactivated' },
}

export function StatusChip({ status }) {
    const m = STATUS_META[status] || { label: status, cls: 'info' }
    return <span className={`platform-chip platform-chip-${m.cls}`}>{m.label}</span>
}

const num = v => (v === null || v === undefined ? '-' : v)

export function SchoolsSection() {
    const toast = useToast()
    const [schools, setSchools] = useState([])
    const [loading, setLoading] = useState(true)
    const [busyId,  setBusyId]  = useState(null)
    const [openId,  setOpenId]  = useState(null)   // school being viewed in the modal

    const patchRow = (u) => setSchools(list => list.map(s => (s.id === u.id ? { ...s, ...u } : s)))

    const load = useCallback(async () => {
        setLoading(true)
        try { setSchools(await getPlatformSchools()) }
        catch (e) { toast.error(errorMessage(e, 'Could not load schools.')) }
        finally { setLoading(false) }
    }, [toast])
    useEffect(() => { load() }, [load])

    const canOperate = operatorCan('operations')

    // Suspending is the one that stops a teacher taking a register on Monday
    // morning, so it asks first. Restricting and reactivating do not: one is
    // reversible in a click and the other is the recovery.
    async function act(school, kind) {
        if (kind === 'suspend' && !window.confirm(
            `Suspend ${school.name}? Nobody at the school will be able to sign in. ` +
            'To apply pressure without closing the doors, use Restrict instead.')) return

        setBusyId(school.id)
        try {
            const updated = await ACTIONS[kind].fn(school.id)
            setSchools(list => list.map(s => (s.id === school.id ? { ...s, ...updated } : s)))
            toast.success(`${school.name} ${ACTIONS[kind].past}.`)
        } catch (e) { toast.error(errorMessage(e, `Could not ${kind} ${school.name}.`)) }
        finally { setBusyId(null) }
    }

    return (
        <div className="card">
            <div className="card-content">
                <div className="platform-panel-head">
                    <h2>Schools</h2>
                    <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
                        {loading ? 'Refreshing…' : 'Refresh'}
                    </button>
                </div>

                {loading ? (
                    <p className="platform-muted">Loading schools…</p>
                ) : schools.length === 0 ? (
                    <p className="platform-muted">No schools yet. Provision one with the <code>provision_school</code> command.</p>
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>School</th><th>Domain</th><th>Plan</th><th>Status</th>
                                    <th>Students</th><th>Staff</th><th className="platform-col-action">Action</th>
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
                                                <button className="btn btn-outline btn-sm" onClick={() => setOpenId(s.id)}>View</button>

                                                {/* Hidden rather than disabled for anyone below
                                                    Operations: a greyed-out Suspend invites a
                                                    support agent to ask why they cannot use it.
                                                    The server refuses it regardless. */}
                                                {canOperate && (stopped || restricted ? (
                                                    <button className="btn btn-sm btn-primary pf-ml"
                                                            disabled={busy}
                                                            onClick={() => act(s, 'reactivate')}>
                                                        {busy ? '…' : 'Reactivate'}
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button className="btn btn-sm btn-outline pf-ml"
                                                                disabled={busy}
                                                                title="Reads and exports keep working; nothing new can be saved"
                                                                onClick={() => act(s, 'restrict')}>
                                                            {busy ? '…' : 'Restrict'}
                                                        </button>
                                                        <button className="btn btn-sm btn-outline platform-danger pf-ml"
                                                                disabled={busy}
                                                                onClick={() => act(s, 'suspend')}>
                                                            Suspend
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
