import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { StudentConductModal } from '../../components/modals/StudentConductModal'
import { DataTable } from '../../components/ui/DataTable'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { getDisStudents, getDisReports, updateDisReport, reviewDisReport } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function conductInfo(grade) {
    if (!grade) return { label: 'Not Rated', cls: '' }
    const g = String(grade).toLowerCase()
    if (g === 'a' || g === 'excellent') return { label: 'Excellent', cls: 'excellent' }
    if (g === 'b' || g === 'good')      return { label: 'Good',      cls: 'good'      }
    if (g === 'c' || g === 'fair')      return { label: 'Fair',      cls: 'fair'      }
    if (g === 'd' || g === 'poor')      return { label: 'Poor',      cls: 'poor'      }
    return { label: grade, cls: '' }
}

function followUpStatus(report) {
    if (!report.follow_up_required) return { label: '—',         cls: '' }
    if (report.follow_up_completed)  return { label: 'Completed', cls: 'badge-success' }
    return                                  { label: 'Pending',   cls: 'badge-upcoming' }
}

const REPORT_TYPE_LABELS = {
    incident:    { label: 'Incident',    cls: 'negative' },
    warning:     { label: 'Warning',     cls: 'warning'  },
    positive:    { label: 'Positive',    cls: 'positive' },
    achievement: { label: 'Achievement', cls: 'positive' },
}

const conductFilterOptions = [
    { key: 'all',       label: 'All'       },
    { key: 'excellent', label: 'Excellent' },
    { key: 'good',      label: 'Good'      },
    { key: 'fair',      label: 'Fair'      },
    { key: 'poor',      label: 'Poor'      },
    { key: 'none',      label: 'Not Rated' },
]

const TYPE_FILTER_OPTIONS = [
    { key: 'all',         label: 'All'               },
    { key: 'incident',    label: 'Incidents'          },
    { key: 'warning',     label: 'Warnings'           },
    { key: 'positive',    label: 'Positive'           },
    { key: 'achievement', label: 'Achievements'       },
    { key: 'pending_fu',  label: 'Pending Follow-up'  },
]

