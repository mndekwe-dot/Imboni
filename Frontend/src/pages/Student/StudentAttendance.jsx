import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { getStudentProfile, getStudentAttendanceStats, getStudentAttendanceCalendar } from '../../api/student'
import { formatDate, formatWeekday } from '../../utils/date'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'

const MONTH_NAMES = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildCalendarGrid(year, month, records) {
    const recordMap = {}
    records.forEach(r => {
        const day = new Date(r.date).getDate()
        recordMap[day] = { status: r.status, time_in: r.time_in }
    })
    const daysInMonth  = new Date(year, month, 0).getDate()
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
    const cells = []
    for (let i = 0; i < firstDayOfWeek; i++) cells.push({ day: null, status: 'empty' })
    for (let day = 1; day <= daysInMonth; day++) {
        const dow = new Date(year, month - 1, day).getDay()
        const isWeekend = dow === 0 || dow === 6
        const rec = recordMap[day]
        cells.push({
            day,
            status:  rec ? rec.status : (isWeekend ? 'weekend' : 'no-record'),
            time_in: rec?.time_in || null,
        })
    }
    return cells
}

function statusDotClass(status) {
    switch (status) {
        case 'present':  return 'att-dot present'
        case 'absent':   return 'att-dot absent'
        case 'late':     return 'att-dot late'
        case 'excused':  return 'att-dot excused'
        default:         return 'att-dot'
    }
}
function statusTextClass(status) {
    switch (status) {
        case 'present':  return 'att-status-present'
        case 'absent':   return 'att-status-absent'
        case 'late':     return 'att-status-late'
        case 'excused':  return 'att-status-excused'
        default:         return ''
    }
}
function statusLabel(status) {
    if (!status || status === 'no-record' || status === 'weekend') return '-'
    return status.charAt(0).toUpperCase() + status.slice(1)
}

function CalendarCell({ day, status }) {
    if (!day) return <div className="cal-cell cal-empty"></div>
    return (
        <div className={`cal-cell cal-${status}`}>
            <span className="cal-day">{day}</span>
        </div>
    )
}

