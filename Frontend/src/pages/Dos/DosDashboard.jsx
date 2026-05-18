import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { getDosDashboardStats, getDosRecentActivity, getDosPerformanceByGrade } from '../../api/dos'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Area, AreaChart } from 'recharts'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

const weeklyTrend = [
    { week: 'Wk 1', attendance: 92, performance: 74 },
    { week: 'Wk 2', attendance: 94, performance: 76 },
    { week: 'Wk 3', attendance: 91, performance: 75 },
    { week: 'Wk 4', attendance: 96, performance: 78 },
    { week: 'Wk 5', attendance: 93, performance: 79 },
    { week: 'Wk 6', attendance: 95, performance: 80 },
    { week: 'Wk 7', attendance: 94, performance: 82 },
    { week: 'Wk 8', attendance: 97, performance: 83 },
]

function TrendTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip-label">{label}</div>
            {payload.map(p => (
                <div key={p.name} className="chart-tooltip-item">
                    <span className="chart-tooltip-dot-ln" style={{ background: p.color }} />
                    <span className="chart-tooltip-key">{p.name}:</span>
                    <span className="chart-tooltip-val">{p.value}%</span>
                </div>
            ))}
        </div>
    )
}

function GradeTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    const up = payload.length === 2 && payload[1].value >= payload[0].value
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip-label">{label}</div>
            {payload.map(p => (
                <div key={p.name} className="chart-tooltip-item">
                    <span className="chart-tooltip-dot-sq" style={{ background: p.fill }} />
                    <span className="chart-tooltip-key">{p.name}:</span>
                    <span className="chart-tooltip-val">{p.value}%</span>
                </div>
            ))}
            {payload.length === 2 && (
                <div className={up ? 'chart-tooltip-compare-up' : 'chart-tooltip-compare-down'}>
                    {up ? '▲' : '▼'} {Math.abs(payload[1].value - payload[0].value)}% vs Term 1
                </div>
            )}
        </div>
    )
}

function ActivityItem({ iconClass, icon, title, time }) {
    return (
        <div className="activity-item">
            <span className={`activity-icon ${iconClass}`}>
                <span className="material-symbols-rounded">{icon}</span>
            </span>
            <div className="activity-details">
                <p className="activity-title">{title}</p>
                <p className="activity-time">{time}</p>
            </div>
        </div>
    )
}

function ProgressItem({ label, value, width }) {
    return (
        <div className="progress-item">
            <div className="progress-label">
                <span>{label}</span>
                <span className="progress-value">{value}</span>
            </div>
            <div className="progress-bar">
                <div className="progress-fill" style={{ width }}></div>
            </div>
        </div>
    )
}

