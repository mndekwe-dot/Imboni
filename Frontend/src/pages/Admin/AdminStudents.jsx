import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { StatCard } from '../../components/layout/StatCard'
import { DataTable } from '../../components/ui/DataTable'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import {
    getAdminStudents, getAdminStudentStats,
    getStudentDetail, getStudentAttendanceStats, getStudentTermResults,
} from '../../api/admin'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import '../../styles/tables.css'
import '../../styles/discipline.css'

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function gradeLabel(grade, section) {
    if (!grade) return '-'
    return `S${grade}${section || ''}`
}

function gradeColor(letter) {
    if (!letter) return 'var(--muted-foreground)'
    const l = letter.toUpperCase()
    if (l === 'A' || l === 'A+') return '#16a34a'
    if (l === 'B')               return '#2563eb'
    if (l === 'C')               return '#ca8a04'
    return '#dc2626'
}

function AttBar({ label, value, color }) {
    const pct = Math.min(100, Math.max(0, value || 0))
    return (
        <div className="att-bar">
            <div className="att-bar-head">
                <span className="u-muted">{label}</span>
                <span className="u-strong">{pct}%</span>
            </div>
            <div className="att-bar-track">
                <div className="att-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    )
}

function StudentDetailModal({ student, onClose }) {
    const [detail,     setDetail]     = useState(null)
    const [attendance, setAttendance] = useState(null)
    const [results,    setResults]    = useState([])
    const [loading,    setLoading]    = useState(true)

    const id   = student.id || student.student_id
    const name = student.name || `${student.first_name || ''} ${student.last_name || ''}`.trim()

    useEffect(() => {
        Promise.all([
            getStudentDetail(id).catch(() => null),
            getStudentAttendanceStats(id).catch(() => null),
            getStudentTermResults(id).catch(() => []),
        ]).then(([d, a, r]) => {
            setDetail(d)
            setAttendance(a)
            setResults(Array.isArray(r) ? r : (r?.results ?? []))
        }).finally(() => setLoading(false))
    }, [id])

    const cls    = gradeLabel(detail?.grade ?? student.grade, detail?.section ?? student.section)
    const sid    = detail?.student_id || detail?.student_code || student.student_id || student.student_code || '-'
    const dorm   = detail?.dormitory || detail?.house || student.dormitory || student.house || '-'
    const status = detail?.status || (student.is_active !== false ? 'active' : 'inactive')
    const gpa    = detail?.current_gpa ?? student.current_gpa

    const presentPct = attendance?.present_percentage ?? attendance?.present_pct ?? null
    const absentPct  = attendance?.absent_percentage  ?? attendance?.absent_pct  ?? null
    const latePct    = attendance?.late_percentage    ?? attendance?.late_pct    ?? null
    const attRate    = attendance?.attendance_rate    ?? presentPct              ?? null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box adm-student-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="u-row">
                        <div className="adm-av adm-student-av">{initials(name)}</div>
                        <div>
                            <h2 className="modal-title u-mb-0">{name}</h2>
                            <p className="adm-student-sub">{sid} · {cls}</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                {loading ? (
                    <div className="modal-body u-center-text u-muted u-pad">
                        Loading profile…
                    </div>
                ) : (
                    <div className="modal-body adm-student-body">

                        {/* Basic info */}
                        <div>
                            <p className="adm-modal-label">Profile</p>
                            <div className="adm-profile-grid">
                                {[
                                    ['Class',     cls],
                                    ['Dormitory', dorm],
                                    ['Status',    status.charAt(0).toUpperCase() + status.slice(1)],
                                    ['GPA',       gpa != null ? gpa : '-'],
                                ].map(([label, val]) => (
                                    <div key={label} className="adm-profile-row">
                                        <span className="adm-profile-key">{label}</span>
                                        <span className="adm-profile-val">{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Attendance */}
                        <div>
                            <p className="adm-modal-label">
                                Attendance
                                {attRate != null && (
                                    <span style={{ marginLeft: '0.5rem', color: attRate >= 80 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                                        {attRate}%
                                    </span>
                                )}
                            </p>
                            {attendance && presentPct != null ? (
                                <>
                                    <AttBar label="Present" value={presentPct} color="#16a34a" />
                                    {latePct   != null && <AttBar label="Late"    value={latePct}   color="#f59e0b" />}
                                    {absentPct != null && <AttBar label="Absent"  value={absentPct} color="#dc2626" />}
                                </>
                            ) : (
                                <p className="adm-empty-note">No attendance data available.</p>
                            )}
                        </div>

                        {/* Term Results */}
                        <div>
                            <p className="adm-modal-label">Term Results</p>
                            {results.length === 0 ? (
                                <p className="adm-empty-note">No results submitted yet.</p>
                            ) : (
                                <div className="adm-result-list">
                                    {results.slice(0, 8).map((r, i) => {
                                        const subject = r.subject_name || r.subject?.name || `Subject ${i + 1}`
                                        const score   = r.total_score ?? r.score ?? r.final_score ?? '-'
                                        const grade   = r.letter_grade || r.grade_letter || '-'
                                        return (
                                            <div key={i} className="adm-result-row">
                                                <span className="adm-result-name">{subject}</span>
                                                <span className="adm-result-score">
                                                    {score !== '-' ? `${score}%` : '-'}
                                                </span>
                                                <span className="adm-result-grade" style={{ color: gradeColor(grade) }}>
                                                    {grade}
                                                </span>
                                            </div>
                                        )
                                    })}
                                    {results.length > 8 && (
                                        <p className="adm-result-more">
                                            +{results.length - 8} more subjects
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </div>
    )
}

function StudentRow({ student, onView }) {
    const name   = student.name || `${student.first_name || ''} ${student.last_name || ''}`.trim()
    const cls    = gradeLabel(student.grade, student.section)
    const active = student.status === 'active' || student.is_active !== false
    const id     = student.student_id || student.student_code || '-'

    return (
        <tr>
            <td>
                <div className="adm-cell">
                    <div className="adm-av">{initials(name)}</div>
                    <div>
                        <div className="adm-name">{name}</div>
                        <div className="adm-sub">{id}</div>
                    </div>
                </div>
            </td>
            <td>{cls}</td>
            <td>{student.dormitory || student.house || '-'}</td>
            <td>
                <span className={`adm-badge ${active ? 'active' : 'pending'}`}>
                    {student.status ? student.status.charAt(0).toUpperCase() + student.status.slice(1) : (active ? 'Active' : 'Inactive')}
                </span>
            </td>
            <td>
                <button className="adm-btn" onClick={() => onView(student)}>
                    <span className="material-symbols-rounded">visibility</span> View
                </button>
            </td>
        </tr>
    )
}

export function AdminStudents() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const { config }    = useSchoolConfig()
    const [studentList, setStudentList] = useState([])
    const [stats,       setStats]       = useState(null)
    const [loading,     setLoading]     = useState(true)
    const [search,      setSearch]      = useState('')
    const [section,     setSection]     = useState('')
    const [year,        setYear]        = useState('')
    const [classVal,    setClassVal]    = useState('')
    const [viewing,     setViewing]     = useState(null)

    useEffect(() => {
        setLoading(true)
        const gradeNum = year ? year.replace('S', '') : undefined
        Promise.all([
            getAdminStudents(gradeNum ? { grade: gradeNum } : {}).catch(() => []),
            getAdminStudentStats().catch(() => null),
        ]).then(([students, s]) => {
            setStudentList(Array.isArray(students) ? students : (students?.results ?? []))
            setStats(s)
        }).finally(() => setLoading(false))
    }, [year])

    const statCards = stats ? [
        { icon: 'groups',       value: stats.total_students  || 0, label: 'Total Students',  trend: 'All enrolled',               colorClass: ''        },
        { icon: 'person_add',   value: stats.new_admissions  || 0, label: 'New Admissions',  trend: 'This term',                  colorClass: 'info'    },
        { icon: 'check_circle', value: stats.active_students || 0, label: 'Active',          trend: `${stats.enrollment_pct || 0}% enrollment`, colorClass: 'success' },
        { icon: 'trending_up',  value: `${stats.avg_performance || 0}%`, label: 'Avg Performance', trend: stats.avg_performance_change >= 0 ? `+${stats.avg_performance_change}%` : `${stats.avg_performance_change}%`, colorClass: 'warning' },
    ] : [
        { icon: 'groups',       value: '-', label: 'Total Students',   trend: 'Loading…', colorClass: ''        },
        { icon: 'person_add',   value: '-', label: 'New Admissions',   trend: 'Loading…', colorClass: 'info'    },
        { icon: 'check_circle', value: '-', label: 'Active',           trend: 'Loading…', colorClass: 'success' },
        { icon: 'trending_up',  value: '-', label: 'Avg Performance',  trend: 'Loading…', colorClass: 'warning' },
    ]

    const filtered = studentList.filter(s => {
        const name = (s.name || `${s.first_name || ''} ${s.last_name || ''}`).toLowerCase()
        const q    = search.toLowerCase()
        const matchSearch = !q || name.includes(q) || (s.student_id || s.student_code || '').toLowerCase().includes(q)
        const matchClass  = !classVal || (s.section || '').toUpperCase() === classVal.toUpperCase()
        return matchSearch && matchClass
    })

    return (
        <>
            {viewing && (
                <StudentDetailModal student={viewing} onClose={() => setViewing(null)} />
            )}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Student Management"
                        subtitle="Enrollment, admissions and student records"
                        {...adminUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <div className="portal-stat-grid">
                            {statCards.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <ClassPicker
                            sections={config}
                            section={section}
                            onSectionChange={s => { setSection(s); setYear(''); setClassVal('') }}
                            year={year}
                            onYearChange={y => { setYear(y); setClassVal('') }}
                            classVal={classVal}
                            onClassChange={setClassVal}
                        />

                        <div className="toolbar-card">
                            <div className="toolbar-search">
                                <span className="material-symbols-rounded">search</span>
                                <input placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)} />
                                {search && <button className="toolbar-search-clear" onClick={() => setSearch('')}><span className="material-symbols-rounded">close</span></button>}
                            </div>
                        </div>

                        {loading ? (
                            <p className="u-muted u-pad">Loading students…</p>
                        ) : (
                            <DataTable
                                title="All Students"
                                data={filtered}
                                columns={['Student', 'Class', 'House / Dorm', 'Status', 'Actions']}
                                renderRow={s => (
                                    <StudentRow key={s.id || s.student_id} student={s} onView={setViewing} />
                                )}
                                emptyIcon="groups"
                                emptyTitle="No students found"
                                emptyDesc={search ? `No results for "${search}"` : 'No students match the selected filters.'}
                                onClearFilters={() => { setSearch(''); setSection(''); setYear(''); setClassVal('') }}
                            />
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
