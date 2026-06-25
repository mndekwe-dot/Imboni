import { useState, useEffect } from 'react'
import { getDosAnalytics } from '../../api/dos'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

function GradeRow({ grade, score }) {
    const pct = `${score}%`
    return (
        <div className="perf-row">
            <div className="perf-row-header"><span>{grade}</span><strong>{pct}</strong></div>
            <div className="progress"><div className="progress-bar" style={{ width: pct }} /></div>
        </div>
    )
}

function SubjectRow({ subject, avg_score }) {
    const pct = `${avg_score}%`
    const barColor = avg_score >= 75 ? 'var(--success)' : 'var(--warning)'
    return (
        <div className="perf-row">
            <div className="perf-row-header"><span>{subject}</span><strong>{pct}</strong></div>
            <div className="progress"><div className="progress-bar" style={{ width: pct, background: barColor }} /></div>
        </div>
    )
}

export function DosAnalytics() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [data,    setData]    = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)

    useEffect(() => {
        getDosAnalytics()
            .then(d => setData(d))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    const stats = data ? [
        {
            icon: 'trending_up', colorClass: '',
            value: `${data.stats.overall_avg}%`,
            label: 'Overall Performance',
            trend: data.stats.overall_avg > 0 ? 'Current term avg' : 'No data yet',
            trendClass: data.stats.overall_avg >= 70 ? 'positive' : 'negative',
        },
        {
            icon: 'check_circle', colorClass: 'success',
            value: `${data.stats.attendance_rate}%`,
            label: 'Attendance Rate',
            trend: data.stats.attendance_rate >= 90 ? 'Above target' : 'Below target',
            trendClass: data.stats.attendance_rate >= 90 ? 'positive' : 'negative',
        },
        {
            icon: 'groups', colorClass: 'warning',
            value: data.stats.ratio,
            label: 'Teacher-Student Ratio',
            trend: 'Current enrolment',
            trendClass: '',
        },
        {
            icon: 'emoji_events', colorClass: 'info',
            value: data.stats.top_performers,
            label: 'Top Performers',
            trend: 'Score ≥ 80%',
            trendClass: 'positive',
        },
    ] : []

    if (loading) return <p style={{ padding: '2rem' }}>Loading analytics…</p>
    if (error)   return <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="School Analytics"
                        subtitle="Comprehensive school performance insights"
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>
                        <div className="portal-stat-grid">
                            {stats.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="analytics-grid">
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Performance by Grade</h3>
                                </div>
                                <div className="card-content">
                                    {data.grade_performance.length === 0
                                        ? <p style={{ color: 'var(--muted-foreground)', fontSize: '.85rem' }}>No approved results yet.</p>
                                        : (
                                            <div className="perf-list">
                                                {data.grade_performance.map((row, i) => (
                                                    <GradeRow key={i} {...row} />
                                                ))}
                                            </div>
                                        )
                                    }
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Subject Performance</h3>
                                </div>
                                <div className="card-content">
                                    {data.subject_averages.length === 0
                                        ? <p style={{ color: 'var(--muted-foreground)', fontSize: '.85rem' }}>No approved results yet.</p>
                                        : (
                                            <div className="perf-list">
                                                {data.subject_averages.map((row, i) => (
                                                    <SubjectRow key={i} {...row} />
                                                ))}
                                            </div>
                                        )
                                    }
                                </div>
                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
