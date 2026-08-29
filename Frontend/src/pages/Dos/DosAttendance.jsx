import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { Sidebar } from '../../components/layout/Sidebar'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { formatSchoolDate } from '../../utils/date'
import {
    getDosClasses,
    getDosWeeklyAttendance,
    getDosTeacherWeeklyAttendance,
    markDosTeacherAttendance,
    getDosAttendanceStats,
} from '../../api/dos'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { sectionsFromClasses } from '../../utils/classes'
import { formatDate } from '../../utils/date'
import { PaginationBar } from '../../components/ui/PaginationBar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import '../../styles/discipline.css'

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_KEYS   = ['mon', 'tue', 'wed', 'thu', 'fri']
const STATUS_MAP = { present: 'P', absent: 'A', late: 'L', excused: 'E' }
const STATUS_OPTS = ['present', 'absent', 'late', 'excused']

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Local calendar date as YYYY-MM-DD. Deliberately avoids Date#toISOString()
// (UTC-based) — for any timezone ahead of UTC (e.g. Africa/Kigali, UTC+2),
// toISOString() on a local midnight rolls the date back by one day.
function toLocalISODate(d) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function todayISO() {
    return toLocalISODate(new Date())
}

function fmtWeek(start, end) {
    if (!start || !end) return ''
    const f = d => formatDate(d + 'T00:00:00')
    return `Week: ${f(start)} - ${f(end)}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AttendancePip({ status }) {
    if (!status) return <span className="att-pip unmarked">-</span>
    return <span className={`att-pip ${status}`}>{STATUS_MAP[status] ?? status[0].toUpperCase()}</span>
}

// PaginationBar moved to components/ui/PaginationBar.jsx so DosResults can
// share it rather than growing a second copy that drifts from this one.

// ─── Student Attendance Tab ───────────────────────────────────────────────────

function StudentAttendanceTab({ sections }) {
    const { t } = useTranslation()
    const [section,  setSection]  = useState('')
    const [year,     setYear]     = useState('')
    const [classVal, setClassVal] = useState('')
    const [weekOf,   setWeekOf]   = useState(todayISO)
    const [page,     setPage]     = useState(1)

    const grade  = year || ''
    const stream = classVal

    const [weekData, setWeekData] = useState(null)
    const [loading,  setLoading]  = useState(false)
    const [error,    setError]    = useState(null)

    useEffect(() => { setPage(1) }, [grade, stream, weekOf])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        getDosWeeklyAttendance({ grade, section: stream, week_of: weekOf, page, page_size: 25 })
            .then(res => { if (!cancelled) setWeekData(res) })
            .catch(() => { if (!cancelled) setError('Failed to load attendance data.') })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [grade, stream, weekOf, page])

    const students     = weekData?.students      ?? []
    const classTeacher = weekData?.class_teacher ?? null
    const showClassCol = !grade || !stream
    const totalPages   = weekData?.total_pages   ?? 1
    const totalCount   = weekData?.count         ?? 0

    return (
        <>
            <ClassPicker
                sections={sections}
                section={section}
                onSectionChange={val => { setSection(val); setYear(''); setClassVal('') }}
                year={year}
                onYearChange={val => { setYear(val); setClassVal('') }}
                classVal={classVal}
                onClassChange={setClassVal}
            />

            <div className="toolbar-card att-toolbar">
                <label className="att-week-label">
                    {t('dos.attendance.weekOf')}
                </label>
                <input
                    type="date"
                    className="input input-auto select-xs"
                    value={weekOf}
                    max={todayISO()}
                    onChange={e => setWeekOf(e.target.value)}
                />
            </div>

            <div className="card mt-1-5">
                <div className="card-header">
                    <div>
                        <h2 className="card-title">
                            {weekData?.class_name || 'All Classes'}: Weekly Attendance
                        </h2>
                        <p className="dos-class-meta">
                            {fmtWeek(weekData?.week_start, weekData?.week_end)}
                            {classTeacher ? ` • Class Teacher: ${classTeacher}` : ''}
                        </p>
                    </div>
                    <div className="att-legend">
                        <span className="att-pip present">P</span> {t('common.present')}&nbsp;
                        <span className="att-pip absent">A</span> {t('common.absent')}&nbsp;
                        <span className="att-pip late">L</span> {t('common.late')}&nbsp;
                        <span className="att-pip excused">E</span> {t('common.excused')}
                    </div>
                </div>

                <div className="card-content">
                    {error   && <p className="att-state-error">{error}</p>}
                    {!error && loading && <p className="att-state">Loading…</p>}
                    {!error && !loading && students.length === 0 && (
                        <p className="att-state">
                            No students enrolled for the selected class and term.
                        </p>
                    )}
                    {!error && !loading && students.length > 0 && (
                        <>
                            <div className="data-table-wrap framed">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>{t('common.student')}</th>
                                            {showClassCol && <th>{t('common.class')}</th>}
                                            <th>{t('common.mon')}</th><th>{t('common.tue')}</th><th>{t('common.wed')}</th><th>{t('common.thu')}</th><th>{t('common.fri')}</th>
                                            <th>Present</th><th>{t('common.rate')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map(student => (
                                            <tr key={student.student_id}>
                                                <td>
                                                    <div className="tm-teacher-cell">
                                                        <div className="tm-av">{student.initials}</div>
                                                        <span>{student.full_name}</span>
                                                    </div>
                                                </td>
                                                {showClassCol && (
                                                    <td className="att-class-cell">
                                                        {student.class_name}
                                                    </td>
                                                )}
                                                {DAY_KEYS.map(day => (
                                                    <td key={day}><AttendancePip status={student.days[day]} /></td>
                                                ))}
                                                <td>{student.present_count}</td>
                                                <td>{student.rate}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationBar page={page} totalPages={totalPages} totalCount={totalCount} label="students" onPage={setPage} />
                        </>
                    )}
                </div>
            </div>
        </>
    )
}

// ─── Teacher Attendance Tab ───────────────────────────────────────────────────

function TeacherAttendanceTab() {
    const { t } = useTranslation()
    const [weekOf,  setWeekOf]  = useState(todayISO)
    const [page,    setPage]    = useState(1)
    const [weekData, setWeekData] = useState(null)
    const [loading,  setLoading]  = useState(false)
    const [error,    setError]    = useState(null)

    // Editable status map: { teacher_id: { mon: 'present', ... } }
    const [edits,   setEdits]   = useState({})
    const [saving,  setSaving]  = useState(false)
    const [saved,   setSaved]   = useState(false)

    useEffect(() => { setPage(1) }, [weekOf])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        setSaved(false)
        getDosTeacherWeeklyAttendance({ week_of: weekOf, page, page_size: 25 })
            .then(res => {
                if (cancelled) return
                setWeekData(res)
                // Seed edits from returned data
                const map = {}
                for (const t of (res.teachers ?? [])) {
                    map[t.teacher_id] = { ...t.days }
                }
                setEdits(map)
            })
            .catch(() => { if (!cancelled) setError('Failed to load teacher attendance.') })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [weekOf, page])

    const teachers   = weekData?.teachers    ?? []
    const totalPages = weekData?.total_pages ?? 1
    const totalCount = weekData?.count       ?? 0

    const dayDates = (() => {
        if (!weekData?.week_start) return {}
        const start = new Date(weekData.week_start + 'T00:00:00')
        const out = {}
        DAY_KEYS.forEach((k, i) => {
            const d = new Date(start); d.setDate(start.getDate() + i)
            out[k] = toLocalISODate(d)
        })
        return out
    })()

    function setStatus(teacherId, day, status) {
        setEdits(prev => ({
            ...prev,
            [teacherId]: { ...prev[teacherId], [day]: status },
        }))
    }

    async function handleSave() {
        if (saving || !weekData?.week_start) return
        setSaving(true)
        setError(null)
        setSaved(false)
        try {
            // Save one POST per day that has records
            const byDay = {}
            for (const [tid, days] of Object.entries(edits)) {
                for (const [day, status] of Object.entries(days)) {
                    if (!status) continue
                    if (!byDay[day]) byDay[day] = []
                    byDay[day].push({ teacher_id: tid, status })
                }
            }
            await Promise.all(
                Object.entries(byDay).map(([day, records]) =>
                    markDosTeacherAttendance({ date: dayDates[day], records })
                )
            )
            setSaved(true)
        } catch {
            setError('Failed to save attendance.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <div className="toolbar-card att-toolbar">
                <label className="att-week-label">
                    {t('dos.attendance.weekOf')}
                </label>
                <input
                    type="date"
                    className="input input-auto select-xs"
                    value={weekOf}
                    max={todayISO()}
                    onChange={e => setWeekOf(e.target.value)}
                />
                <div className="u-flex-1" />
                <button className="btn btn-primary select-xs" onClick={handleSave} disabled={saving || loading || teachers.length === 0}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">save</span>
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>

            {saved  && <div className="alert alert-success u-mt-sm">Attendance saved.</div>}
            {error  && <div className="alert alert-danger u-mt-sm">{error}</div>}

            <div className="card mt-1-5">
                <div className="card-header">
                    <div>
                        <h2 className="card-title">Teacher Attendance (Weekly)</h2>
                        <p className="dos-class-meta">{fmtWeek(weekData?.week_start, weekData?.week_end)}</p>
                    </div>
                    <div className="att-legend">
                        <span className="att-pip present">P</span> {t('common.present')}&nbsp;
                        <span className="att-pip absent">A</span> {t('common.absent')}&nbsp;
                        <span className="att-pip late">L</span> {t('common.late')}&nbsp;
                        <span className="att-pip excused">E</span> {t('common.excused')}
                    </div>
                </div>

                <div className="card-content">
                    {!error && loading && <p className="att-state">Loading…</p>}
                    {!error && !loading && teachers.length === 0 && (
                        <p className="att-state">{t('dos.attendance.noTeachers')}</p>
                    )}
                    {!error && !loading && teachers.length > 0 && (
                        <>
                            <div className="data-table-wrap framed">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>{t('common.teacher')}</th>
                                            <th>{t('common.mon')}</th><th>{t('common.tue')}</th><th>{t('common.wed')}</th><th>{t('common.thu')}</th><th>{t('common.fri')}</th>
                                            <th>Present</th><th>{t('common.rate')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teachers.map(t => {
                                            const tEdits = edits[t.teacher_id] ?? t.days
                                            const presentCnt = DAY_KEYS.filter(d => tEdits[d] === 'present').length
                                            const rate = Math.round(presentCnt / 5 * 100)
                                            return (
                                                <tr key={t.teacher_id}>
                                                    <td>
                                                        <div className="tm-teacher-cell">
                                                            <div className="tm-av">{t.initials}</div>
                                                            <span>{t.full_name}</span>
                                                        </div>
                                                    </td>
                                                    {DAY_KEYS.map(day => (
                                                        <td key={day}>
                                                            <select
                                                                className={`att-status-select att-${tEdits[day] ?? 'unmarked'}`}
                                                                value={tEdits[day] ?? ''}
                                                                onChange={e => setStatus(t.teacher_id, day, e.target.value || null)}
                                                            >
                                                                <option value="">-</option>
                                                                {STATUS_OPTS.map(s => (
                                                                    <option key={s} value={s}>{STATUS_MAP[s]}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                    ))}
                                                    <td>{presentCnt}</td>
                                                    <td>{rate}%</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationBar page={page} totalPages={totalPages} totalCount={totalCount} label="teachers" onPage={setPage} />
                        </>
                    )}
                </div>
            </div>
        </>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DosAttendance() {
    const { t } = useTranslation()
    const { setting } = useSchoolSettings()
    const toast = useToast()
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [mode,      setMode]      = useState('student')
    const { config } = useSchoolConfig()
    const [classList, setClassList] = useState([])
    // Rebuilt when either the classes or the school's configuration arrives —
    // the config loads asynchronously, so deriving this once inside the fetch
    // would group years before the section names were known.
    const sections = useMemo(() => sectionsFromClasses(classList, config), [classList, config])
    const [attStats,  setAttStats]  = useState(null)

    useEffect(() => {
        getDosClasses()
            .then(res => setClassList(Array.isArray(res) ? res : []))
            .catch(e => toast.error(errorMessage(e, 'Could not load classes.')))
        getDosAttendanceStats()
            .then(res => setAttStats(res))
            .catch(e => toast.error(errorMessage(e, 'Could not load attendance stats.')))
    }, [])

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay" />

            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.attendance')}
                        subtitle={t('dos.attendance.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>

                        <div className="portal-stat-grid">
                            {[
                                { icon: 'how_to_reg',         colorClass: 'success', value: attStats ? `${attStats.attendance_rate}%` : '-', label: t('dos.attendance.studentTab'),  trend: 'Current term',    trendClass: attStats?.attendance_rate >= 90 ? 'positive' : 'negative' },
                                { icon: 'person_off',         colorClass: 'warning', value: attStats ? attStats.absent_today           : '-', label: 'Absent Today',        trend: 'Needs follow-up', trendClass: 'negative' },
                                { icon: 'schedule',           colorClass: 'info',    value: attStats ? attStats.late_this_week         : '-', label: 'Late Arrivals',       trend: 'This week',       trendClass: '' },
                                { icon: 'supervisor_account', colorClass: 'success', value: attStats ? `${attStats.teacher_rate}%`     : '-', label: t('dos.attendance.teacherTab'),  trend: 'Today',           trendClass: attStats?.teacher_rate >= 90 ? 'positive' : 'negative' },
                            ].map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        {/* Mode toggle */}
                        <div className="att-mode-bar">
                            <button
                                className={`att-mode-btn${mode === 'student' ? ' active' : ''}`}
                                onClick={() => setMode('student')}
                            >
                                <span className="material-symbols-rounded" aria-hidden="true">groups</span> Student Attendance
                            </button>
                            <button
                                className={`att-mode-btn${mode === 'teacher' ? ' active' : ''}`}
                                onClick={() => setMode('teacher')}
                            >
                                <span className="material-symbols-rounded" aria-hidden="true">person</span> Teacher Attendance
                            </button>
                        </div>

                        {mode === 'student'
                            ? <StudentAttendanceTab sections={sections} />
                            : <TeacherAttendanceTab />
                        }

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
