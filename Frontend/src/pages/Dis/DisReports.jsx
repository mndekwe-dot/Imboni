import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DataTable } from '../../components/ui/DataTable'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { getDisReports, updateDisReport, reviewDisReport } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const TYPE_META = {
    incident:    { cls: 'negative', label: 'Incident'    },
    warning:     { cls: 'warning',  label: 'Warning'     },
    positive:    { cls: 'positive', label: 'Positive'    },
    achievement: { cls: 'positive', label: 'Achievement' },
}

const STATUS_META = {
    pending_review: { label: 'Pending Review', style: { background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' } },
    approved:       { label: 'Approved',       style: { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' } },
    rejected:       { label: 'Rejected',       style: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' } },
}

const TYPE_FILTER_OPTIONS = [
    { key: 'all',         label: 'All'          },
    { key: 'incident',    label: 'Incidents'    },
    { key: 'warning',     label: 'Warnings'     },
    { key: 'positive',    label: 'Positive'     },
    { key: 'achievement', label: 'Achievements' },
    { key: 'pending_fu',  label: 'Pending Follow-up' },
]

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function StatusBadge({ status }) {
    const meta = STATUS_META[status] || { label: status, style: {} }
    return (
        <span style={{
            fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem',
            borderRadius: '9px', whiteSpace: 'nowrap', ...meta.style,
        }}>{meta.label}</span>
    )
}

// ── Approved report row ────────────────────────────────────────────────────────

function ApprovedRow({ report, onMarkDone }) {
    const meta      = TYPE_META[report.report_type] || { cls: '', label: report.report_type }
    const cls       = `${report.grade || ''}${report.section || ''}`
    const isPending = report.follow_up_required && !report.follow_up_completed

    return (
        <tr>
            <td>
                <div className="student-inline">
                    <div className="student-av-sm">{initials(report.student)}</div>
                    {report.student}
                </div>
            </td>
            <td><span className="class-chip">{cls}</span></td>
            <td><span className={`incident-type-tag ${meta.cls}`}>{meta.label}</span></td>
            <td>
                <div style={{ fontWeight: 500, fontSize: '.85rem' }}>{report.title}</div>
                {report.description && (
                    <div style={{ color: 'var(--muted-foreground)', fontSize: '.78rem', marginTop: '.1rem' }}>
                        {report.description}
                    </div>
                )}
            </td>
            <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{report.date}</td>
            <td className="text-muted">{report.reported_by || '—'}</td>
            <td>
                {!report.follow_up_required
                    ? <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                    : <span className={`badge ${report.follow_up_completed ? 'badge-success' : 'badge-upcoming'}`}>
                        {report.follow_up_completed ? 'Completed' : 'Pending'}
                      </span>
                }
            </td>
            <td className="action-cell">
                {isPending && (
                    <button className="btn btn-primary btn-sm" onClick={() => onMarkDone(report.id)}>
                        Mark Done
                    </button>
                )}
            </td>
        </tr>
    )
}

// ── Pending review card ────────────────────────────────────────────────────────

function PendingCard({ report, onReview }) {
    const [open,   setOpen]  = useState(false)
    const [notes,  setNotes] = useState('')
    const [saving, setSaving]= useState(false)

    const meta = TYPE_META[report.report_type] || { cls: '', label: report.report_type }
    const cls  = `${report.grade || ''}${report.section || ''}`

    async function handle(action) {
        setSaving(true)
        try {
            await onReview(report.id, action, notes)
        } finally {
            setSaving(false)
            setOpen(false)
            setNotes('')
        }
    }

    return (
        <div style={{
            background: 'var(--card)', borderRadius: '12px',
            border: '1.5px solid #f59e0b',
            overflow: 'hidden',
        }}>
            {/* Card header */}
            <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className={`disc-activity-icon ${meta.cls}`} style={{ flexShrink: 0 }}>
                    <span className="material-symbols-rounded">
                        {report.report_type === 'incident' ? 'warning' :
                         report.report_type === 'warning'  ? 'error'   :
                         report.report_type === 'positive' ? 'thumb_up' : 'emoji_events'}
                    </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{report.title}</span>
                        <span className={`incident-type-tag ${meta.cls}`}>{meta.label}</span>
                        {report.severity && (
                            <span style={{
                                fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.45rem',
                                borderRadius: '8px', background: '#fee2e2', color: '#b91c1c',
                            }}>{report.severity}</span>
                        )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                        <strong>{report.student}</strong>
                        {cls && <> &nbsp;·&nbsp; <span className="class-chip" style={{ fontSize: '0.72rem' }}>{cls}</span></>}
                        &nbsp;·&nbsp; {report.date}
                    </div>
                    {report.description && (
                        <div style={{ fontSize: '0.82rem', marginTop: '0.4rem', color: 'var(--foreground)' }}>
                            {report.description}
                        </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.5rem' }}>
                        Filed by <strong>{report.reported_by || 'Unknown'}</strong>
                        {report.location && <> &nbsp;·&nbsp; {report.location}</>}
                    </div>
                </div>
                <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setOpen(o => !o)}
                    style={{ flexShrink: 0 }}
                >
                    <span className="material-symbols-rounded icon-sm">
                        {open ? 'expand_less' : 'rate_review'}
                    </span>
                    Review
                </button>
            </div>

            {/* Review panel */}
            {open && (
                <div style={{
                    borderTop: '1px solid var(--border)',
                    padding: '1rem 1.25rem',
                    background: 'var(--muted)',
                    display: 'flex', flexDirection: 'column', gap: '0.75rem',
                }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Notes (optional)</label>
                        <textarea
                            className="form-input form-textarea"
                            rows="2"
                            placeholder="Add a note for the matron…"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                            className="btn btn-sm"
                            style={{ background: '#fee2e2', color: '#b91c1c', border: '1.5px solid #fca5a5' }}
                            onClick={() => handle('reject')}
                            disabled={saving}
                        >
                            <span className="material-symbols-rounded icon-sm">cancel</span>
                            Reject
                        </button>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handle('approve')}
                            disabled={saving}
                        >
                            <span className="material-symbols-rounded icon-sm">check_circle</span>
                            {saving ? 'Saving…' : 'Approve & Notify'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function DisReports() {
    const [reports,    setReports]    = useState([])
    const [loading,    setLoading]    = useState(true)
    const [activeTab,  setActiveTab]  = useState('approved')
    const [typeFilter, setTypeFilter] = useState('all')

    useEffect(() => {
        getDisReports()
            .then(setReports)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    async function handleMarkDone(id) {
        try {
            await updateDisReport(id, { follow_up_completed: true })
            setReports(prev => prev.map(r => r.id === id ? { ...r, follow_up_completed: true } : r))
        } catch (e) { console.error(e) }
    }

    async function handleReview(id, action, notes) {
        try {
            const updated = await reviewDisReport(id, { action, notes })
            setReports(prev => prev.map(r =>
                r.id === id
                    ? { ...r, status: updated.status, reviewed_by: updated.reviewed_by, reviewed_at: updated.reviewed_at }
                    : r
            ))
        } catch (e) { console.error(e) }
    }

    const pending  = reports.filter(r => r.status === 'pending_review')
    const approved = reports.filter(r => r.status === 'approved' || !r.status)
    const rejected = reports.filter(r => r.status === 'rejected')

    const visibleApproved = approved.filter(r => {
        if (typeFilter === 'pending_fu') return r.follow_up_required && !r.follow_up_completed
        if (typeFilter !== 'all')        return r.report_type === typeFilter
        return true
    })

    const pendingFollowUp = approved.filter(r => r.follow_up_required && !r.follow_up_completed).length

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Discipline Reports" subtitle="Behavior reports and follow-up queue" {...disUser} />

                    <DashboardContent>

                        {/* Tab bar */}
                        <div className="filter-tabs-bar mb-5">
                            <button
                                className={`filter-tab${activeTab === 'pending' ? ' active' : ''}`}
                                onClick={() => setActiveTab('pending')}
                            >
                                <span className="material-symbols-rounded">pending_actions</span>
                                Pending Review
                                {pending.length > 0 && (
                                    <span className="approval-count-badge">{pending.length}</span>
                                )}
                            </button>
                            <button
                                className={`filter-tab${activeTab === 'approved' ? ' active' : ''}`}
                                onClick={() => setActiveTab('approved')}
                            >
                                <span className="material-symbols-rounded">check_circle</span>
                                Approved
                            </button>
                            <button
                                className={`filter-tab${activeTab === 'rejected' ? ' active' : ''}`}
                                onClick={() => setActiveTab('rejected')}
                            >
                                <span className="material-symbols-rounded">cancel</span>
                                Rejected
                                {rejected.length > 0 && (
                                    <span style={{ marginLeft: '0.3rem', fontSize: '0.7rem', fontWeight: 600,
                                        background: '#fee2e2', color: '#b91c1c', borderRadius: '9px', padding: '0 5px' }}>
                                        {rejected.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {loading ? (
                            <EmptyState icon="sync" title="Loading reports…" description="Fetching behavior records." />
                        ) : (

                            /* ── Pending Review ── */
                            activeTab === 'pending' ? (
                                pending.length === 0 ? (
                                    <EmptyState
                                        icon="task_alt"
                                        title="No pending reports"
                                        description="All matron-submitted reports have been reviewed."
                                    />
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', margin: 0 }}>
                                            {pending.length} report{pending.length !== 1 ? 's' : ''} awaiting your review.
                                            Approving sends an automatic message to the matron.
                                        </p>
                                        {pending.map(r => (
                                            <PendingCard key={r.id} report={r} onReview={handleReview} />
                                        ))}
                                    </div>
                                )
                            ) :

                            /* ── Approved ── */
                            activeTab === 'approved' ? (
                                <DataTable
                                    title={`Approved Reports${pendingFollowUp > 0 ? ` — ${pendingFollowUp} follow-up pending` : ''}`}
                                    data={visibleApproved}
                                    columns={['Student', 'Class', 'Type', 'Description', 'Date', 'Reported By', 'Follow-up', 'Actions']}
                                    renderRow={(r, i) => <ApprovedRow key={r.id || i} report={r} onMarkDone={handleMarkDone} />}
                                    emptyIcon="report"
                                    emptyTitle="No approved reports"
                                    emptyDesc="No approved behavior reports on record."
                                    filterBar={
                                        <div className="filter-tabs-bar mt-0" style={{ marginBottom: '0.75rem' }}>
                                            {TYPE_FILTER_OPTIONS.map(o => (
                                                <button
                                                    key={o.key}
                                                    className={`filter-tab${typeFilter === o.key ? ' active' : ''}`}
                                                    onClick={() => setTypeFilter(o.key)}
                                                >
                                                    {o.label}
                                                    {o.key === 'pending_fu' && pendingFollowUp > 0 && (
                                                        <span className="approval-count-badge">{pendingFollowUp}</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    }
                                />
                            ) :

                            /* ── Rejected ── */
                            rejected.length === 0 ? (
                                <EmptyState icon="cancel" title="No rejected reports" description="No reports have been rejected." />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                    {rejected.map(r => {
                                        const meta = TYPE_META[r.report_type] || { cls: '', label: r.report_type }
                                        const cls  = `${r.grade || ''}${r.section || ''}`
                                        return (
                                            <div key={r.id} style={{
                                                background: 'var(--card)', borderRadius: '12px',
                                                border: '1.5px solid #fca5a5', padding: '1rem 1.25rem',
                                                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                                            }}>
                                                <div className="disc-activity-icon warning" style={{ flexShrink: 0 }}>
                                                    <span className="material-symbols-rounded">cancel</span>
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{r.title}</span>
                                                        <span className={`incident-type-tag ${meta.cls}`}>{meta.label}</span>
                                                        <StatusBadge status="rejected" />
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                                                        <strong>{r.student}</strong>
                                                        {cls && <> &nbsp;·&nbsp; <span className="class-chip" style={{ fontSize: '0.72rem' }}>{cls}</span></>}
                                                        &nbsp;·&nbsp; {r.date}
                                                    </div>
                                                    {r.review_notes && (
                                                        <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', color: '#b91c1c' }}>
                                                            Reason: {r.review_notes}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.3rem' }}>
                                                        Filed by <strong>{r.reported_by || '—'}</strong>
                                                        {r.reviewed_by && <> &nbsp;·&nbsp; Rejected by <strong>{r.reviewed_by}</strong></>}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
