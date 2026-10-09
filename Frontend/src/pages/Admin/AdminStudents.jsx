import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { StatCard } from '../../components/layout/StatCard'
import { DataTable } from '../../components/ui/DataTable'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { classLabel } from '../../utils/classes'
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
import { SearchBar } from '../../components/ui/SearchBar'
import { useToast } from '../../context/ToastContext'
import { partialLoad } from '../../utils/errors'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { ModalOverlay } from '../../components/ui/ModalOverlay'

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

/* The students API sends `full_name` and `student_code` (STU-001). `student_id`
 * is the database UUID: an identifier for requests, never something to show.
 * Reading `name` / `first_name` here left every row nameless and fell back to
 * printing the UUID. */
function studentName(s) {
    if (!s) return ''
    return s.full_name || s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim()
}

function studentCode(s) {
    return s?.student_code || ''
}

function gradeLabel(grade, section) {
    if (!grade) return '-'
    return classLabel(grade, section)
}

function gradeColor(letter) {
    if (!letter) return 'var(--muted-foreground)'
    const l = letter.toUpperCase()
    if (l === 'A' || l === 'A+') return 'var(--success)'
    if (l === 'B')               return 'var(--info)'
    if (l === 'C')               return 'var(--warning)'
    return 'var(--destructive)'
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

const statusLabel = (t, status) => t(`admin.students.statuses.${status}`, { defaultValue: status.charAt(0).toUpperCase() + status.slice(1) })

function StudentDetailModal({ student, onClose }) {
    const toast = useToast()
    const { t } = useTranslation()
    const [detail,     setDetail]     = useState(null)
    const [attendance, setAttendance] = useState(null)
    const [results,    setResults]    = useState([])
    const [loading,    setLoading]    = useState(true)

    const id   = student.id || student.student_id

    useEffect(() => {
        Promise.all([
            getStudentDetail(id).catch(partialLoad(toast, null)),
            getStudentAttendanceStats(id).catch(partialLoad(toast, null)),
            getStudentTermResults(id).catch(partialLoad(toast, [])),
        ]).then(([d, a, r]) => {
            setDetail(d)
            setAttendance(a)
            setResults(Array.isArray(r) ? r : (r?.results ?? []))
        }).finally(() => setLoading(false))
    }, [id, toast])

    const name   = studentName(detail) || studentName(student)
    const cls    = gradeLabel(detail?.grade ?? student.grade, detail?.section ?? student.section)
    const sid    = studentCode(detail) || studentCode(student) || '-'
    const dorm   = detail?.dormitory || detail?.house || student.dormitory || student.house || '-'
    const status = detail?.status || (student.is_active !== false ? 'active' : 'inactive')
    const gpa    = detail?.current_gpa ?? student.current_gpa

    const presentPct = attendance?.present_percentage ?? attendance?.present_pct ?? null
    const absentPct  = attendance?.absent_percentage  ?? attendance?.absent_pct  ?? null
    const latePct    = attendance?.late_percentage    ?? attendance?.late_pct    ?? null
    const attRate    = attendance?.attendance_rate    ?? presentPct              ?? null

    return (
        <ModalOverlay onClose={onClose}>
            <div className="modal-box adm-student-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="u-row">
                        <div className="adm-av adm-student-av">{initials(name)}</div>
                        <div>
                            <h2 className="modal-title u-mb-0">{name}</h2>
                            <p className="adm-student-sub">{sid} · {cls}</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
                        <span className="material-symbols-rounded" aria-hidden="true">close</span>
                    </button>
                </div>

                {loading ? (
                    <div className="modal-body u-center-text u-muted u-pad">
                        {t('admin.students.loadingProfile')}
                    </div>
                ) : (
                    <div className="modal-body adm-student-body">

                        {/* Basic info */}
                        <div>
                            <p className="adm-modal-label">{t('admin.students.profile')}</p>
                            <div className="adm-profile-grid">
                                {[
                                    [t('common.class'),     cls],
                                    [t('common.dormitory'), dorm],
                                    [t('common.status'),    statusLabel(t, status)],
                                    [t('admin.students.gpa'), gpa != null ? gpa : '-'],
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
                                {t('admin.students.attendance')}
                                {attRate != null && (
                                    <span style={{ marginLeft: '0.5rem', color: attRate >= 80 ? 'var(--success)' : 'var(--destructive)', fontWeight: 700 }}>
                                        {attRate}%
                                    </span>
                                )}
                            </p>
                            {attendance && presentPct != null ? (
                                <>
                                    <AttBar label={t('common.present')} value={presentPct} color="var(--success)" />
                                    {latePct   != null && <AttBar label={t('common.late')}    value={latePct}   color="var(--warning)" />}
                                    {absentPct != null && <AttBar label={t('common.absent')}  value={absentPct} color="var(--destructive)" />}
                                </>
                            ) : (
                                <p className="empty-note">{t('admin.students.noAttendance')}</p>
                            )}
                        </div>

                        {/* Term Results */}
                        <div>
                            <p className="adm-modal-label">{t('admin.students.termResults')}</p>
                            {results.length === 0 ? (
                                <p className="empty-note">{t('admin.students.noResults')}</p>
                            ) : (
                                <div className="adm-result-list">
                                    {results.slice(0, 8).map((r, i) => {
                                        const subject = r.subject_name || r.subject?.name || t('admin.students.subjectN', { n: i + 1 })
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
                                            {t('admin.students.moreSubjects', { count: results.length - 8 })}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </ModalOverlay>
    )
}

function StudentRow({ student, onView }) {
    const { t } = useTranslation()
    const name   = studentName(student)
    const cls    = gradeLabel(student.grade, student.section)
    const active = student.status === 'active' || student.is_active !== false
    const id     = studentCode(student) || '-'

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
                    {statusLabel(t, student.status || (active ? 'active' : 'inactive'))}
                </span>
            </td>
            <td>
                <button className="adm-btn" onClick={() => onView(student)}>
                    <span className="material-symbols-rounded" aria-hidden="true">visibility</span> {t('common.view')}
                </button>
            </td>
        </tr>
    )
}

// Rows per page. The server sends only this many, so the page costs the same
// whether the school has 50 students or 1,500.
const PAGE_SIZE = 8

export function AdminStudents() {
    const toast = useToast()
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [studentList, setStudentList] = useState([])
    const [total,       setTotal]       = useState(0)
    const [page,        setPage]        = useState(1)
    const [stats,       setStats]       = useState(null)
    const [statsLoading, setStatsLoading] = useState(true)
    const [loading,     setLoading]     = useState(true)
    const [search,      setSearch]      = useState('')
    const [section,     setSection]     = useState('')
    const [year,        setYear]        = useState('')
    const [classVal,    setClassVal]    = useState('')
    const [viewing,     setViewing]     = useState(null)

    // The box updates as you type; the server is only asked once typing pauses.
    const query = useDebouncedValue(search.trim(), 300)

    // The headline numbers do not depend on the filters, so they load once.
    useEffect(() => {
        getAdminStudentStats().catch(partialLoad(toast, null))
            .then(setStats)
            .finally(() => setStatsLoading(false))
    }, [toast])

    // One page of students, filtered and searched by the server.
    useEffect(() => {
        let alive = true
        setLoading(true)
        getAdminStudents({
            page, page_size: PAGE_SIZE,
            grade: year || undefined,
            section: classVal || undefined,
            search: query || undefined,
        }).catch(partialLoad(toast, []))
            .then(res => {
                if (!alive) return          // a newer request has superseded this one
                const rows = Array.isArray(res) ? res : (res?.results ?? [])
                setStudentList(rows)
                setTotal(Array.isArray(res) ? res.length : (res?.count ?? rows.length))
            })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [page, year, classVal, query, toast])

    // Any change to what is being asked for starts again from page 1.
    useEffect(() => { setPage(1) }, [year, classVal, query])

    // Always four tiles: bars while the figures load, dashes if they never arrive
    // (the toast says why), never a strip that appears and disappears.
    const statCards = stats ? [
        { icon: 'groups',       value: stats?.total_students  || 0, label: t('common.totalStudents'),  trend: t('admin.students.allEnrolled'),               colorClass: ''        },
        { icon: 'person_add',   value: stats?.new_admissions  || 0, label: t('admin.students.newAdmissions'),  trend: t('admin.students.thisTerm'),                  colorClass: 'info'    },
        { icon: 'check_circle', value: stats?.active_students || 0, label: t('common.active'),          trend: t('admin.students.enrollmentPct', { pct: stats?.enrollment_pct || 0 }), colorClass: 'success' },
        { icon: 'trending_up',  value: `${stats?.avg_performance || 0}%`, label: t('admin.students.avgPerformance'), trend: stats?.avg_performance_change >= 0 ? `+${stats?.avg_performance_change}%` : `${stats?.avg_performance_change}%`, colorClass: 'warning' },
    ] : [
        { icon: 'groups',       value: '-', label: t('common.totalStudents'),          colorClass: ''        },
        { icon: 'person_add',   value: '-', label: t('admin.students.newAdmissions'),  colorClass: 'info'    },
        { icon: 'check_circle', value: '-', label: t('common.active'),                 colorClass: 'success' },
        { icon: 'trending_up',  value: '-', label: t('admin.students.avgPerformance'), colorClass: 'warning' },
    ]

    return (
        <>
            {viewing && (
                <StudentDetailModal student={viewing} onClose={() => setViewing(null)} />
            )}

            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('admin.students.title')}
                        subtitle={t('admin.students.subtitle')}
                        {...adminUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <div className="portal-stat-grid">
                            {statCards.map((s, i) => <StatCard key={i} {...s} loading={statsLoading} />)}
                        </div>

                        <ClassPicker
                            section={section}
                            onSectionChange={s => { setSection(s); setYear(''); setClassVal('') }}
                            year={year}
                            onYearChange={y => { setYear(y); setClassVal('') }}
                            classVal={classVal}
                            onClassChange={setClassVal}
                        />

                        <div className="toolbar-card">
                            <SearchBar
                                value={search}
                                onChange={setSearch}
                                placeholder={t('common.searchStudents')}
                            />
                        </div>

                        <DataTable
                            title={t('admin.students.allStudents')}
                            data={studentList}
                            total={total}
                            page={page}
                            onPageChange={setPage}
                            pageSize={PAGE_SIZE}
                            loading={loading}
                            loadingLabel={t('admin.students.loadingStudents')}
                            skeletonAvatar
                            columns={[t('common.student'), t('common.class'), t('admin.students.houseDorm'), t('common.status'), t('common.actions')]}
                            renderRow={s => (
                                <StudentRow key={s.id || s.student_id} student={s} onView={setViewing} />
                            )}
                            emptyIcon="groups"
                            emptyTitle={t('admin.students.emptyTitle')}
                            emptyDesc={search ? t('admin.students.noResultsFor', { query: search }) : t('admin.students.noMatch')}
                            onClearFilters={() => { setSearch(''); setSection(''); setYear(''); setClassVal('') }}
                        />

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
