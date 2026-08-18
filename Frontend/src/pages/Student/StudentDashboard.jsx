import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { getStudentProfile, getStudentDashboard } from '../../api/student'
import { formatDateShort, formatDateWithWeekday } from '../../utils/date'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'

function formatTime(timeStr) {
    if (!timeStr) return ''
    const [h, m] = timeStr.split(':')
    const hour = parseInt(h, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const display = hour % 12 || 12
    return `${display}:${m} ${ampm}`
}

// Takes `t` rather than calling useTranslation: this is a plain helper, not a
// component, so it cannot use a hook.
function formatDueDate(dateStr, t) {
    if (!dateStr) return ''
    const today = new Date()
    const due = new Date(dateStr)
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diff = Math.round((due - today) / 86400000)
    if (diff === 0) return t('student.dashboard.dueToday')
    if (diff === 1) return t('student.dashboard.dueTomorrow')
    if (diff < 0) return t('student.dashboard.overdue')
    return formatDateShort(due)
}

function dueDotColor(dateStr) {
    if (!dateStr) return 'schedule-dot-muted'
    const today = new Date()
    const due = new Date(dateStr)
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diff = Math.round((due - today) / 86400000)
    if (diff < 0) return 'schedule-dot-orange'
    if (diff === 0) return 'schedule-dot-orange'
    if (diff <= 3) return 'schedule-dot-teal'
    return 'schedule-dot-indigo'
}

function dueClass(dateStr) {
    if (!dateStr) return ''
    const today = new Date()
    const due = new Date(dateStr)
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diff = Math.round((due - today) / 86400000)
    if (diff < 0) return 'due-today'
    if (diff === 0) return 'due-today'
    if (diff <= 3) return 'due-soon'
    return 'due-later'
}

function gradeColor(g) {
    if (!g || g === 'N/A') return 'badge-soft-info'
    if (g === 'A' || g === 'A+') return 'badge-soft-success'
    if (g === 'B' || g === 'B+') return 'badge-soft-info'
    if (g === 'C') return 'badge-soft-warning'
    return 'badge-soft-danger'
}

function ScheduleSlot({ start_time, end_time, subject, teacher, room }) {
    return (
        <div className="schedule-slot">
            <span className="schedule-time">{formatTime(start_time)}</span>
            <span className="schedule-dot schedule-dot-teal"></span>
            <div className="schedule-info">
                <div className="schedule-subject">{subject}</div>
                <div className="schedule-room">{room} {teacher ? `• ${teacher}` : ''}</div>
            </div>
        </div>
    )
}

function AssignItem({ title, subject, due_date }) {
    const { t } = useTranslation()
    return (
        <div className="assign-item">
            <span className={`assign-subject-dot ${dueDotColor(due_date)}`}></span>
            <div className="assign-info">
                <div className="assign-title">{title}</div>
                <div className="assign-subject">{subject}</div>
            </div>
            <span className={`assign-due ${dueClass(due_date)}`}>{formatDueDate(due_date, t)}</span>
        </div>
    )
}

function GradeRow({ subject, grade, final_score, term }) {
    return (
        <tr>
            <td><strong>{subject}</strong></td>
            <td>{term}</td>
            <td>{final_score != null ? `${final_score}%` : '-'}</td>
            <td><span className={`badge ${gradeColor(grade)}`}>{grade || '-'}</span></td>
        </tr>
    )
}

export function StudentDashboard() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [profile,   setProfile]   = useState(null)
    const [dashboard, setDashboard] = useState(null)
    const [loading,   setLoading]   = useState(true)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || t('roles.student')
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'S'

    useEffect(() => {
        Promise.all([
            getStudentProfile().catch(() => null),
            getStudentDashboard().catch(() => null),
        ]).then(([prof, dash]) => {
            setProfile(prof)
            setDashboard(dash)
        }).finally(() => setLoading(false))
    }, [])

    const gradeSection = profile ? `${profile.grade}${profile.section}` : ''
    const studentCode  = profile?.student_code || ''
    const userRole     = gradeSection
        ? `${t('roles.student')} · ${gradeSection}`
        : t('roles.student')

    const stats = dashboard?.stats || {}
    const todaySchedule      = dashboard?.today_schedule      || []
    const upcomingAssignments = dashboard?.upcoming_assignments || []
    const recentGrades        = dashboard?.recent_grades       || []

    const statCards = [
        { icon: 'fact_check', value: loading ? '-' : `${stats.attendance_percentage ?? '-'}%`, label: t('student.dashboard.attendance'), trend: t('student.dashboard.thisTerm'),     trendClass: 'positive', colorClass: 'success' },
        { icon: 'shield',     value: loading ? '-' : (stats.conduct_grade || '-'),              label: t('student.dashboard.conductGrade'), trend: t('student.dashboard.currentTerm'),  trendClass: '',         colorClass: 'info'    },
        { icon: 'assignment', value: loading ? '-' : (stats.pending_assignments ?? '-'),         label: t('student.dashboard.pendingAssignments'), trend: t('student.dashboard.dueUpcoming'),  trendClass: 'negative', colorClass: 'warning' },
        { icon: 'grade',      value: loading ? '-' : (stats.recent_grade || '-'),               label: t('student.dashboard.latestGrade'), trend: t('student.dashboard.mostRecent'),   trendClass: 'positive', colorClass: ''        },
    ]

    const today = formatDateWithWeekday()

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.dashboard')}
                        subtitle={t('student.dashboard.welcomeBack', { name: firstName || t('roles.student') })}
                        userName={fullName}
                        userRole={userRole}
                        userInitials={initials}
                        avatarClass="student-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        {/* Welcome Banner */}
                        <div className="student-welcome-banner">
                            <div className="welcome-text">
                                <h2>{t('student.dashboard.greeting', { name: firstName || t('roles.student') })}</h2>
                                <p>
                                    {gradeSection && <>{gradeSection} &nbsp;•&nbsp;</>}
                                    {studentCode  && <>{t('student.dashboard.studentId', { code: studentCode })} &nbsp;•&nbsp;</>}
                                    {today}
                                </p>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="portal-stat-grid">
                            {statCards.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        {/* Two-column layout */}
                        <div className="dashboard-two-col">

                            {/* Today's Schedule */}
                            <div className="today-schedule-card">
                                <div className="section-card-header">
                                    <h3><span className="material-symbols-rounded">schedule</span> {t('student.dashboard.todaySchedule')}</h3>
                                    <Link to="/student/timetable" className="btn btn-outline btn-sm">{t('student.dashboard.fullTimetable')}</Link>
                                </div>
                                <div className="section-card-body">
                                    {loading ? (
                                        <p className="att-empty">{t('common.loading')}</p>
                                    ) : todaySchedule.length === 0 ? (
                                        <p className="att-empty">{t('student.dashboard.noClassesToday')}</p>
                                    ) : (
                                        todaySchedule.map((slot, i) => <ScheduleSlot key={i} {...slot} />)
                                    )}
                                </div>
                            </div>

                            {/* Upcoming Assignments */}
                            <div className="upcoming-assignments-card">
                                <div className="section-card-header">
                                    <h3><span className="material-symbols-rounded">assignment</span> {t('student.dashboard.upcomingAssignments')}</h3>
                                    <Link to="/student/assignments" className="btn btn-outline btn-sm">{t('common.viewAll')}</Link>
                                </div>
                                {loading ? (
                                    <p className="att-empty">{t('common.loading')}</p>
                                ) : upcomingAssignments.length === 0 ? (
                                    <p className="att-empty">{t('student.dashboard.noUpcomingAssignments')}</p>
                                ) : (
                                    upcomingAssignments.map((item, i) => <AssignItem key={i} {...item} />)
                                )}
                            </div>

                        </div>

                        {/* Recent Grades */}
                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">{t('student.dashboard.recentGrades')}</h3>
                                <Link to="/student/results" className="btn btn-outline btn-sm">{t('student.dashboard.fullReport')}</Link>
                            </div>
                            <div className="card-content">
                                {loading ? (
                                    <p className="u-muted">{t('common.loading')}</p>
                                ) : recentGrades.length === 0 ? (
                                    <p className="u-muted">{t('student.dashboard.noResults')}</p>
                                ) : (
                                    <div className="table-responsive">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>{t('common.subject')}</th><th>{t('common.term')}</th><th>{t('common.score')}</th><th>{t('common.grade')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentGrades.map((row, i) => <GradeRow key={i} {...row} />)}
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
