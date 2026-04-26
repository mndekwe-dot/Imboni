import { useNavigate } from 'react-router'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const dashStats = [
    { icon: 'check_circle',    value: '94%', label: 'Attendance Rate',  trend: '+2.5% from last week', trendClass: 'positive', colorClass: 'success' },
    { icon: 'school',          value: '81%', label: 'Class Average',    trend: '+4% from last term',   trendClass: 'positive', colorClass: '' },
    { icon: 'assignment_late', value: '8',   label: 'Pending Grading',  trend: '3 due this week',      trendClass: 'negative', colorClass: 'warning' },
    { icon: 'groups',          value: '152', label: 'Total Students',   trend: 'Across 5 classes',     trendClass: '',          colorClass: '' },
    { icon: 'menu_book',       value: '5',   label: 'Classes Today',    trend: '2 completed, 3 left',  trendClass: '',          colorClass: '' },
]


const todaySchedule = [
    { time: '08:00 - 09:00', room: 'Room 201', className: 'S4A', subject: 'Mathematics', status: 'Completed',   statusClass: 'badge-completed', cardClass: 'completed', showMark: false, to: '/teacher/classes'    },
    { time: '09:15 - 10:15', room: 'Room 203', className: 'S4B', subject: 'Mathematics', status: 'In Progress', statusClass: 'badge-primary',   cardClass: 'current',   showMark: true,  to: '/teacher/attendance' },
    { time: '11:00 - 12:00', room: 'Room 205', className: 'S5A', subject: 'Mathematics', status: 'Upcoming',    statusClass: 'badge-secondary', cardClass: 'upcoming',  showMark: false, to: '/teacher/classes'    },
    { time: '02:00 - 03:00', room: 'Room 102', className: 'S3B', subject: 'Mathematics', status: 'Upcoming',    statusClass: 'badge-secondary', cardClass: 'upcoming',  showMark: false, to: '/teacher/classes'    },
    { time: '03:15 - 04:15', room: 'Room 301', className: 'S6A', subject: 'Mathematics', status: 'Upcoming',    statusClass: 'badge-secondary', cardClass: 'upcoming',  showMark: false, to: '/teacher/classes'    },
]

const pendingTasks = [
    { title: 'Submit S4B Quiz Results',   deadline: 'Due: Today',  priority: 'high',   priorityClass: 'badge-high',   to: '/teacher/classes'     },
    { title: 'Mark S5A Attendance',       deadline: 'Due: Today',  priority: 'high',   priorityClass: 'badge-high',   to: '/teacher/attendance'  },
    { title: 'Complete Progress Reports', deadline: 'Due: Jan 30', priority: 'medium', priorityClass: 'badge-medium', to: '/teacher/classes'     },
    { title: 'Review S6A Mock Exams',     deadline: 'Due: Feb 2',  priority: 'low',    priorityClass: 'badge-low',    to: '/teacher/assignments' },
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

function ScheduleCard({ time, room, className, subject, status, statusClass, cardClass, showMark, to, onNavigate }) {
    return (
        <div
            className={`schedule-card ${cardClass} cursor-ptr`}
            onClick={() => onNavigate(to)}
        >
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
            {showMark && (
                <button
                    className="btn-mark-attendance btn btn-primary btn-sm"
                    onClick={e => { e.stopPropagation(); onNavigate('/teacher/attendance') }}
                >
                    Mark Attendance
                </button>
            )}
            <span className={`badge ${statusClass}`}>{status}</span>
        </div>
    )
}

function TaskCard({ title, deadline, priority, priorityClass, to, onNavigate }) {
    return (
        <div className="task-card cursor-ptr" onClick={() => onNavigate(to)}>
            <div className={`task-priority-dot ${priority}`}></div>
            <div className="task-content">
                <div className="task-title">{title}</div>
                <div className="task-deadline">{deadline}</div>
            </div>
            <span className={`badge ${priorityClass}`}>{priority}</span>
        </div>
    )
}

function barColor(value) {
    if (value >= 80) return '#10b981'
    if (value >= 70) return '#003d7a'
    return '#f59e0b'
}

function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip-label">{d.className}</div>
            <div style={{ color: barColor(d.value) }}>{d.value}% average</div>
            <div className="chart-tooltip-trend" style={{ color: d.trendClass === 'up' ? '#10b981' : '#ef4444' }}>
                {d.trendClass === 'up' ? '▲' : '▼'} {d.trendText} vs last term
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

                    <DashboardContent>

                        <WelcomeBanner
                            name="Mr. Rurangwa"
                            role="Mathematics Teacher &bull; Imboni Academy"
                        />

                        {/* Quick actions container */}
                        <div className="dash-card">
                            <div className="section-label-sm">
                                Quick Actions
                            </div>
                            <div className="quick-actions">
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
                        <div className="dash-card">
                            <div className="section-label-sm">
                                Overview
                            </div>
                            <div className="portal-stat-grid">
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
                                        <ScheduleCard key={i} {...slot} onNavigate={navigate} />
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
                                        <TaskCard key={i} {...task} onNavigate={navigate} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="content-grid-1-1">
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Class Performance</h3>
                                    <span className="text-xs-muted">Average score per class</span>
                                </div>
                                <div className="card-content">
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart
                                            data={classPerformance}
                                            margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                            <XAxis
                                                dataKey="className"
                                                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                domain={[50, 100]}
                                                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={v => `${v}%`}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44}>
                                                {classPerformance.map((entry, i) => (
                                                    <Cell key={i} fill={barColor(entry.value)} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>

                                    {/* Legend */}
                                    <div className="chart-legend-row">
                                        {[['#10b981', '≥ 80% Excellent'], ['#003d7a', '70–79% Good'], ['#f59e0b', '< 70% Needs attention']].map(([color, label]) => (
                                            <div key={label} className="chart-legend-item">
                                                <span className="chart-legend-dot-sq" style={{ background: color }} />
                                                {label}
                                            </div>
                                        ))}
                                    </div>
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

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
