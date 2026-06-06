import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'
import {
    getMyChildren, getChildDashboard,
    getChildAssessments, getChildSummative,
} from '../../api/parent'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'

const ASSESSMENT_ICON = {
    quiz:          { iconClass: 'quiz',  icon: 'quiz'        },
    class_test:    { iconClass: 'quiz',  icon: 'quiz'        },
    group_project: { iconClass: 'group', icon: 'groups'      },
    homework:      { iconClass: 'quiz',  icon: 'history_edu' },
    assignment:    { iconClass: 'quiz',  icon: 'history_edu' },
    essay:         { iconClass: 'quiz',  icon: 'history_edu' },
}

function gradeClass(g) {
    if (g === 'A') return 'text-success'
    if (g === 'B') return 'text-primary'
    if (g === 'C') return 'text-warning'
    return 'text-danger'
}

function gradeBadge(g) {
    if (g === 'A') return 'badge-success'
    if (g === 'B') return 'badge-primary'
    return 'badge-warning'
}

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function AssessmentItem({ title, assessment_type, date, score_display, grade }) {
    const { iconClass, icon } = ASSESSMENT_ICON[assessment_type] || { iconClass: 'quiz', icon: 'assignment' }
    const typeLabel = (assessment_type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
    return (
        <div className="assessment-item">
            <div className={`assessment-icon ${iconClass}`}>
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div className="assessment-info">
                <p className="font-bold">{title}</p>
                <p className="text-xs text-muted">{typeLabel}{dateStr ? ` · ${dateStr}` : ''}</p>
            </div>
            <div className={`assessment-score ${gradeClass(grade)}`}>{score_display}</div>
        </div>
    )
}

function ResultRow({ subject_name, grade, final_score, total_maximum }) {
    const score = total_maximum ? `${Math.round(final_score)}/${total_maximum}` : `${Math.round(final_score)}`
    return (
        <tr>
            <td className="subject-name">{subject_name}</td>
            <td className="type-submission">Term Result</td>
            <td>{score}</td>
            <td><span className={`badge ${gradeBadge(grade)}`}>{grade}</span></td>
        </tr>
    )
}

function ChildStats({ stats, loading }) {
    const perf   = stats?.overall_performance?.percentage
    const att    = stats?.attendance
    const ann    = stats?.announcements
    const beh    = stats?.behaviour

    const cards = [
        {
            icon: 'trending_up',
            value: loading ? '—' : perf != null ? `${perf}%` : '—',
            label: 'Overall Performance',
            trend: perf != null ? (perf >= 70 ? 'Above average' : 'Below average') : 'No data yet',
            trendClass: perf != null && perf >= 70 ? 'positive' : '',
            colorClass: 'success',
        },
        {
            icon: 'event_available',
            value: loading ? '—' : att ? `${att.percentage}%` : '—',
            label: 'Attendance Rate',
            trend: att ? `${att.present_days} present, ${att.absent_days} absent` : 'No records yet',
            trendClass: '',
            colorClass: '',
        },
        {
            icon: 'campaign',
            value: loading ? '—' : ann != null ? ann.unread_count : '—',
            label: 'Unread Announcements',
            trend: ann ? `${ann.urgent_count} urgent` : '',
            trendClass: ann?.urgent_count > 0 ? 'negative' : '',
            colorClass: 'warning',
        },
        {
            icon: 'shield_person',
            value: loading ? '—' : beh != null ? beh.positive_count : '—',
            label: 'Positive Reports',
            trend: 'This term',
            trendClass: 'positive',
            colorClass: 'warning',
        },
    ]

    return (
        <div className="portal-stat-grid">
            {cards.map((c, i) => <StatCard key={i} {...c} />)}
        </div>
    )
}

export function ParentDashboard() {
    const [children,         setChildren]         = useState([])
    const [activeIdx,        setActiveIdx]        = useState(0)
    const [loadingChildren,  setLoadingChildren]  = useState(true)
    const [stats,            setStats]            = useState(null)
    const [loadingStats,     setLoadingStats]     = useState(false)
    const [assessments,      setAssessments]      = useState([])
    const [summative,        setSummative]        = useState([])
    const [loadingData,      setLoadingData]      = useState(false)

    useEffect(() => {
        getMyChildren()
            .then(data => setChildren(Array.isArray(data) ? data : (data?.results ?? [])))
            .catch(console.error)
            .finally(() => setLoadingChildren(false))
    }, [])

    useEffect(() => {
        if (!children.length) return
        const child = children[activeIdx]
        if (!child) return
        setLoadingStats(true)
        setLoadingData(true)
        setStats(null)
        setAssessments([])
        setSummative([])

        getChildDashboard(child.id)
            .then(setStats)
            .catch(console.error)
            .finally(() => setLoadingStats(false))

        Promise.all([
            getChildAssessments(child.id).catch(() => []),
            getChildSummative(child.id).catch(() => []),
        ]).then(([a, s]) => {
            setAssessments(Array.isArray(a) ? a : (a?.results ?? []))
            setSummative(Array.isArray(s) ? s : (s?.results ?? []))
        }).finally(() => setLoadingData(false))
    }, [children, activeIdx])

    const child = children[activeIdx]

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Parent Dashboard"
                        subtitle="Here's what's happening with your children"
                        {...parentUser}
                    />

                    <DashboardContent>
                        {loadingChildren ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading…</p>
                        ) : children.length === 0 ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>No children linked to your account yet.</p>
                        ) : (
                            <div className="tabs">
                                <div className="tabs-list">
                                    {children.map((c, i) => (
                                        <button key={c.id}
                                            className={`tabs-trigger${i === activeIdx ? ' active' : ''}`}
                                            onClick={() => setActiveIdx(i)}>
                                            <div className="tabs-trigger-avatar">{initials(c.student_name)}</div>
                                            <span>{c.student_name}</span>
                                            <span className="badge badge-secondary select-xs">{c.grade}{c.section}</span>
                                        </button>
                                    ))}
                                </div>

                                {child && (
                                    <div className="tabs-content active">
                                        <ChildStats stats={stats} loading={loadingStats} />

                                        {/* Recent Assessments */}
                                        <div className="card">
                                            <div className="card-header">
                                                <h3 className="card-title">Recent Assessments &amp; Projects</h3>
                                                <span className="badge badge-secondary">This Term</span>
                                            </div>
                                            <div className="card-content">
                                                {loadingData ? (
                                                    <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
                                                ) : assessments.length === 0 ? (
                                                    <p style={{ color: 'var(--muted-foreground)' }}>No assessments recorded yet.</p>
                                                ) : (
                                                    <div className="assessment-list">
                                                        {assessments.slice(0, 4).map(a => (
                                                            <AssessmentItem key={a.id} {...a} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Recent Results */}
                                        {summative.length > 0 && (
                                            <div className="dashboard-content-grid">
                                                <div className="dashboard-content-grid-card">
                                                    <div className="card-header">
                                                        <h3 className="card-title">Recent Results</h3>
                                                    </div>
                                                    <div className="card-content">
                                                        <table>
                                                            <thead>
                                                                <tr>
                                                                    <th>Subject</th>
                                                                    <th>Type</th>
                                                                    <th>Score</th>
                                                                    <th>Grade</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {summative.slice(0, 5).map(r => (
                                                                    <ResultRow key={r.id} {...r} />
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
