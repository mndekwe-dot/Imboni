import { useState, useEffect } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
    LineChart, Line, AreaChart, Area, PieChart, Pie, Legend,
} from 'recharts'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import {
    getAdminDashboardStats,
    getPerformanceByGrade,
    getWeeklyTrend,
    getEnrollmentByGrade,
    getPerformanceDistribution,
    getTeachersBySubject,
} from '../../api/admin'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'

const GRADE_COLORS = ['#003d7a', '#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#f97316']
const PIE_COLORS   = { Excellent: '#10b981', Good: '#003d7a', Average: '#f59e0b', 'Below Average': '#dc2626' }

function ChartCard({ title, desc, children, loading }) {
    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">{title}</h2>
                {desc && <p className="card-description">{desc}</p>}
            </div>
            <div className="card-content">
                {loading ? (
                    <div className="adm-chart-loading">
                        Loading…
                    </div>
                ) : children}
            </div>
        </div>
    )
}

function GradePerformanceChart({ data }) {
    if (!data?.length) return <p className="adm-chart-nodata">No data available.</p>
    return (
        <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="grade" tickFormatter={v => `S${v}`} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v) => [`${v}%`, 'Avg Score']} />
                <Bar dataKey="avg_score" radius={[6, 6, 0, 0]} maxBarSize={52}>
                    <LabelList dataKey="avg_score" position="top" formatter={v => `${v}%`} style={{ fontSize: 10, fontWeight: 700, fill: 'var(--foreground)' }} />
                    {data.map((_, i) => <Cell key={i} fill={GRADE_COLORS[i % GRADE_COLORS.length]} />)}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    )
}

function WeeklyTrendChart({ data }) {
    if (!data?.length) return <p className="adm-chart-nodata">No data available.</p>
    return (
        <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                <defs>
                    <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#003d7a" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#003d7a" stopOpacity={0}    />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v, name) => [`${v}%`, name === 'attendance' ? 'Attendance' : 'Performance']} />
                <Legend formatter={v => v === 'attendance' ? 'Attendance' : 'Performance'} iconSize={8} wrapperStyle={{ fontSize: '0.75rem' }} />
                <Area type="monotone" dataKey="attendance"  stroke="#10b981" fill="url(#attGrad)"  strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="performance" stroke="#003d7a" fill="url(#perfGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
        </ResponsiveContainer>
    )
}

function EnrollmentChart({ data }) {
    if (!data?.length) return <p className="adm-chart-nodata">No data available.</p>
    return (
        <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="grade" tickFormatter={v => `S${v}`} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={24} />
                <Tooltip formatter={(v) => [v, 'Students']} />
                <Bar dataKey="student_count" radius={[0, 6, 6, 0]} maxBarSize={24}>
                    <LabelList dataKey="student_count" position="right" style={{ fontSize: 10, fontWeight: 600, fill: 'var(--foreground)' }} />
                    {data.map((_, i) => <Cell key={i} fill={GRADE_COLORS[i % GRADE_COLORS.length]} />)}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    )
}

