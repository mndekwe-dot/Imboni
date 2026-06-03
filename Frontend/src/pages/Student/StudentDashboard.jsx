import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { getStudentProfile, getStudentDashboard } from '../../api/student'
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

function formatDueDate(dateStr) {
    if (!dateStr) return ''
    const today = new Date()
    const due = new Date(dateStr)
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diff = Math.round((due - today) / 86400000)
    if (diff === 0) return 'Due today'
    if (diff === 1) return 'Due tomorrow'
    if (diff < 0) return 'Overdue'
    return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
    return (
        <div className="assign-item">
            <span className={`assign-subject-dot ${dueDotColor(due_date)}`}></span>
            <div className="assign-info">
                <div className="assign-title">{title}</div>
                <div className="assign-subject">{subject}</div>
            </div>
            <span className={`assign-due ${dueClass(due_date)}`}>{formatDueDate(due_date)}</span>
        </div>
    )
}

function GradeRow({ subject, grade, final_score, term }) {
    return (
        <tr>
            <td><strong>{subject}</strong></td>
            <td>{term}</td>
            <td>{final_score != null ? `${final_score}%` : '—'}</td>
            <td><span className={`badge ${gradeColor(grade)}`}>{grade || '—'}</span></td>
        </tr>
    )
}

export function StudentDashboard() {
    const [profile,   setProfile]   = useState(null)
    const [dashboard, setDashboard] = useState(null)
    const [loading,   setLoading]   = useState(true)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Student'
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
    const userRole     = gradeSection ? `Student · ${gradeSection}` : 'Student'

    const stats = dashboard?.stats || {}
    const todaySchedule      = dashboard?.today_schedule      || []
    const upcomingAssignments = dashboard?.upcoming_assignments || []
    const recentGrades        = dashboard?.recent_grades       || []

    const statCards = [
        { icon: 'fact_check', value: loading ? '—' : `${stats.attendance_percentage ?? '—'}%`, label: 'Attendance',          trend: 'This term',     trendClass: 'positive', colorClass: 'success' },
        { icon: 'shield',     value: loading ? '—' : (stats.conduct_grade || '—'),              label: 'Conduct Grade',       trend: 'Current term',  trendClass: '',         colorClass: 'info'    },
        { icon: 'assignment', value: loading ? '—' : (stats.pending_assignments ?? '—'),         label: 'Pending Assignments', trend: 'Due upcoming',  trendClass: 'negative', colorClass: 'warning' },
        { icon: 'grade',      value: loading ? '—' : (stats.recent_grade || '—'),               label: 'Latest Grade',        trend: 'Most recent',   trendClass: 'positive', colorClass: ''        },
    ]

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Dashboard"
                        subtitle={`Welcome back, ${firstName || 'Student'}`}
                        userName={fullName}
                        userRole={userRole}
                        userInitials={initials}
                        avatarClass="student-av"
                    />
                    <DashboardContent>

                        {/* Welcome Banner */}
                        <div className="student-welcome-banner">
                            <div className="welcome-text">
                                <h2>Good morning, {firstName || 'Student'}!</h2>
                                <p>
                                    {gradeSection && <>{gradeSection} &nbsp;•&nbsp;</>}
                                    {studentCode  && <>Student ID: {studentCode} &nbsp;•&nbsp;</>}
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
                                    <h3><span className="material-symbols-rounded">schedule</span> Today's Schedule</h3>
                                    <Link to="/student/timetable" className="btn btn-outline btn-sm">Full Timetable</Link>
                                </div>
                                <div className="section-card-body">
                                    {loading ? (
                                        <p style={{ padding: '1rem', color: 'var(--muted-foreground)' }}>Loading…</p>
                                    ) : todaySchedule.length === 0 ? (
                                        <p style={{ padding: '1rem', color: 'var(--muted-foreground)' }}>No classes scheduled today.</p>
                                    ) : (
                                        todaySchedule.map((slot, i) => <ScheduleSlot key={i} {...slot} />)
                                    )}
                                </div>
                            </div>

                            {/* Upcoming Assignments */}
                            <div className="upcoming-assignments-card">
                                <div className="section-card-header">
                                    <h3><span className="material-symbols-rounded">assignment</span> Upcoming Assignments</h3>
                                    <Link to="/student/assignments" className="btn btn-outline btn-sm">View All</Link>
                                </div>
                                {loading ? (
                                    <p style={{ padding: '1rem', color: 'var(--muted-foreground)' }}>Loading…</p>
                                ) : upcomingAssignments.length === 0 ? (
                                    <p style={{ padding: '1rem', color: 'var(--muted-foreground)' }}>No upcoming assignments.</p>
                                ) : (
                                    upcomingAssignments.map((item, i) => <AssignItem key={i} {...item} />)
                                )}
                            </div>

                        </div>

                        {/* Recent Grades */}
                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">Recent Grades</h3>
                                <Link to="/student/results" className="btn btn-outline btn-sm">Full Report</Link>
                            </div>
                            <div className="card-content">
                                {loading ? (
                                    <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
                                ) : recentGrades.length === 0 ? (
                                    <p style={{ color: 'var(--muted-foreground)' }}>No results yet.</p>
                                ) : (
                                    <div className="table-responsive">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Subject</th><th>Term</th><th>Score</th><th>Grade</th>
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
