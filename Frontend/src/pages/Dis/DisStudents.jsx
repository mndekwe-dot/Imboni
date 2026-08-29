import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { StudentConductModal } from '../../components/modals/StudentConductModal'
import { DataTable } from '../../components/ui/DataTable'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { disNavItems, disSecondaryItems } from './disNav'
import { getDisStudents, getDisReports, updateDisReport, reviewDisReport } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { StatCard } from '../../components/layout/StatCard'
import { TabGroup } from '../../components/ui/TabGroup'

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
    const { t } = useTranslation()
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
                    <span className="material-symbols-rounded" aria-hidden="true">
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
                        <span>{t('dis.students.filedBy')} <strong>{report.reported_by || 'Unknown'}</strong></span>
                        {report.location && <span>· {report.location}</span>}
                        {report.marks_deducted != null && (
                            <span className="dis-marks-tag">
                                −{report.marks_deducted} marks
                            </span>
                        )}
                    </div>
                </div>
                <button className="btn btn-sm btn-outline u-shrink-0" onClick={() => setOpen(o => !o)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">{open ? 'expand_less' : 'rate_review'}</span>
                    {t('dos.results.review')}
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
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">cancel</span> {t('common.reject')}
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => handle('approve')} disabled={saving}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">check_circle</span>
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
                <span className={`dis-incident-count ${student.incident_count > 0 ? 'has-incidents' : ''} ${student.incident_count > 3 ? 'is-high' : ''}`}>
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
    const { t } = useTranslation()
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
                        {t('dis.students.markDone')}
                    </button>
                )}
            </td>
        </tr>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DisStudents() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()

    /* The tab is in the URL so the dashboard can link straight at the reports
       ("View All" used to point at /discipline/reports, a route that does not
       exist — it 404'd), and so a director can bookmark or reload the tab they
       were on instead of landing back on conduct records. */
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = searchParams.get('tab') === 'reports' ? 'reports' : 'students'
    const setActiveTab = tab => setSearchParams(
        tab === 'reports' ? { tab: 'reports' } : {},
        { replace: true },
    )

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
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.students')}
                        subtitle={t('dis.students.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        {/* Tabs switch a panel; chips narrow a list. This bar
                            was built from `.filter-tab` chips, so on this page
                            the two jobs looked identical — and neither looked
                            like the raised tab chips elsewhere in the app. */}
                        <TabGroup
                            tabs={[
                                { key: 'students', label: t('dis.students.conductRecords'),   icon: 'people' },
                                { key: 'reports',  label: t('dis.students.behaviorReports'),  icon: 'report', count: pending.length },
                            ]}
                            value={activeTab}
                            onChange={setActiveTab}
                            label={t('nav.students')}
                            idPrefix="dis-students-"
                        />

                        {/* ── STUDENTS TAB ── */}
                        {activeTab === 'students' && (
                            <>
                                <ClassPicker
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

                                <div className="portal-stat-grid">
                                    {[
                                        { iconClass: 'info',    icon: 'groups',  value: visibleStudents.length,                                                        label: 'Students Shown'     },
                                        { iconClass: 'success', icon: 'star',    value: visibleStudents.filter(s => conductInfo(s.conduct_grade).cls === 'excellent').length, label: 'Excellent Standing' },
                                        { iconClass: 'warning', icon: 'warning', value: visibleStudents.filter(s => conductInfo(s.conduct_grade).cls === 'fair').length,      label: 'Fair / At Risk'     },
                                        { iconClass: 'red',     icon: 'cancel',  value: visibleStudents.filter(s => conductInfo(s.conduct_grade).cls === 'poor').length,      label: 'Poor Conduct'       },
                                    ].map((s, i) => (
                                        <StatCard key={i} icon={s.icon} value={s.value} label={s.label} colorClass={s.iconClass} />
                                    ))}
                                </div>

                                {studLoading ? (
                                    <p className="u-pad u-muted">Loading students…</p>
                                ) : (
                                    <DataTable
                                        title={t('dis.students.studentConductRecords')}
                                        data={visibleStudents}
                                        columns={[t('common.student'), t('common.class'), t('dis.students.studentIdColumn'), t('dis.students.conductColumn'), t('dis.students.incidentsColumn'), t('common.actions')]}
                                        renderRow={(s, i) => <StudentRow key={s.id || i} student={s} onView={setModal} />}
                                        emptyIcon="people"
                                        emptyTitle={t('dis.students.noStudents')}
                                        emptyDesc={t('dis.students.noStudentsFiltered')}
                                        onClearFilters={() => { setConductFilter('all'); setSection(''); setYear(''); setClassVal('') }}
                                    />
                                )}
                            </>
                        )}

                        {/* ── REPORTS TAB ── */}
                        {activeTab === 'reports' && (
                            <>
                                {/* Sub-tabs */}
                                <TabGroup
                                    tabs={[
                                        { key: 'pending',  label: t('dis.students.pendingReview'), icon: 'pending_actions', count: pending.length },
                                        { key: 'approved', label: t('common.approved'),            icon: 'check_circle'    },
                                        { key: 'rejected', label: t('common.rejected'),            icon: 'cancel', count: rejected.length },
                                    ]}
                                    value={reportSubTab}
                                    onChange={setReportSubTab}
                                    label={t('dis.students.behaviorReports')}
                                    idPrefix="dis-reports-"
                                />

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
                                        emptyTitle={t('dis.students.noApproved')}
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
                                                            <span className="material-symbols-rounded" aria-hidden="true">cancel</span>
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
                                                                {t('dis.students.filedBy')} <strong>{r.reported_by || '-'}</strong>
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