function DistributionChart({ data }) {
    if (!data?.length) return <p className="adm-chart-nodata">No data available.</p>
    return (
        <div className="adm-dist-row">
            <ResponsiveContainer width={180} height={180}>
                <PieChart>
                    <Pie data={data} dataKey="percentage" nameKey="category" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {data.map((entry, i) => (
                            <Cell key={i} fill={PIE_COLORS[entry.category] || GRADE_COLORS[i]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v}%`, '']} />
                </PieChart>
            </ResponsiveContainer>
            <div className="adm-dist-legend">
                {data.map((entry, i) => (
                    <div key={i} className="adm-dist-item">
                        <span className="adm-dist-dot" style={{ background: PIE_COLORS[entry.category] || GRADE_COLORS[i] }} />
                        <span className="adm-dist-name">{entry.category}</span>
                        <span className="u-bold">{entry.percentage}%</span>
                        <span className="u-muted">({entry.count} students)</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function SubjectChart({ data }) {
    if (!data?.length) return <p className="adm-chart-nodata">No data available.</p>
    const top = data.slice(0, 8)
    return (
        <ResponsiveContainer width="100%" height={Math.max(180, top.length * 36)}>
            <BarChart data={top} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="subject_name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip formatter={(v) => [v, 'Teachers']} />
                <Bar dataKey="teacher_count" fill="#003d7a" radius={[0, 6, 6, 0]} maxBarSize={22}>
                    <LabelList dataKey="teacher_count" position="right" style={{ fontSize: 10, fontWeight: 600, fill: 'var(--foreground)' }} />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    )
}

export function AdminReports() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [stats,       setStats]       = useState(null)
    const [byGrade,     setByGrade]     = useState([])
    const [weeklyTrend, setWeeklyTrend] = useState([])
    const [enrollment,  setEnrollment]  = useState([])
    const [distribution,setDistribution]= useState([])
    const [bySubject,   setBySubject]   = useState([])
    const [loading,     setLoading]     = useState(true)

    useEffect(() => {
        Promise.all([
            getAdminDashboardStats().catch(() => null),
            getPerformanceByGrade().catch(() => []),
            getWeeklyTrend().catch(() => []),
            getEnrollmentByGrade().catch(() => []),
            getPerformanceDistribution().catch(() => []),
            getTeachersBySubject().catch(() => []),
        ]).then(([s, grade, weekly, enroll, dist, subject]) => {
            setStats(s)
            setByGrade(Array.isArray(grade) ? grade : (grade?.results ?? []))
            setWeeklyTrend(Array.isArray(weekly) ? weekly : (weekly?.results ?? []))
            setEnrollment(Array.isArray(enroll) ? enroll : (enroll?.results ?? []))
            setDistribution(Array.isArray(dist) ? dist : (dist?.results ?? []))
            setBySubject(Array.isArray(subject) ? subject : (subject?.results ?? []))
        }).finally(() => setLoading(false))
    }, [])

    const statCards = stats ? [
        { icon: 'groups',       value: stats.total_students    || 0,     label: 'Total Students',   trend: `+${stats.new_students || 0} this term`, colorClass: ''        },
        { icon: 'trending_up',  value: `${stats.avg_performance || 0}%`, label: 'Avg Performance',  trend: stats.avg_performance_change >= 0 ? `+${stats.avg_performance_change}% vs last term` : `${stats.avg_performance_change}% vs last term`, colorClass: 'success' },
        { icon: 'badge',        value: stats.teaching_staff    || 0,     label: 'Teaching Staff',   trend: 'Active',                                colorClass: 'info'    },
        { icon: 'pending_actions', value: stats.pending_approvals || 0,  label: 'Pending Approvals',trend: 'Awaiting review',                       colorClass: 'warning' },
    ] : [
        { icon: 'groups',       value: '—', label: 'Total Students',    trend: 'Loading…', colorClass: ''        },
        { icon: 'trending_up',  value: '—', label: 'Avg Performance',   trend: 'Loading…', colorClass: 'success' },
        { icon: 'badge',        value: '—', label: 'Teaching Staff',    trend: 'Loading…', colorClass: 'info'    },
        { icon: 'pending_actions', value: '—', label: 'Pending Approvals', trend: 'Loading…', colorClass: 'warning' },
    ]

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Reports & Analytics"
                        subtitle="School-wide performance, attendance and enrollment insights"
                        {...adminUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <div className="portal-stat-grid">
                            {statCards.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        {/* Row 1: Performance by grade + Weekly trend */}
                        <div className="cards-grid">
                            <ChartCard title="Performance by Grade" desc="Average score per year group" loading={loading}>
                                <GradePerformanceChart data={byGrade} />
                            </ChartCard>
                            <ChartCard title="Weekly Trend" desc="Attendance vs performance over 8 weeks" loading={loading}>
                                <WeeklyTrendChart data={weeklyTrend} />
                            </ChartCard>
                        </div>

                        {/* Row 2: Enrollment + Performance distribution */}
                        <div className="cards-grid">
                            <ChartCard title="Enrollment by Class" desc="Number of students per year group" loading={loading}>
                                <EnrollmentChart data={enrollment} />
                            </ChartCard>
                            <ChartCard title="Performance Distribution" desc="Students by performance band" loading={loading}>
                                <DistributionChart data={distribution} />
                            </ChartCard>
                        </div>

                        {/* Row 3: Teachers by subject (full width) */}
                        <ChartCard title="Teachers by Subject" desc="Number of teachers assigned per subject" loading={loading}>
                            <SubjectChart data={bySubject} />
                        </ChartCard>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
