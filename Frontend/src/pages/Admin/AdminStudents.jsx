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
    if (!grade) return '—'
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
        <div style={{ marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{pct}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 999 }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
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
    const sid    = detail?.student_id || detail?.student_code || student.student_id || student.student_code || '—'
    const dorm   = detail?.dormitory || detail?.house || student.dormitory || student.house || '—'
    const status = detail?.status || (student.is_active !== false ? 'active' : 'inactive')
    const gpa    = detail?.current_gpa ?? student.current_gpa

    const presentPct = attendance?.present_percentage ?? attendance?.present_pct ?? null
    const absentPct  = attendance?.absent_percentage  ?? attendance?.absent_pct  ?? null
    const latePct    = attendance?.late_percentage    ?? attendance?.late_pct    ?? null
    const attRate    = attendance?.attendance_rate    ?? presentPct              ?? null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 600, width: '95vw' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="adm-av" style={{ width: 40, height: 40, fontSize: '1rem', flexShrink: 0 }}>{initials(name)}</div>
                        <div>
                            <h2 className="modal-title" style={{ marginBottom: 0 }}>{name}</h2>
                            <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', margin: 0 }}>{sid} · {cls}</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                {loading ? (
                    <div className="modal-body" style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>
                        Loading profile…
                    </div>
                ) : (
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Basic info */}
                        <div>
                            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)', marginBottom: '0.6rem' }}>Profile</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1.5rem' }}>
                                {[
                                    ['Class',     cls],
                                    ['Dormitory', dorm],
                                    ['Status',    status.charAt(0).toUpperCase() + status.slice(1)],
                                    ['GPA',       gpa != null ? gpa : '—'],
                                ].map(([label, val]) => (
                                    <div key={label} style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline' }}>
                                        <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', width: 80, flexShrink: 0 }}>{label}</span>
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Attendance */}
                        <div>
                            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)', marginBottom: '0.6rem' }}>
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
                                <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>No attendance data available.</p>
                            )}
                        </div>

                        {/* Term Results */}
                        <div>
                            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)', marginBottom: '0.6rem' }}>Term Results</p>
                            {results.length === 0 ? (
                                <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>No results submitted yet.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                    {results.slice(0, 8).map((r, i) => {
                                        const subject = r.subject_name || r.subject?.name || `Subject ${i + 1}`
                                        const score   = r.total_score ?? r.score ?? r.final_score ?? '—'
                                        const grade   = r.letter_grade || r.grade_letter || '—'
                                        return (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                                                <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 500 }}>{subject}</span>
                                                <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', minWidth: 44, textAlign: 'right' }}>
                                                    {score !== '—' ? `${score}%` : '—'}
                                                </span>
                                                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: gradeColor(grade), minWidth: 26, textAlign: 'right' }}>
                                                    {grade}
                                                </span>
                                            </div>
                                        )
                                    })}
                                    {results.length > 8 && (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.4rem' }}>
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
    const id     = student.student_id || student.student_code || '—'

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
            <td>{student.dormitory || student.house || '—'}</td>
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
        { icon: 'groups',       value: '—', label: 'Total Students',   trend: 'Loading…', colorClass: ''        },
        { icon: 'person_add',   value: '—', label: 'New Admissions',   trend: 'Loading…', colorClass: 'info'    },
        { icon: 'check_circle', value: '—', label: 'Active',           trend: 'Loading…', colorClass: 'success' },
        { icon: 'trending_up',  value: '—', label: 'Avg Performance',  trend: 'Loading…', colorClass: 'warning' },
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
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading students…</p>
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