export function StudentAttendance() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const today = new Date()
    const [profile,  setProfile]  = useState(null)
    const [stats,    setStats]    = useState(null)
    const [records,  setRecords]  = useState([])
    const [month,    setMonth]    = useState(today.getMonth() + 1)
    const [year,     setYear]     = useState(today.getFullYear())
    const [loading,  setLoading]  = useState(true)
    const [calLoading, setCalLoading] = useState(false)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim()
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()

    useEffect(() => {
        Promise.all([
            getStudentProfile().catch(() => null),
            getStudentAttendanceStats().catch(() => null),
            getStudentAttendanceCalendar(month, year).catch(() => ({ records: [] })),
        ]).then(([prof, s, cal]) => {
            setProfile(prof)
            setStats(s)
            setRecords(cal?.records || [])
        }).finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (loading) return
        setCalLoading(true)
        getStudentAttendanceCalendar(month, year)
            .then(cal => setRecords(cal?.records || []))
            .catch(() => setRecords([]))
            .finally(() => setCalLoading(false))
    }, [month, year])

    const gradeSection = profile ? `${profile.grade}${profile.section}` : ''
    const userRole     = gradeSection
        ? `${t('roles.student')} · ${gradeSection}`
        : t('roles.student')

    const overallRate  = stats?.overall_rate  ?? 0
    const daysPresent  = stats?.days_present  ?? 0
    const daysAbsent   = stats?.days_absent   ?? 0
    const lateArrivals = stats?.late_arrivals ?? 0
    const excused      = stats?.excused_absences ?? 0
    const totalDays    = daysPresent + daysAbsent + lateArrivals + excused

    const statCards = [
        { materialSymbols: 'check_circle', statValueColor: 'var(--success)',     statValue: daysPresent,  statLabel: t('student.attendance.daysPresent')  },
        { materialSymbols: 'cancel',       statValueColor: 'var(--destructive)', statValue: daysAbsent,   statLabel: t('student.attendance.daysAbsent')   },
        { materialSymbols: 'schedule',     statValueColor: 'var(--warning)',     statValue: lateArrivals, statLabel: t('student.attendance.lateArrivals') },
        { materialSymbols: 'event_note',   statValueColor: 'var(--primary)',     statValue: totalDays,    statLabel: 'Total Days'    },
    ]

    const grid = buildCalendarGrid(year, month, records)

    const tableRecords = [...records].sort((a, b) => new Date(b.date) - new Date(a.date))

    function prevMonth() {
        if (month === 1) { setMonth(12); setYear(y => y - 1) }
        else setMonth(m => m - 1)
    }
    function nextMonth() {
        const now = new Date()
        if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return
        if (month === 12) { setMonth(1); setYear(y => y + 1) }
        else setMonth(m => m + 1)
    }

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.attendance')}
                        subtitle={`Your attendance record${gradeSection ? ` for ${gradeSection}` : ''}`}
                        userName={fullName}
                        userRole={userRole}
                        userInitials={initials}
                        avatarClass="student-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        {/* Hero */}
                        <div className="attendance-hero">
                            <div>
                                <div className="attendance-big-number">{loading ? '-' : `${overallRate}%`}</div>
                                <div className="attendance-big-label">{t('student.attendance.overallRate')}</div>
                                {stats?.attendance_label && <small className="u-muted">{stats.attendance_label}</small>}
                            </div>
                            <div className="attendance-breakdown">
                                <div className="att-breakdown-item"><span>{loading ? '-' : daysPresent}</span><small>{t('student.attendance.daysPresent')}</small></div>
                                <div className="att-breakdown-item"><span>{loading ? '-' : daysAbsent}</span><small>{t('student.attendance.daysAbsent')}</small></div>
                                <div className="att-breakdown-item"><span>{loading ? '-' : lateArrivals}</span><small>{t('student.attendance.lateArrivals')}</small></div>
                                <div className="att-breakdown-item"><span>{loading ? '-' : totalDays}</span><small>{t('student.attendance.totalDays')}</small></div>
                            </div>
                        </div>

                        {/* Stat cards */}
                        <div className="student-stats-grid">
                            {statCards.map((row, i) => (
                                <div key={i} className="student-stat-card">
                                    <div className="stat-icon green"><span className="material-symbols-rounded">{row.materialSymbols}</span></div>
                                    <div className="stat-body">
                                        <div className="stat-value" style={{ color: row.statValueColor }}>{loading ? '-' : row.statValue}</div>
                                        <div className="stat-label">{row.statLabel}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Calendar */}
                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded">calendar_month</span> {t('student.attendance.monthlyCalendar')}
                                </h3>
                                <div className="u-row-sm">
                                    <button className="btn btn-outline btn-icon" onClick={prevMonth}>
                                        <span className="material-symbols-rounded">chevron_left</span>
                                    </button>
                                    <span className="cal-month-label">
                                        {MONTH_NAMES[month]} {year}
                                    </span>
                                    <button className="btn btn-outline btn-icon" onClick={nextMonth}>
                                        <span className="material-symbols-rounded">chevron_right</span>
                                    </button>
                                </div>
                            </div>
                            <div className="card-content">
                                {calLoading ? (
                                    <p className="u-muted">{t('student.attendance.loadingCalendar')}</p>
                                ) : (
                                    <div className="att-calendar-grid">
                                        {DAY_LABELS.map(d => (
                                            <div key={d} className="cal-header-cell">{d}</div>
                                        ))}
                                        {grid.map((cell, i) => (
                                            <CalendarCell key={i} {...cell} />
                                        ))}
                                    </div>
                                )}
                                <div className="att-legend att-cal-legend">
                                    {['present', 'absent', 'late', 'excused', 'weekend'].map(s => (
                                        <span key={s}>
                                            <span className={`att-dot ${s}`}></span>{t(`common.${s}`)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Records table */}
                        <div className="attendance-table-card">
                            <div className="section-card-header">
                                <h3><span className="material-symbols-rounded">table_view</span> Attendance Records: {MONTH_NAMES[month]} {year}</h3>
                            </div>
                            <div className="card-content">
                                {tableRecords.length === 0 ? (
                                    <p className="att-empty">{t('student.attendance.noRecords')}</p>
                                ) : (
                                    <div className="table-responsive">
                                        <table>
                                            <thead>
                                                <tr><th>{t('common.date')}</th><th>{t('common.day')}</th><th>{t('common.status')}</th><th>{t('common.timeIn')}</th></tr>
                                            </thead>
                                            <tbody>
                                                {tableRecords.map((r, i) => {
                                                    const d = new Date(r.date)
                                                    const dateStr = formatDate(d)
                                                    const dayStr  = formatWeekday(d)
                                                    const timeStr = r.time_in ? r.time_in.slice(0, 5) : '-'
                                                    return (
                                                        <tr key={i}>
                                                            <td>{dateStr}</td>
                                                            <td>{dayStr}</td>
                                                            <td>
                                                                <span className={statusDotClass(r.status)}></span>
                                                                <span className={statusTextClass(r.status)}>{statusLabel(r.status)}</span>
                                                            </td>
                                                            <td>{timeStr}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
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
