import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { StudentConductModal } from '../../components/modals/StudentConductModal'
import { DataTable } from '../../components/ui/DataTable'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { getDisStudents, getDisReports, updateDisReport } from '../../api/discipline'
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

const reportFilterOptions = [
    { key: 'all',         label: 'All'               },
    { key: 'incident',    label: 'Incidents'          },
    { key: 'warning',     label: 'Warnings'           },
    { key: 'positive',    label: 'Positive'           },
    { key: 'achievement', label: 'Achievements'       },
    { key: 'pending',     label: 'Pending Follow-ups' },
]

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
    const [reports,       setReports]       = useState([])
    const [repLoading,    setRepLoading]    = useState(false)
    const [repLoaded,     setRepLoaded]     = useState(false)
    const [reportFilter,  setReportFilter]  = useState('all')

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

    // ── Filters ──
    const visibleStudents = students.filter(s => {
        const { cls: cCls } = conductInfo(s.conduct_grade)
        if (conductFilter === 'none'  && s.conduct_grade) return false
        if (conductFilter !== 'all' && conductFilter !== 'none' && cCls !== conductFilter) return false
        if (year     && s.grade   !== year)     return false
        if (classVal && s.section !== classVal) return false
        return true
    })

    const pendingCount  = reports.filter(r => r.follow_up_required && !r.follow_up_completed).length
    const visibleReports = reports.filter(r => {
        if (reportFilter === 'pending') return r.follow_up_required && !r.follow_up_completed
        if (reportFilter !== 'all')     return r.report_type === reportFilter
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
                                {pendingCount > 0 && (
                                    <span className="approval-count-badge">{pendingCount}</span>
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
                                <FilterBar options={reportFilterOptions} active={reportFilter} onChange={setReportFilter} />

                                {repLoading ? (
                                    <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading reports…</p>
                                ) : (
                                    <DataTable
                                        title="Behavior Reports"
                                        data={visibleReports}
                                        columns={['Student', 'Class', 'Type', 'Description', 'Date', 'Reported By', 'Follow-up', 'Actions']}
                                        renderRow={(r, i) => <ReportRow key={r.id || i} report={r} onMarkComplete={handleMarkComplete} />}
                                        emptyIcon="report"
                                        emptyTitle="No reports found"
                                        emptyDesc={reportFilter === 'all' ? 'No behavior reports on record.' : `No ${reportFilter} reports found.`}
                                        onClearFilters={reportFilter !== 'all' ? () => setReportFilter('all') : undefined}
                                    />
                                )}
                            </>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
