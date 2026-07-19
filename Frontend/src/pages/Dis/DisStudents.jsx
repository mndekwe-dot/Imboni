import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { StudentConductModal } from '../../components/modals/StudentConductModal'
import { DataTable } from '../../components/ui/DataTable'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { disNavItems, disSecondaryItems } from './disNav'
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
    if (!report.follow_up_required) return { label: '-',         cls: '' }
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
    pending_review: { label: 'Pending Review', cls: 'pending'  },
    approved:       { label: 'Approved',       cls: 'approved' },
    rejected:       { label: 'Rejected',       cls: 'rejected' },
}

function StatusBadge({ status }) {
    const meta = STATUS_META[status] || { label: status, cls: '' }
    return <span className={`dis-status-badge ${meta.cls}`}>{meta.label}</span>
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
        <div className="dis-pending-card">
            <div className="dis-pending-hd">
                <div className={`disc-activity-icon ${typeInfo.cls}`}>
                    <span className="material-symbols-rounded">
                        {report.report_type === 'incident' ? 'warning' : report.report_type === 'warning' ? 'error' : 'thumb_up'}
                    </span>
                </div>
                <div className="u-flex-min">
                    <div className="u-row-sm u-wrap">
                        <span className="dis-pending-title">{report.title}</span>
                        <span className={`incident-type-tag ${typeInfo.cls}`}>{typeInfo.label}</span>
                        {report.severity && (
                            <span className="dis-sev-tag">
                                {report.severity}
                            </span>
                        )}
                    </div>
                    <div className="dis-meta">
                        <strong>{report.student}</strong>
                        {cls && <> &nbsp;·&nbsp; <span className="class-chip dis-chip-sm">{cls}</span></>}
                        &nbsp;·&nbsp; {report.date}
                    </div>
                    {report.description && (
                        <div className="dis-desc">{report.description}</div>
                    )}
                    <div className="dis-foot-meta">
                        <span>Filed by <strong>{report.reported_by || 'Unknown'}</strong></span>
                        {report.location && <span>· {report.location}</span>}
                        {report.marks_deducted != null && (
                            <span className="dis-marks-tag">
                                −{report.marks_deducted} marks
                            </span>
                        )}
                    </div>
                </div>
                <button className="btn btn-sm btn-outline u-shrink-0" onClick={() => setOpen(o => !o)}>
                    <span className="material-symbols-rounded icon-sm">{open ? 'expand_less' : 'rate_review'}</span>
                    Review
                </button>
            </div>
            {open && (
                <div className="dis-review-panel">
                    <div className="form-group u-m-0">
                        <label className="form-label">Notes (optional)</label>
                        <textarea className="form-input form-textarea" rows="2" placeholder="Add a note…" value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                    <div className="u-row-sm u-justify-end">
                        <button className="btn btn-sm dis-btn-reject" onClick={() => handle('reject')} disabled={saving}>
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
                    : <span className="dis-dash">-</span>
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
                <div className="dis-rep-title">{report.title}</div>
                {report.description && (
                    <div className="dis-rep-desc">
                        {report.description}
                    </div>
                )}
            </td>
            <td className="text-muted u-nowrap">{report.date}</td>
            <td className="text-muted">{report.reported_by || '-'}</td>
            <td>
                {fuStatus.label === '-'
                    ? <span className="u-muted">-</span>
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
    const sessionUser = useSessionUser()
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
                        {...sessionUser}
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
                                    <p className="u-pad u-muted">Loading students…</p>
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
                                            <span className="dis-rej-count">
                                                {rejected.length}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {repLoading ? (
                                    <p className="u-pad u-muted">Loading reports…</p>
                                ) : reportSubTab === 'pending' ? (
                                    pending.length === 0 ? (
                                        <p className="dis-empty-center">No pending reports. All matron reports have been reviewed.</p>
                                    ) : (
                                        <div className="u-stack-sm">
                                            <p className="dis-hint">
                                                {pending.length} report{pending.length !== 1 ? 's' : ''} awaiting review.
                                            </p>
                                            {pending.map(r => <PendingCard key={r.id} report={r} onReview={handleReview} />)}
                                        </div>
                                    )
                                ) : reportSubTab === 'approved' ? (
                                    <DataTable
                                        title={`Approved Reports${pendingFollowUp > 0 ? ` (${pendingFollowUp} follow-up pending)` : ''}`}
                                        data={visibleApproved}
                                        columns={['Student', 'Class', 'Type', 'Description', 'Date', 'Reported By', 'Follow-up', 'Actions']}
                                        renderRow={(r, i) => <ReportRow key={r.id || i} report={r} onMarkComplete={handleMarkComplete} />}
                                        emptyIcon="report"
                                        emptyTitle="No approved reports"
                                        emptyDesc="No approved behavior reports on record."
                                        filterBar={
                                            <div className="filter-tabs-bar mt-0 u-mb-sm">
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
                                        <p className="dis-empty-center">No rejected reports.</p>
                                    ) : (
                                        <div className="dis-stack-mid">
                                            {rejected.map(r => {
                                                const typeInfo = REPORT_TYPE_LABELS[r.report_type] || { label: r.report_type, cls: '' }
                                                const cls = `${r.grade || ''}${r.section || ''}`
                                                return (
                                                    <div key={r.id} className="dis-rejected-card">
                                                        <div className="disc-activity-icon warning">
                                                            <span className="material-symbols-rounded">cancel</span>
                                                        </div>
                                                        <div className="u-flex-1">
                                                            <div className="u-row-sm u-wrap">
                                                                <span className="dis-rej-title">{r.title}</span>
                                                                <span className={`incident-type-tag ${typeInfo.cls}`}>{typeInfo.label}</span>
                                                                <StatusBadge status="rejected" />
                                                            </div>
                                                            <div className="dis-meta">
                                                                <strong>{r.student}</strong>
                                                                {cls && <> &nbsp;·&nbsp; <span className="class-chip dis-chip-sm">{cls}</span></>}
                                                                &nbsp;·&nbsp; {r.date}
                                                            </div>
                                                            {r.review_notes && (
                                                                <div className="dis-reason">Reason: {r.review_notes}</div>
                                                            )}
                                                            <div className="dis-filed">
                                                                Filed by <strong>{r.reported_by || '-'}</strong>
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
