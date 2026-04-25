import { useNavigate } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'


const dashStats = [
    { icon: 'check_circle',    value: '94%', label: 'Attendance Rate',  trend: '+2.5% from last week', trendClass: 'positive', colorClass: 'success' },
    { icon: 'school',          value: '81%', label: 'Class Average',    trend: '+4% from last term',   trendClass: 'positive', colorClass: '' },
    { icon: 'assignment_late', value: '8',   label: 'Pending Grading',  trend: '3 due this week',      trendClass: 'negative', colorClass: 'warning' },
    { icon: 'groups',          value: '152', label: 'Total Students',   trend: 'Across 5 classes',     trendClass: '',          colorClass: '' },
    { icon: 'menu_book',       value: '5',   label: 'Classes Today',    trend: '2 completed, 3 left',  trendClass: '',          colorClass: '' },
]

const cardStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '1rem 1.25rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
}

const todaySchedule = [
    { time: '08:00 - 09:00', room: 'Room 201', className: 'S4A', subject: 'Mathematics', status: 'Completed',   statusClass: 'badge-completed', cardClass: 'completed', showMark: false },
    { time: '09:15 - 10:15', room: 'Room 203', className: 'S4B', subject: 'Mathematics', status: 'In Progress', statusClass: 'badge-primary',   cardClass: 'current',   showMark: true  },
    { time: '11:00 - 12:00', room: 'Room 205', className: 'S5A', subject: 'Mathematics', status: 'Upcoming',    statusClass: 'badge-secondary', cardClass: 'upcoming',  showMark: false },
    { time: '02:00 - 03:00', room: 'Room 102', className: 'S3B', subject: 'Mathematics', status: 'Upcoming',    statusClass: 'badge-secondary', cardClass: 'upcoming',  showMark: false },
    { time: '03:15 - 04:15', room: 'Room 301', className: 'S6A', subject: 'Mathematics', status: 'Upcoming',    statusClass: 'badge-secondary', cardClass: 'upcoming',  showMark: false },
]

const pendingTasks = [
    { title: 'Submit S4B Quiz Results',   deadline: 'Due: Today',  priority: 'high',   priorityClass: 'badge-high'   },
    { title: 'Mark S5A Attendance',       deadline: 'Due: Today',  priority: 'high',   priorityClass: 'badge-high'   },
    { title: 'Complete Progress Reports', deadline: 'Due: Jan 30', priority: 'medium', priorityClass: 'badge-medium' },
    { title: 'Review S6A Mock Exams',     deadline: 'Due: Feb 2',  priority: 'low',    priorityClass: 'badge-low'    },
]

const classPerformance = [
    { className: 'S4A', value: 78, trendClass: 'up',   trendIcon: 'trending_up',   trendText: '5%' },
    { className: 'S4B', value: 72, trendClass: 'down', trendIcon: 'trending_down', trendText: '3%' },
    { className: 'S5A', value: 85, trendClass: 'up',   trendIcon: 'trending_up',   trendText: '8%' },
    { className: 'S3B', value: 68, trendClass: 'up',   trendIcon: 'trending_up',   trendText: '2%' },
    { className: 'S6A', value: 82, trendClass: 'down', trendIcon: 'trending_down', trendText: '1%' },
]

const recentActivities = [
    { iconClass: 'result',       icon: 'assignment_turned_in', boldText: 'Submitted results',    restText: ' - S4A Mid-Term',              time: '2 hours ago' },
    { iconClass: 'attendance',   icon: 'check_circle',         boldText: 'Marked attendance',    restText: ' - S4B',                       time: '3 hours ago' },
    { iconClass: 'incident',     icon: 'report_problem',       boldText: 'Reported incident',    restText: ' - Student: Mutabazi Kevin',   time: '5 hours ago' },
    { iconClass: 'announcement', icon: 'campaign',             boldText: 'Created announcement', restText: ' - Homework Assignment',       time: '1 day ago'   },
]

function ScheduleCard({ time, room, className, subject, status, statusClass, cardClass, showMark }) {
    return (
        <div className={`schedule-card ${cardClass}`}>
            <div className="schedule-info">
                <div className="schedule-time">
                    <div className="schedule-time-main">{time}</div>
                    <div className="schedule-time-sub">{room}</div>
                </div>
                <div className="schedule-divider"></div>
                <div>
                    <div className="schedule-class-name">{className}</div>
                    <div className="schedule-class-subject">{subject}</div>
                </div>
            </div>
            {showMark && <button className="btn-mark-attendance btn btn-primary btn-sm">Mark Attendance</button>}
            <span className={`badge ${statusClass}`}>{status}</span>
        </div>
    )
}

