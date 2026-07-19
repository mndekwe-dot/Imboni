import { useState, useEffect, useCallback } from 'react'
import { getPlatformSchools, suspendSchool, reactivateSchool } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { SchoolOverviewModal } from './SchoolOverviewModal'

const STATUS_META = {
    active:    { label: 'Active',    cls: 'ok'   },
    trial:     { label: 'Trial',     cls: 'info' },
    past_due:  { label: 'Past due',  cls: 'warn' },
    suspended: { label: 'Suspended', cls: 'bad'  },
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

    async function act(school, kind) {
        setBusyId(school.id)
        try {
            const fn = kind === 'suspend' ? suspendSchool : reactivateSchool
            const updated = await fn(school.id)
            setSchools(list => list.map(s => (s.id === school.id ? { ...s, ...updated } : s)))
            toast.success(`${school.name} ${kind === 'suspend' ? 'suspended' : 'reactivated'}.`)
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
                    <div className="platform-table-wrap">
                        <table className="platform-table">
                            <thead>
                                <tr>
                                    <th>School</th><th>Domain</th><th>Plan</th><th>Status</th>
                                    <th>Students</th><th>Staff</th><th className="platform-col-action">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schools.map(s => {
                                    const suspended = s.status === 'suspended'
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
                                                <button
                                                    className={`btn btn-sm ${suspended ? 'btn-primary' : 'btn-outline platform-danger'}`}
                                                    disabled={busy}
                                                    onClick={() => act(s, suspended ? 'reactivate' : 'suspend')}
                                                   
                                                >
                                                    {busy ? '…' : suspended ? 'Reactivate' : 'Suspend'}
                                                </button>
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
