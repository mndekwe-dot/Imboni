import { useState } from 'react'
import { useNavigate } from 'react-router'
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
    { label: 'School Average',  value: '78%', width: '78%' },
    { label: 'Attendance Rate', value: '94%', width: '94%' },
    { label: 'Fee Collection',  value: '94%', width: '94%' },
    { label: 'Staff Retention', value: '97%', width: '97%' },
]

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

                            {/* School Performance */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">School Overview</h2>
                                    <p className="card-description">Key indicators — Term 2</p>
                                </div>
                                <div className="card-content">
                                    {performanceData.map((item, i) => (
                                        <div key={i} className="progress-item">
                                            <div className="progress-label">
                                                <span>{item.label}</span>
                                                <span className="progress-value">{item.value}</span>
                                            </div>
                                            <div className="progress-bar">
                                                <div className="progress-fill" style={{ width: item.width }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Urgent Tasks */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Urgent Tasks</h2>
                                    {pendingCount > 0 && (
                                        <span className="badge badge-sm" style={{ background: 'var(--destructive-light)', color: 'var(--destructive)' }}>
                                            {pendingCount} pending
                                        </span>
                                    )}
                                </div>
                                <div className="card-content">
                                    {tasks.length === 0 && (
                                        <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.875rem', padding: '1rem 0' }}>
                                            All tasks complete!
                                        </p>
                                    )}
                                    {tasks.map((task, i) => {
                                        const done = doneTasks.has(task.id)
                                        return (
                                            <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', padding: '0.625rem 0', borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none', opacity: done ? 0.5 : 1 }}>
                                                <button
                                                    onClick={() => toggleTask(task.id)}
                                                    title={done ? 'Mark incomplete' : 'Mark complete'}
                                                    style={{ border: `2px solid ${done ? 'var(--success)' : 'var(--border)'}`, borderRadius: '50%', width: '20px', height: '20px', minWidth: '20px', background: done ? 'var(--success)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px', padding: 0 }}
                                                >
                                                    {done && <span className="material-symbols-rounded" style={{ fontSize: '0.8rem', color: '#fff' }}>check</span>}
                                                </button>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ fontSize: '0.875rem', margin: 0, textDecoration: done ? 'line-through' : 'none' }}>{task.text}</p>
                                                    <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>{task.due}</p>
                                                </div>
                                                <button
                                                    onClick={() => dismissTask(task.id)}
                                                    title="Dismiss task"
                                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '2px', display: 'flex' }}
                                                >
                                                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>close</span>
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
