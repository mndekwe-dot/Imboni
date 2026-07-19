import { useState, useEffect } from 'react'
import { getDosAnalytics, getAtRiskStudents, getChronicAbsence } from '../../api/dos'
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

// Merge low-average and chronic-absence lists into one row per student with reason chips
function buildAttentionList(atRisk, chronic) {
    const byCode = new Map()
    for (const s of atRisk) {
        byCode.set(s.student_code, {
            student_name: s.student_name,
            student_code: s.student_code,
            grade: s.grade,
            reasons: [{ type: 'score', label: `Avg ${s.average_score}% · ${s.subjects_failing} failing` }],
        })
    }
    for (const s of chronic) {
        const existing = byCode.get(s.student_code)
        const reason = { type: 'absence', label: `Attendance ${s.attendance_rate}% · ${s.days_absent} days absent` }
        if (existing) existing.reasons.push(reason)
        else byCode.set(s.student_code, {
            student_name: s.student_name,
            student_code: s.student_code,
            grade: s.grade,
            reasons: [reason],
        })
    }
    // Students flagged for both reasons first
    return [...byCode.values()].sort((a, b) => b.reasons.length - a.reasons.length)
}

export function DosAnalytics() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [data,    setData]    = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)
    const [attention, setAttention] = useState([])

    useEffect(() => {
        getDosAnalytics()
            .then(d => setData(d))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
        Promise.all([
            getAtRiskStudents().catch(() => []),
            getChronicAbsence().catch(() => []),
        ]).then(([atRisk, chronic]) => {
            setAttention(buildAttentionList(
                Array.isArray(atRisk) ? atRisk : [],
                Array.isArray(chronic) ? chronic : [],
            ))
        })
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

    if (loading) return <p className="u-pad">Loading analytics…</p>
    if (error)   return <p className="u-pad dos-danger-text">Error: {error}</p>

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
                                        ? <p className="dos-empty-hint">No approved results yet.</p>
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
                                        ? <p className="dos-empty-hint">No approved results yet.</p>
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

                        <div className="card u-mt">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded dos-attention-flag-icon">flag</span>
                                    Students Needing Attention
                                </h3>
                                <span className="badge">{attention.length}</span>
                            </div>
                            <div className="card-content">
                                {attention.length === 0 ? (
                                    <p className="dos-empty-hint">
                                        No students flagged: averages are above 50% and attendance above 80%.
                                    </p>
                                ) : (
                                    <div className="dos-attention-list">
                                        {attention.map(s => (
                                            <div key={s.student_code} className="dos-attention-row">
                                                <div className="dos-attention-name-col">
                                                    <div className="u-strong u-sm">{s.student_name}</div>
                                                    <div className="dos-attention-code">
                                                        {s.student_code} · S{s.grade}
                                                    </div>
                                                </div>
                                                <div className="dos-attention-reasons">
                                                    {s.reasons.map((r, i) => (
                                                        <span key={i} className={`dos-reason-chip ${r.type}`}>
                                                            <span className="material-symbols-rounded dos-reason-chip-icon">
                                                                {r.type === 'score' ? 'trending_down' : 'event_busy'}
                                                            </span>
                                                            {r.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
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
