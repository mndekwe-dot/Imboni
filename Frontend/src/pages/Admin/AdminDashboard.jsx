import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import { getAdminDashboardStats, getAdminRecentActivity } from '../../api/admin'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'

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
            <div className="u-bold" style={{ color: barColor(d.value) }}>{d.value}%</div>
        </div>
    )
}

const ACTIVITY_ICON = {
    result_approved: { icon: 'check_circle', cls: 'success' },
    teacher_added:   { icon: 'person_add',   cls: 'info'    },
    pending_summary: { icon: 'pending',       cls: 'warning' },
}

export function AdminDashboard() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const navigate = useNavigate()

    const [stats,      setStats]      = useState(null)
    const [activities, setActivities] = useState([])
    const [loading,    setLoading]    = useState(true)

    useEffect(() => {
        Promise.all([
            getAdminDashboardStats().catch(() => null),
            getAdminRecentActivity({ limit: 5 }).catch(() => []),
        ]).then(([s, a]) => {
            setStats(s)
            setActivities(Array.isArray(a) ? a : (a?.results ?? []))
        }).finally(() => setLoading(false))
    }, [])

    const statCards = stats ? [
        { icon: 'groups',          value: stats.total_students,    label: 'Total Students',    trend: `+${stats.new_students} this term`, trendClass: 'positive', colorClass: ''        },
        { icon: 'badge',           value: stats.teaching_staff,   label: 'Teaching Staff',    trend: 'Active teachers',                  trendClass: 'neutral',  colorClass: 'info'    },
        { icon: 'trending_up',     value: `${stats.avg_performance}%`, label: 'Avg Performance', trend: stats.avg_performance_change >= 0 ? `+${stats.avg_performance_change}% vs prev term` : `${stats.avg_performance_change}% vs prev term`, trendClass: stats.avg_performance_change >= 0 ? 'positive' : 'negative', colorClass: 'success' },
        { icon: 'pending_actions', value: stats.pending_approvals, label: 'Pending Approvals', trend: 'Requires action',                  trendClass: stats.pending_approvals > 0 ? 'negative' : 'positive', colorClass: 'warning' },
    ] : [
        { icon: 'groups',          value: '-', label: 'Total Students',    trend: 'Loading…', trendClass: 'neutral', colorClass: ''        },
        { icon: 'badge',           value: '-', label: 'Teaching Staff',    trend: 'Loading…', trendClass: 'neutral', colorClass: 'info'    },
        { icon: 'trending_up',     value: '-', label: 'Avg Performance',   trend: 'Loading…', trendClass: 'neutral', colorClass: 'success' },
        { icon: 'pending_actions', value: '-', label: 'Pending Approvals', trend: 'Loading…', trendClass: 'neutral', colorClass: 'warning' },
    ]

    const performanceData = stats ? [
        { label: 'School Avg',    value: stats.avg_performance    || 0 },
        { label: 'Attendance',    value: stats.attendance_rate    || 0 },
    ].filter(d => d.value > 0) : []

    const firstName = adminUser.userName.split(' ').find(w => !w.startsWith('Dr') && !w.startsWith('Mr') && !w.startsWith('Mrs')) || adminUser.userName.split(' ')[0]

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Admin Dashboard"
                        subtitle="School-wide overview (Term 2, 2026)"
                        {...adminUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <WelcomeBanner
                            name={firstName}
                            role="School Principal &bull; Imboni Academy"
                            badge="Principal"
                        />

                        <div className="portal-stat-grid">
                            {statCards.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="cards-grid">

                            {/* Recent Activity */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Recent Activity</h2>
                                </div>
                                <div className="card-content">
                                    {loading ? (
                                        <p className="adm-dash-note">Loading…</p>
                                    ) : activities.length === 0 ? (
                                        <p className="adm-dash-note">No recent activity.</p>
                                    ) : (
                                        activities.map((item, i) => {
                                            const meta = ACTIVITY_ICON[item.type] || { icon: 'info', cls: 'info' }
                                            return (
                                                <div key={i} className="activity-item">
                                                    <span className={`activity-icon ${meta.cls}`}>
                                                        <span className="material-symbols-rounded">{item.icon || meta.icon}</span>
                                                    </span>
                                                    <div className="activity-details">
                                                        <p className="activity-title">{item.text || item.message}</p>
                                                        <p className="activity-time">{item.time || item.time_ago}</p>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            {/* School Overview chart */}
                            {performanceData.length > 0 && (
                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">School Overview</h2>
                                        <p className="card-description">Key indicators (Term 2)</p>
                                    </div>
                                    <div className="card-content">
                                        <ResponsiveContainer width="100%" height={200}>
                                            <BarChart data={performanceData} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                                                <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                                                <Tooltip content={<OverviewTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                                                    <LabelList dataKey="value" position="top" formatter={v => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: 'var(--foreground)' }} />
                                                    {performanceData.map((entry, i) => (
                                                        <Cell key={i} fill={barColor(entry.value)} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                        <div className="chart-legend-row adm-legend-mt">
                                            {[['#10b981', '≥ 90% Excellent'], ['#003d7a', '75-89% Good'], ['#f59e0b', '< 75% Needs attention']].map(([color, label]) => (
                                                <div key={label} className="chart-legend-item">
                                                    <span className="chart-legend-dot-sq" style={{ background: color }} />
                                                    {label}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

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
                                        Manage Staff
                                    </button>
                                    <button className="btn btn-outline" onClick={() => navigate('/admin/announcements')}>
                                        <span className="material-symbols-rounded">announcement</span>
                                        Post Announcement
                                    </button>
                                    <button className="btn btn-outline" onClick={() => navigate('/admin/students')}>
                                        <span className="material-symbols-rounded">groups</span>
                                        View Students
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
