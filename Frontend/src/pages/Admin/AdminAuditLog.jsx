import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import { getAuditLog } from '../../api/admin'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import '../../styles/tables.css'

const ACTION_FILTERS = [
    { key: '',           label: 'All'         },
    { key: 'invitation', label: 'Invitations' },
    { key: 'result',     label: 'Results'     },
    { key: 'student',    label: 'Students'    },
    { key: 'fees',       label: 'Fees'        },
]

const ACTION_BADGE = {
    'invitation.sent':      { label: 'Invite Sent',      cls: 'paid'    },
    'invitation.cancelled': { label: 'Invite Cancelled', cls: 'overdue' },
    'result.approved':      { label: 'Result Approved',  cls: 'paid'    },
    'result.rejected':      { label: 'Result Rejected',  cls: 'overdue' },
    'result.bulk_approved': { label: 'Bulk Approved',    cls: 'paid'    },
    'student.suspended':    { label: 'Suspended',        cls: 'overdue' },
    'student.reinstated':   { label: 'Reinstated',       cls: 'paid'    },
    'fees.reminders_sent':  { label: 'Fee Reminders',    cls: 'partial' },
}

function formatWhen(iso) {
    try {
        return new Date(iso).toLocaleString(undefined, {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        })
    } catch {
        return iso
    }
}

export function AdminAuditLog() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [entries, setEntries]     = useState([])
    const [total, setTotal]         = useState(0)
    const [page, setPage]           = useState(1)
    const [pageSize, setPageSize]   = useState(50)
    const [loading, setLoading]     = useState(true)
    const [actionFilter, setActionFilter] = useState('')
    const [search, setSearch]       = useState('')

    useEffect(() => {
        setLoading(true)
        const params = { page }
        if (actionFilter) params.action = actionFilter
        if (search.trim()) params.q = search.trim()
        getAuditLog(params)
            .then(data => {
                setEntries(data.results || [])
                setTotal(data.total || 0)
                setPageSize(data.page_size || 50)
            })
            .catch(() => setEntries([]))
            .finally(() => setLoading(false))
    }, [page, actionFilter, search])

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Audit Log"
                        subtitle="Who did what, and when — sensitive administrative actions"
                        userName={adminUser.userName}
                        userRole={adminUser.userRole}
                        userInitials={adminUser.userInitials}
                        avatarClass={adminUser.avatarClass}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Activity ({total})</h2>
                                <input
                                    className="input input-auto"
                                    placeholder="Search by person or target…"
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1) }}
                                    style={{ maxWidth: 260 }}
                                />
                            </div>
                            <div className="card-content">
                                <div className="filter-chips">
                                    {ACTION_FILTERS.map(f => (
                                        <button
                                            key={f.key}
                                            className={`filter-chip${actionFilter === f.key ? ' active' : ''}`}
                                            onClick={() => { setActionFilter(f.key); setPage(1) }}
                                        >{f.label}</button>
                                    ))}
                                </div>

                                {loading ? (
                                    <p style={{ color: 'var(--muted-foreground)', padding: '1.5rem 0' }}>Loading audit log…</p>
                                ) : entries.length === 0 ? (
                                    <p style={{ color: 'var(--muted-foreground)', padding: '1.5rem 0' }}>
                                        No audit entries yet. Actions like sending invitations, approving results
                                        and suspending students will appear here.
                                    </p>
                                ) : (
                                    <div className="adm-table-wrap">
                                        <table className="adm-table">
                                            <thead>
                                                <tr>
                                                    <th>When</th>
                                                    <th>Who</th>
                                                    <th>Action</th>
                                                    <th>Target</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {entries.map(e => {
                                                    const badge = ACTION_BADGE[e.action] || { label: e.action, cls: 'partial' }
                                                    return (
                                                        <tr key={e.id}>
                                                            <td style={{ whiteSpace: 'nowrap' }}>{formatWhen(e.created_at)}</td>
                                                            <td>
                                                                <div className="adm-name">{e.actor_name || 'System'}</div>
                                                                <div className="adm-sub">{e.actor_role}</div>
                                                            </td>
                                                            <td><span className={`adm-badge ${badge.cls}`}>{badge.label}</span></td>
                                                            <td>{e.target}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {totalPages > 1 && (
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center', marginTop: '0.75rem' }}>
                                        <button className="btn btn-outline btn-sm" disabled={page <= 1}
                                            onClick={() => setPage(p => p - 1)}>Previous</button>
                                        <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
                                            Page {page} of {totalPages}
                                        </span>
                                        <button className="btn btn-outline btn-sm" disabled={page >= totalPages}
                                            onClick={() => setPage(p => p + 1)}>Next</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