function TaskCard({ title, deadline, priority, priorityClass }) {
    return (
        <div className="task-card">
            <div className={`task-priority-dot ${priority}`}></div>
            <div className="task-content">
                <div className="task-title">{title}</div>
                <div className="task-deadline">{deadline}</div>
            </div>
            <span className={`badge ${priorityClass}`}>{priority}</span>
        </div>
    )
}

function PerformanceItem({ className, value, trendClass, trendIcon, trendText }) {
    return (
        <div className="performance-item">
            <div className="performance-header">
                <span className="performance-class">{className}</span>
                <div className="performance-stats">
                    <span className="performance-value">{value}%</span>
                    <span className={`performance-trend ${trendClass}`}>
                        <span className="material-symbols-rounded icon-md">{trendIcon}</span>{trendText}
                    </span>
                </div>
            </div>
            <div className="performance-bar">
                <div className="performance-bar-fill" data-width={value}></div>
            </div>
        </div>
    )
}

function ActivityItem({ iconClass, icon, boldText, restText, time }) {
    return (
        <div className="activity-item">
            <div className={`activity-icon ${iconClass}`}>
                <span className="material-symbols-rounded icon-md">{icon}</span>
            </div>
            <div className="activity-content">
                <div className="activity-text">
                    <strong>{boldText}</strong>{restText}
                </div>
                <div className="activity-time">
                    <span className="material-symbols-rounded icon-sm">schedule</span>{time}
                </div>
            </div>
        </div>
    )
}

export function TeacherDashboard() {
    const navigate = useNavigate()

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Dashboard" subtitle="Teacher Overview" {...teacherUser} />

                    <div className="dashboard-content">

                        <WelcomeBanner
                            name="Mr. Rurangwa"
                            role="Mathematics Teacher &bull; Imboni Academy"
                        />

                        {/* Quick actions container */}
                        <div style={cardStyle}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                                Quick Actions
                            </div>
                            <div className="quick-actions" style={{ margin: 0 }}>
                                <button className="btn btn-primary" onClick={() => navigate('/teacher/attendance')}>
                                    <span className="material-symbols-rounded">how_to_reg</span>
                                    Mark Attendance
                                </button>
                                <button className="btn btn-outline" onClick={() => navigate('/teacher/classes')}>
                                    <span className="material-symbols-rounded">edit_note</span>
                                    Enter Results
                                </button>
                                <button className="btn btn-outline" onClick={() => navigate('/teacher/assignments')}>
                                    <span className="material-symbols-rounded">assignment</span>
                                    Assignments
                                </button>
                                <button className="btn btn-outline" onClick={() => navigate('/teacher/classes')}>
                                    <span className="material-symbols-rounded">groups</span>
                                    My Classes
                                </button>
                            </div>
                        </div>

                        {/* Stats container */}
                        <div style={cardStyle}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                                Overview
                            </div>
                            <div className="portal-stat-grid" style={{ margin: 0 }}>
                                {dashStats.map((stat, i) => (
                                    <StatCard key={i} {...stat} />
                                ))}
                            </div>
                        </div>

                        <div className="content-grid-2-1">
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Today's Schedule</h3>
                                </div>
                                <div className="card-content">
                                    {todaySchedule.map((slot, i) => (
                                        <ScheduleCard key={i} {...slot} />
                                    ))}
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Pending Tasks</h3>
                                    <span className="badge badge-secondary">4</span>
                                </div>
                                <div className="card-content">
                                    {pendingTasks.map((task, i) => (
                                        <TaskCard key={i} {...task} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="content-grid-1-1">
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Class Performance</h3>
                                </div>
                                <div className="card-content">
                                    {classPerformance.map((item, i) => (
                                        <PerformanceItem key={i} {...item} />
                                    ))}
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Recent Activities</h3>
                                </div>
                                <div className="card-content">
                                    {recentActivities.map((item, i) => (
                                        <ActivityItem key={i} {...item} />
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </>
    )
}
