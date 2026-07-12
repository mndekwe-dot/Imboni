import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import {
    getPlatformSchools, suspendSchool, reactivateSchool,
    platformLogout, platformUser, isPlatformAuthed,
} from '../../api/platform'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import '../../styles/platform.css'

const STATUS_META = {
    active:    { label: 'Active',    cls: 'ok'   },
    trial:     { label: 'Trial',     cls: 'info' },
    past_due:  { label: 'Past due',  cls: 'warn' },
    suspended: { label: 'Suspended', cls: 'bad'  },
}

function StatusChip({ status }) {
    const m = STATUS_META[status] || { label: status, cls: 'info' }
    return <span className={`platform-chip platform-chip-${m.cls}`}>{m.label}</span>
}

function num(v) { return v === null || v === undefined ? '—' : v }

export function PlatformDashboard() {
    const navigate = useNavigate()
    const toast = useToast()
    const [schools, setSchools] = useState([])
    const [loading, setLoading] = useState(true)
    const [busyId,  setBusyId]  = useState(null)   // school id whose action is in flight
    const me = platformUser()

    // Guard: no platform token → login.
    useEffect(() => { if (!isPlatformAuthed()) navigate('/platform/login', { replace: true }) }, [navigate])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            setSchools(await getPlatformSchools())
        } catch (e) {
            toast.error(errorMessage(e, 'Could not load schools.'))
        } finally {
            setLoading(false)
        }
    }, [toast])

    useEffect(() => { load() }, [load])

    async function act(school, kind) {
        setBusyId(school.id)
        try {
            const fn = kind === 'suspend' ? suspendSchool : reactivateSchool
            const updated = await fn(school.id)
            setSchools(list => list.map(s => (s.id === school.id ? { ...s, ...updated } : s)))
            toast.success(kind === 'suspend'
                ? `${school.name} suspended.`
                : `${school.name} reactivated.`)
        } catch (e) {
            toast.error(errorMessage(e, `Could not ${kind} ${school.name}.`))
        } finally {
            setBusyId(null)
        }
    }

    function handleLogout() {
        platformLogout()
        navigate('/platform/login', { replace: true })
    }

    const counts = schools.reduce((acc, s) => {
        acc.total += 1
        acc[s.status] = (acc[s.status] || 0) + 1
        return acc
    }, { total: 0 })

    const cards = [
        { label: 'Schools',   value: counts.total,           icon: 'apartment' },
        { label: 'Active',    value: counts.active || 0,     icon: 'check_circle' },
        { label: 'Suspended', value: counts.suspended || 0,  icon: 'block' },
        { label: 'On trial',  value: counts.trial || 0,      icon: 'schedule' },
    ]

    return (
        <div className="platform-shell">
            <header className="platform-topbar">
                <div className="platform-brand">
                    <span className="material-symbols-rounded">hub</span>
                    <div>
                        <h1>Imboni Platform</h1>
                        <p>Operator console</p>
                    </div>
                </div>
                <div className="platform-topbar-right">
                    {me?.email && <span className="platform-whoami">{me.email}</span>}
                    <button className="platform-btn" onClick={handleLogout}>Sign out</button>
                </div>
            </header>

            <main className="platform-main">
                <div className="platform-cards">
                    {cards.map(c => (
                        <div key={c.label} className="platform-card">
                            <span className="material-symbols-rounded platform-card-icon">{c.icon}</span>
                            <div>
                                <div className="platform-card-value">{c.value}</div>
                                <div className="platform-card-label">{c.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="platform-panel">
                    <div className="platform-panel-head">
                        <h2>Schools</h2>
                        <button className="platform-btn" onClick={load} disabled={loading}>
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
                                        <th>School</th>
                                        <th>Domain</th>
                                        <th>Plan</th>
                                        <th>Status</th>
                                        <th>Students</th>
                                        <th>Staff</th>
                                        <th className="platform-col-action">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schools.map(s => {
                                        const suspended = s.status === 'suspended'
                                        const busy = busyId === s.id
                                        return (
                                            <tr key={s.id}>
                                                <td className="platform-strong">{s.name}</td>
                                                <td className="platform-muted">{s.primary_domain || s.schema_name}</td>
                                                <td style={{ textTransform: 'capitalize' }}>{s.plan}</td>
                                                <td><StatusChip status={s.status} /></td>
                                                <td>{num(s.usage?.students)}</td>
                                                <td>{num(s.usage?.staff)}</td>
                                                <td className="platform-col-action">
                                                    <button
                                                        className={`platform-btn ${suspended ? 'platform-btn-primary' : 'platform-btn-danger'}`}
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
            </main>
        </div>
    )
}