export function DosDashboard() {
    const navigate = useNavigate()

    const [stats, setStats] = useState(null)
    const [activities, setActivities] = useState([])
    const [gradeData, setGradeData] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        Promise.all([
            getDosDashboardStats(),
            getDosRecentActivity(),
            getDosPerformanceByGrade(),
        ])
            .then(([s, a, g]) => {
                setStats(s)
                setActivities(a)
                setGradeData(g)
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))

    }, [])

    const dosStats = stats ? [
        { icon: 'people', value: stats.total_students, label: 'Total Students', trend: `+${stats.new_students} this term`, trendClass: 'positive', colorClass: '' },
        { icon: 'school', value: stats.teaching_staff, label: 'Teaching Staff', trend: 'active teachers', trendClass: '', colorClass: 'warning' },
        { icon: 'analytics', value: `${stats.avg_performance}%`, label: 'Avg Performance', trend: `${stats.avg_performance_change >= 0 ? '+' : ''}${stats.avg_performance_change}% this term`, trendClass: stats.avg_performance_change >= 0 ? 'positive' : 'negative', colorClass: 'success' },
        { icon: 'pending_actions', value: stats.pending_approvals, label: 'Pending Approvals', trend: 'Requires action', trendClass: 'negative', colorClass: 'warning' },
    ] : []

    const iconMap = {
        approval: { iconClass: 'success', icon: 'check_circle' },
        staff: { iconClass: 'info', icon: 'person_add' },
        pending: { iconClass: 'warning', icon: 'pending' },
    }

    const recentActivities = activities.map(a => ({
        iconClass: iconMap[a.activity_type]?.iconClass || 'info',
        icon: iconMap[a.activity_type]?.icon || 'info',
        title: a.description,
        time: a.time_ago,
    }))

    const gradePerformance = gradeData

    if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>
    if (error) return <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="DOS Dashboard"
                        subtitle="Welcome back, Dr. Ndagijimana"
                        userRole="DOS"
                        userName="Dr. Jean-Claude Ndagijimana"
                        userRoleLabel="Director of Studies"
                        initials="JN"
                        notifications={dosUser.notifications}
                    />

                    <DashboardContent>
                        <WelcomeBanner
                            name="Dr. Ndagijimana"
                            role="Director of Studies &bull; Imboni Academy"
                        />

                        <div className="portal-stat-grid">
                            {dosStats.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        {/* One container for all three cards */}
                        <div className="overview-panel">
                            <div className="overview-panel-header">
                                <span className="overview-panel-title">Overview</span>
                            </div>

                            <div className="cards-grid overview-panel-body">
                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">Quick Actions</h2>
                                    </div>
                                    <div className="card-content">
                                        <div className="action-buttons">
                                            <button className="btn btn-primary" onClick={() => navigate('/dos/results')}>
                                                <span className="material-symbols-rounded">fact_check</span>
                                                Approve Results
                                            </button>
                                            <button className="btn btn-secondary" onClick={() => navigate('/dos/teachers')}>
                                                <span className="material-symbols-rounded">school</span>
                                                View Teachers
                                            </button>
                                            <button className="btn btn-secondary" onClick={() => navigate('/dos/students')}>
                                                <span className="material-symbols-rounded">people</span>
                                                Manage Students
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">Recent Activity</h2>
                                    </div>
                                    <div className="card-content">
                                        <div className="activity-list">
                                            {recentActivities.map((item) => (
                                                <ActivityItem key={item.title} {...item} />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">Term Trend</h2>
                                        <p className="card-subtitle">Weekly attendance & performance</p>
                                    </div>
                                    <div className="card-content">
                                        <ResponsiveContainer width="100%" height={185}>
                                            <AreaChart
                                                data={weeklyTrend}
                                                margin={{ top: 6, right: 6, left: -22, bottom: 0 }}
                                            >
                                                <defs>
                                                    <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#003d7a" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#003d7a" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                <XAxis
                                                    dataKey="week"
                                                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    domain={[65, 100]}
                                                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tickFormatter={v => `${v}%`}
                                                />
                                                <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                                                <Area
                                                    type="monotone"
                                                    dataKey="attendance"
                                                    name="Attendance"
                                                    stroke="#10b981"
                                                    strokeWidth={2}
                                                    fill="url(#attGrad)"
                                                    dot={false}
                                                    activeDot={{ r: 4 }}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="performance"
                                                    name="Performance"
                                                    stroke="#003d7a"
                                                    strokeWidth={2}
                                                    fill="url(#perfGrad)"
                                                    dot={false}
                                                    activeDot={{ r: 4 }}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                        <div className="chart-legend-row">
                                            {[['#10b981', 'Attendance'], ['#003d7a', 'Performance']].map(([color, label]) => (
                                                <div key={label} className="chart-legend-item">
                                                    <span className="chart-legend-dot" style={{ background: color }} />
                                                    {label}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>{/* end outer container */}

                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Performance by Grade</h2>
                                <p className="card-subtitle">Average score per grade — current term</p>
                            </div>
                            <div className="card-content">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart
                                        data={gradePerformance}
                                        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                                        barGap={4}
                                        barCategoryGap="28%"
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                        <XAxis
                                            dataKey="grade"
                                            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            domain={[55, 100]}
                                            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={v => `${v}%`}
                                        />
                                        <Tooltip content={<GradeTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                        <Legend
                                            iconType="square"
                                            iconSize={10}
                                            wrapperStyle={{ fontSize: '0.78rem', paddingTop: '0.75rem' }}
                                        />
                                        <Bar dataKey="avg_score" name="Avg Score" fill="#003d7a" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