const STATUS_META = {
    pending_review: { label: 'Pending Review', style: { background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' } },
    approved:       { label: 'Approved',       style: { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' } },
    rejected:       { label: 'Rejected',       style: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' } },
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

function PendingCard({ report, onReview }) {
    const [open,   setOpen]   = useState(false)
    const [notes,  setNotes]  = useState('')
    const [saving, setSaving] = useState(false)
    const typeInfo = REPORT_TYPE_LABELS[report.report_type] || { label: report.report_type, cls: '' }
    const cls = `${report.grade || ''}${report.section || ''}`

    async function handle(action) {
        setSaving(true)
        try { await onReview(report.id, action, notes) }
        finally { setSaving(false); setOpen(false); setNotes('') }
    }

    return (
        <div style={{ background: 'var(--card)', borderRadius: '12px', border: '1.5px solid #f59e0b', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className={`disc-activity-icon ${typeInfo.cls}`} style={{ flexShrink: 0 }}>
                    <span className="material-symbols-rounded">
                        {report.report_type === 'incident' ? 'warning' : report.report_type === 'warning' ? 'error' : 'thumb_up'}
                    </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{report.title}</span>
                        <span className={`incident-type-tag ${typeInfo.cls}`}>{typeInfo.label}</span>
                        {report.severity && (
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c' }}>
                                {report.severity}
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                        <strong>{report.student}</strong>
                        {cls && <> &nbsp;·&nbsp; <span className="class-chip" style={{ fontSize: '0.72rem' }}>{cls}</span></>}
                        &nbsp;·&nbsp; {report.date}
                    </div>
                    {report.description && (
                        <div style={{ fontSize: '0.82rem', marginTop: '0.4rem' }}>{report.description}</div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.5rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>Filed by <strong>{report.reported_by || 'Unknown'}</strong></span>
                        {report.location && <span>· {report.location}</span>}
                        {report.marks_deducted != null && (
                            <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.1rem 0.5rem', fontWeight: 600, fontSize: '0.72rem' }}>
                                −{report.marks_deducted} marks
                            </span>
                        )}
                    </div>
                </div>
                <button className="btn btn-sm btn-outline" onClick={() => setOpen(o => !o)} style={{ flexShrink: 0 }}>
                    <span className="material-symbols-rounded icon-sm">{open ? 'expand_less' : 'rate_review'}</span>
                    Review
                </button>
            </div>
            {open && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem', background: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Notes (optional)</label>
                        <textarea className="form-input form-textarea" rows="2" placeholder="Add a note…" value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#b91c1c', border: '1.5px solid #fca5a5' }} onClick={() => handle('reject')} disabled={saving}>
                            <span className="material-symbols-rounded icon-sm">cancel</span> Reject
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => handle('approve')} disabled={saving}>
                            <span className="material-symbols-rounded icon-sm">check_circle</span>
                            {saving ? 'Saving…' : 'Approve & Notify'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Row components ────────────────────────────────────────────────────────────

function StudentRow({ student, onView }) {
    const ini  = initials(student.name)
    const cls  = `${student.grade}${student.section}`
    const { label, cls: conductCls } = conductInfo(student.conduct_grade)
    return (
        <tr>
            <td>
                <div className="student-inline">
                    <div className="student-av-sm">{ini}</div>
                    {student.name}
                </div>
            </td>
            <td><span className="class-chip">{cls}</span></td>
            <td className="text-muted">{student.student_id}</td>
            <td>
                {student.conduct_grade
                    ? <span className={`conduct-badge ${conductCls}`}>{label}</span>
                    : <span style={{ color: 'var(--muted-foreground)', fontSize: '.8rem' }}>—</span>
                }
            </td>
            <td>
                <span style={{ fontWeight: student.incident_count > 0 ? 600 : 400,
                    color: student.incident_count > 3 ? '#ef4444' : 'inherit' }}>
                    {student.incident_count}
                </span>
            </td>
            <td className="action-cell">
                <button className="btn btn-primary btn-sm" onClick={() => onView(student)}>View</button>
            </td>
        </tr>
    )
}

function ReportRow({ report, onMarkComplete }) {
    const typeInfo = REPORT_TYPE_LABELS[report.report_type] || { label: report.report_type, cls: '' }
    const fuStatus = followUpStatus(report)
    const cls      = `${report.grade || ''}${report.section || ''}`
    return (
        <tr>
            <td>
                <div className="student-inline">
                    <div className="student-av-sm">{initials(report.student)}</div>
                    {report.student}
                </div>
            </td>
            <td><span className="class-chip">{cls}</span></td>
            <td><span className={`incident-type-tag ${typeInfo.cls}`}>{typeInfo.label}</span></td>
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
                {fuStatus.label === '—'
                    ? <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                    : <span className={`badge ${fuStatus.cls}`}>{fuStatus.label}</span>
                }
            </td>
            <td className="action-cell">
                {report.follow_up_required && !report.follow_up_completed && (
                    <button className="btn btn-primary btn-sm" onClick={() => onMarkComplete(report.id)}>
                        Mark Done
                    </button>
                )}
            </td>
        </tr>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DisStudents() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const { config } = useSchoolConfig()
    const [activeTab, setActiveTab] = useState('students')

    // ── Students tab ──
    const [students,      setStudents]      = useState([])
    const [studLoading,   setStudLoading]   = useState(false)
    const [studLoaded,    setStudLoaded]    = useState(false)
    const [conductFilter, setConductFilter] = useState('all')
    const [section,       setSection]       = useState('')
    const [year,          setYear]          = useState('')
    const [classVal,      setClassVal]      = useState('')
    const [modal,         setModal]         = useState(null)

    // ── Reports tab ──
    const [reports,      setReports]      = useState([])
    const [repLoading,   setRepLoading]   = useState(false)
    const [repLoaded,    setRepLoaded]    = useState(false)
    const [reportSubTab, setReportSubTab] = useState('pending')
    const [typeFilter,   setTypeFilter]   = useState('all')

    // Lazy load on tab switch
    useEffect(() => {
        if (activeTab !== 'students' || studLoaded) return
        setStudLoaded(true); setStudLoading(true)
        getDisStudents().then(setStudents).catch(console.error).finally(() => setStudLoading(false))
    }, [activeTab, studLoaded])

    useEffect(() => {
        if (activeTab !== 'reports' || repLoaded) return
        setRepLoaded(true); setRepLoading(true)
        getDisReports().then(setReports).catch(console.error).finally(() => setRepLoading(false))
    }, [activeTab, repLoaded])

    async function handleMarkComplete(id) {
        try {
            await updateDisReport(id, { follow_up_completed: true })
            setReports(prev => prev.map(r => r.id === id ? { ...r, follow_up_completed: true } : r))
        } catch(e) { console.error(e) }
    }

    async function handleReview(id, action, notes) {
        try {
            const updated = await reviewDisReport(id, { action, notes })
            setReports(prev => prev.map(r =>
                r.id === id ? { ...r, status: updated.status, reviewed_by: updated.reviewed_by, reviewed_at: updated.reviewed_at } : r
            ))
        } catch(e) { console.error(e) }
    }

    // ── Filters ──
    const visibleStudents = students.filter(s => {
        const { cls: cCls } = conductInfo(s.conduct_grade)
        if (conductFilter === 'none'  && s.conduct_grade) return false
        if (conductFilter !== 'all' && conductFilter !== 'none' && cCls !== conductFilter) return false
        if (year     && s.grade   !== year)     return false
        if (classVal && s.section !== classVal) return false
        return true
    })

    const pending  = reports.filter(r => r.status === 'pending_review')
    const approved = reports.filter(r => r.status === 'approved' || !r.status)
    const rejected = reports.filter(r => r.status === 'rejected')

    const pendingFollowUp = approved.filter(r => r.follow_up_required && !r.follow_up_completed).length

    const visibleApproved = approved.filter(r => {
        if (typeFilter === 'pending_fu') return r.follow_up_required && !r.follow_up_completed
        if (typeFilter !== 'all')        return r.report_type === typeFilter
        return true
    })

    return (
        <>
            <StudentConductModal student={modal} onClose={() => setModal(null)} />
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Students"
                        subtitle="Conduct records and incident reports"
                        {...disUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <div className="filter-tabs-bar mb-5">
                            <button className={`filter-tab${activeTab === 'students' ? ' active' : ''}`}
                                onClick={() => setActiveTab('students')}>
                                <span className="material-symbols-rounded">people</span> Conduct Records
                            </button>
                            <button className={`filter-tab${activeTab === 'reports' ? ' active' : ''}`}
                                onClick={() => setActiveTab('reports')}>
                                <span className="material-symbols-rounded">report</span> Behavior Reports
                                {pending.length > 0 && (
                                    <span className="approval-count-badge">{pending.length}</span>
                                )}
                            </button>
                        </div>

                        {/* ── STUDENTS TAB ── */}
                        {activeTab === 'students' && (
                            <>
                                <ClassPicker
                                    sections={config}
                                    section={section} onSectionChange={setSection}
                                    year={year}       onYearChange={setYear}
                                    classVal={classVal} onClassChange={setClassVal}
                                />

                                <div className="card mb-1-5">
                                    <div className="card-content">
                                        <div className="filter-tabs-bar mt-0">
                                            <FilterBar options={conductFilterOptions} active={conductFilter} onChange={setConductFilter} />
                                        </div>
                                    </div>
                                </div>

                                <div className="disc-stat-grid">
                                    {[
                                        { iconClass: 'info',    icon: 'groups',  value: visibleStudents.length,                                                        label: 'Students Shown'     },
                                        { iconClass: 'success', icon: 'star',    value: visibleStudents.filter(s => conductInfo(s.conduct_grade).cls === 'excellent').length, label: 'Excellent Standing' },
                                        { iconClass: 'warning', icon: 'warning', value: visibleStudents.filter(s => conductInfo(s.conduct_grade).cls === 'fair').length,      label: 'Fair / At Risk'     },
                                        { iconClass: 'red',     icon: 'cancel',  value: visibleStudents.filter(s => conductInfo(s.conduct_grade).cls === 'poor').length,      label: 'Poor Conduct'       },
                                    ].map((s, i) => (
                                        <div key={i} className="disc-stat-card">
                                            <div className={`disc-stat-icon ${s.iconClass}`}><span className="material-symbols-rounded">{s.icon}</span></div>
                                            <div>
                                                <div className="disc-stat-value">{s.value}</div>
                                                <div className="disc-stat-label">{s.label}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {studLoading ? (
                                    <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading students…</p>
                                ) : (
                                    <DataTable
                                        title="Student Conduct Records"
                                        data={visibleStudents}
                                        columns={['Student', 'Class', 'Student ID', 'Conduct', 'Incidents', 'Actions']}
                                        renderRow={(s, i) => <StudentRow key={s.id || i} student={s} onView={setModal} />}
                                        emptyIcon="people"
                                        emptyTitle="No students found"
                                        emptyDesc="No students match the selected filters."
                                        onClearFilters={() => { setConductFilter('all'); setSection(''); setYear(''); setClassVal('') }}
                                    />
                                )}
                            </>
                        )}

                        {/* ── REPORTS TAB ── */}
                        {activeTab === 'reports' && (
                            <>
                                {/* Sub-tabs */}
                                <div className="filter-tabs-bar mb-5">
                                    <button className={`filter-tab${reportSubTab === 'pending' ? ' active' : ''}`} onClick={() => setReportSubTab('pending')}>
                                        <span className="material-symbols-rounded">pending_actions</span>
                                        Pending Review
                                        {pending.length > 0 && <span className="approval-count-badge">{pending.length}</span>}
                                    </button>
                                    <button className={`filter-tab${reportSubTab === 'approved' ? ' active' : ''}`} onClick={() => setReportSubTab('approved')}>
                                        <span className="material-symbols-rounded">check_circle</span>
                                        Approved
                                    </button>
                                    <button className={`filter-tab${reportSubTab === 'rejected' ? ' active' : ''}`} onClick={() => setReportSubTab('rejected')}>
                                        <span className="material-symbols-rounded">cancel</span>
                                        Rejected
                                        {rejected.length > 0 && (
                                            <span style={{ marginLeft: '0.3rem', fontSize: '0.7rem', fontWeight: 600, background: '#fee2e2', color: '#b91c1c', borderRadius: '9px', padding: '0 5px' }}>
                                                {rejected.length}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {repLoading ? (
                                    <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading reports…</p>
                                ) : reportSubTab === 'pending' ? (
                                    pending.length === 0 ? (
                                        <p style={{ color: 'var(--muted-foreground)', padding: '2rem 0', textAlign: 'center' }}>No pending reports — all matron reports have been reviewed.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', margin: 0 }}>
                                                {pending.length} report{pending.length !== 1 ? 's' : ''} awaiting review.
                                            </p>
                                            {pending.map(r => <PendingCard key={r.id} report={r} onReview={handleReview} />)}
                                        </div>
                                    )
                                ) : reportSubTab === 'approved' ? (
                                    <DataTable
                                        title={`Approved Reports${pendingFollowUp > 0 ? ` — ${pendingFollowUp} follow-up pending` : ''}`}
                                        data={visibleApproved}
                                        columns={['Student', 'Class', 'Type', 'Description', 'Date', 'Reported By', 'Follow-up', 'Actions']}
                                        renderRow={(r, i) => <ReportRow key={r.id || i} report={r} onMarkComplete={handleMarkComplete} />}
                                        emptyIcon="report"
                                        emptyTitle="No approved reports"
                                        emptyDesc="No approved behavior reports on record."
                                        filterBar={
                                            <div className="filter-tabs-bar mt-0" style={{ marginBottom: '0.75rem' }}>
                                                {TYPE_FILTER_OPTIONS.map(o => (
                                                    <button key={o.key} className={`filter-tab${typeFilter === o.key ? ' active' : ''}`} onClick={() => setTypeFilter(o.key)}>
                                                        {o.label}
                                                        {o.key === 'pending_fu' && pendingFollowUp > 0 && <span className="approval-count-badge">{pendingFollowUp}</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        }
                                    />
                                ) : (
                                    rejected.length === 0 ? (
                                        <p style={{ color: 'var(--muted-foreground)', padding: '2rem 0', textAlign: 'center' }}>No rejected reports.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                            {rejected.map(r => {
                                                const typeInfo = REPORT_TYPE_LABELS[r.report_type] || { label: r.report_type, cls: '' }
                                                const cls = `${r.grade || ''}${r.section || ''}`
                                                return (
                                                    <div key={r.id} style={{ background: 'var(--card)', borderRadius: '12px', border: '1.5px solid #fca5a5', padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem' }}>
                                                        <div className="disc-activity-icon warning" style={{ flexShrink: 0 }}>
                                                            <span className="material-symbols-rounded">cancel</span>
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{r.title}</span>
                                                                <span className={`incident-type-tag ${typeInfo.cls}`}>{typeInfo.label}</span>
                                                                <StatusBadge status="rejected" />
                                                            </div>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                                                                <strong>{r.student}</strong>
                                                                {cls && <> &nbsp;·&nbsp; <span className="class-chip" style={{ fontSize: '0.72rem' }}>{cls}</span></>}
                                                                &nbsp;·&nbsp; {r.date}
                                                            </div>
                                                            {r.review_notes && (
                                                                <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', color: '#b91c1c' }}>Reason: {r.review_notes}</div>
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
                            </>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
