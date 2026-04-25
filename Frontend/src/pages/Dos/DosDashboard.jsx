import { useNavigate } from 'react-router'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Area, AreaChart } from 'recharts'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const dosStats = [
    { iconClass: '',        icon: 'people',          trend: '+15',    trendClass: 'positive', trendIcon: 'trending_up', value: '1,245', label: 'Total Students'    },
    { iconClass: 'warning', icon: 'school',          trend: '45 FT',  trendClass: 'neutral',  trendIcon: null,          value: '85',    label: 'Teaching Staff'    },
    { iconClass: 'success', icon: 'analytics',       trend: '+3%',    trendClass: 'positive', trendIcon: 'trending_up', value: '78%',   label: 'Avg Performance'   },
    { iconClass: 'danger',  icon: 'pending_actions', trend: 'Urgent', trendClass: 'negative', trendIcon: null,          value: '24',    label: 'Pending Approvals' },
]
const recentActivities = [
    { iconClass: 'success', icon: 'check_circle', title: 'S4A Results Approved', time: '2 hours ago' },
    { iconClass: 'info',    icon: 'person_add',   title: 'New Teacher Added',        time: '5 hours ago' },
    { iconClass: 'warning', icon: 'pending',      title: '3 Results Pending Review', time: '1 day ago'   },
]
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

const gradePerformance = [
    { grade: 'S1', term1: 68, term2: 71 },
    { grade: 'S2', term1: 70, term2: 73 },
    { grade: 'S3', term1: 72, term2: 75 },
    { grade: 'S4', term1: 74, term2: 78 },
    { grade: 'S5', term1: 76, term2: 80 },
    { grade: 'S6', term1: 80, term2: 85 },
]

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

function StatCard({ iconClass, icon, trend, trendClass, trendIcon, value, label }) {
    return (
        <div className="stat-card">
            <div className="stat-header">
                <div className={`stat-icon${iconClass ? ' ' + iconClass : ''}`}>
                    <span className="material-symbols-rounded">{icon}</span>
                </div>
                <span className={`stat-trend ${trendClass}`}>
                    {trendIcon && <span className="material-symbols-rounded">{trendIcon}</span>}
                    {trend}
                </span>
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
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

                        <div className="quick-stats">
                            {dosStats.map((stat) => (
                                <StatCard key={stat.label} {...stat} />
                            ))}
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
                                                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%"  stopColor="#003d7a" stopOpacity={0.2} />
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
                                <p className="card-subtitle">Term 1 vs Term 2 — average scores across all grades</p>
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
                                        <Bar dataKey="term1" name="Term 1" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                        <Bar dataKey="term2" name="Term 2" fill="#003d7a" radius={[4, 4, 0, 0]} maxBarSize={32} />
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
