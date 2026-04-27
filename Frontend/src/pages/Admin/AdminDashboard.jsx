import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const stats = [
    { icon: 'groups',          value: '1,245', label: 'Total Students',    trend: '+15 this term',   trendClass: 'positive', colorClass: ''        },
    { icon: 'badge',           value: '112',   label: 'Total Staff',       trend: '85 teachers',     trendClass: 'neutral',  colorClass: 'info'    },
    { icon: 'payments',        value: '94%',   label: 'Fee Collection',    trend: 'Term 2 · 2026',   trendClass: 'positive', colorClass: 'success' },
    { icon: 'pending_actions', value: '7',     label: 'Pending Approvals', trend: 'Requires action', trendClass: 'negative', colorClass: 'warning' },
]

const recentActivities = [
    { icon: 'person_add',   iconClass: 'success', text: '3 new staff contracts signed',            time: '1 hour ago'   },
    { icon: 'payments',     iconClass: 'info',    text: 'Fee payment batch processed — RWF 24M',  time: '3 hours ago'  },
    { icon: 'warning',      iconClass: 'warning', text: '2 student disciplinary cases escalated', time: '5 hours ago'  },
    { icon: 'check_circle', iconClass: 'success', text: 'Term 2 exam results approved by DOS',    time: 'Yesterday'    },
    { icon: 'announcement', iconClass: 'info',    text: 'School closure notice published',         time: '2 days ago'   },
]

const performanceData = [
    { label: 'School Avg',   value: 78 },
    { label: 'Attendance',   value: 94 },
    { label: 'Fee Collect.', value: 94 },
    { label: 'Staff Retent.',value: 97 },
]

function barColor(value) {
    if (value >= 90) return '#10b981'
    if (value >= 75) return '#003d7a'
    return '#f59e0b'
}

function OverviewTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip-label">{d.label}</div>
            <div style={{ color: barColor(d.value), fontWeight: 700 }}>{d.value}%</div>
        </div>
    )
}

const initialTasks = [
    { id: 1, icon: 'description', text: 'Review and sign Form 4 exam authorization letter', due: 'Due today'     },
    { id: 2, icon: 'payments',    text: 'Approve bursary applications — 12 pending',        due: 'Due Friday'    },
    { id: 3, icon: 'person',      text: 'Interview shortlisted PE teacher candidates',       due: 'Due next week' },
    { id: 4, icon: 'fact_check',  text: 'Verify Term 2 timetable submitted by DOS',         due: 'Due next week' },
]

export function AdminDashboard() {
    const navigate = useNavigate()
    const [tasks, setTasks]     = useState(initialTasks)
    const [doneTasks, setDone]  = useState(new Set())

    function toggleTask(id) {
        setDone(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    function dismissTask(id) {
        setTasks(prev => prev.filter(t => t.id !== id))
        setDone(prev => { const next = new Set(prev); next.delete(id); return next })
    }

    const pendingCount = tasks.filter(t => !doneTasks.has(t.id)).length

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Admin Dashboard"
                        subtitle="School-wide overview — Term 2, 2026"
                        userName={adminUser.userName}
                        userRole={adminUser.userRole}
                        userInitials={adminUser.userInitials}
                        avatarClass={adminUser.avatarClass}
                        notifications={adminUser.notifications}
                    />
                    <DashboardContent>

                        <WelcomeBanner
                            name="Dr. Nkurunziza"
                            role="School Principal &bull; Imboni Academy"
                            badge="Principal"
                        />

                        <div className="portal-stat-grid">
                            {stats.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="cards-grid">

                            {/* Recent Activity */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Recent Activity</h2>
                                </div>
                                <div className="card-content">
                                    {recentActivities.map((item, i) => (
                                        <div key={i} className="activity-item">
                                            <span className={`activity-icon ${item.iconClass}`}>
                                                <span className="material-symbols-rounded">{item.icon}</span>
                                            </span>
                                            <div className="activity-details">
                                                <p className="activity-title">{item.text}</p>
                                                <p className="activity-time">{item.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* School Overview chart */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">School Overview</h2>
                                    <p className="card-description">Key indicators — Term 2</p>
                                </div>
                                <div className="card-content">
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart
                                            data={performanceData}
                                            margin={{ top: 16, right: 8, left: -20, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                domain={[60, 100]}
                                                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={v => `${v}%`}
                                            />
                                            <Tooltip content={<OverviewTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                                                <LabelList
                                                    dataKey="value"
                                                    position="top"
                                                    formatter={v => `${v}%`}
                                                    style={{ fontSize: 11, fontWeight: 700, fill: 'var(--foreground)' }}
                                                />
                                                {performanceData.map((entry, i) => (
                                                    <Cell key={i} fill={barColor(entry.value)} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                    <div className="chart-legend-row" style={{ marginTop: '0.75rem' }}>
                                        {[['#10b981', '≥ 90% Excellent'], ['#003d7a', '75–89% Good'], ['#f59e0b', '< 75% Needs attention']].map(([color, label]) => (
                                            <div key={label} className="chart-legend-item">
                                                <span className="chart-legend-dot-sq" style={{ background: color }} />
                                                {label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Urgent Tasks */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Urgent Tasks</h2>
                                    {pendingCount > 0 && (
                                        <span className="badge badge-sm badge-pending-count">
                                            {pendingCount} pending
                                        </span>
                                    )}
                                </div>
                                <div className="card-content">
                                    {tasks.length === 0 && (
                                        <p className="tasks-empty">All tasks complete!</p>
                                    )}
                                    {tasks.map(task => {
                                        const done = doneTasks.has(task.id)
                                        return (
                                            <div key={task.id} className={`task-item${done ? ' done' : ''}`}>
                                                <button
                                                    className={`task-toggle-btn${done ? ' done' : ''}`}
                                                    onClick={() => toggleTask(task.id)}
                                                    title={done ? 'Mark incomplete' : 'Mark complete'}
                                                >
                                                    {done && <span className="material-symbols-rounded">check</span>}
                                                </button>
                                                <div className="task-body">
                                                    <p className={`task-text${done ? ' done' : ''}`}>{task.text}</p>
                                                    <p className="task-due">{task.due}</p>
                                                </div>
                                                <button className="task-dismiss" onClick={() => dismissTask(task.id)} title="Dismiss task">
                                                    <span className="material-symbols-rounded">close</span>
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                        </div>

                        {/* Quick Actions */}
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Quick Actions</h2>
                            </div>
                            <div className="card-content">
                                <div className="action-buttons">
                                    <button className="btn btn-primary" onClick={() => navigate('/admin/staff')}>
                                        <span className="material-symbols-rounded">person_add</span>
                                        Add Staff
                                    </button>
                                    <button className="btn btn-outline" onClick={() => navigate('/admin/announcements')}>
                                        <span className="material-symbols-rounded">announcement</span>
                                        Post Announcement
                                    </button>
                                    <button className="btn btn-outline" onClick={() => navigate('/admin/finance')}>
                                        <span className="material-symbols-rounded">payments</span>
                                        Finance Report
                                    </button>
                                    <button className="btn btn-outline" onClick={() => navigate('/admin/reports')}>
                                        <span className="material-symbols-rounded">bar_chart</span>
                                        View Reports
                                    </button>
                                </div>
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
