import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'
import { getMyChildren, getChildBehaviourStats, getChildBehaviourReports } from '../../api/parent'

const toList = d => Array.isArray(d) ? d : (d?.results ?? [])
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function BehaviourStat({ cardClass, value, label, trend, trendClass, icon, iconClass }) {
    return (
        <div className={`stat-card ${cardClass}`}>
            <div className="stat-card-header">
                <div className="stat-card-body">
                    <div className="stat-card-value">{value}</div>
                    <div className="stat-card-label">{label}</div>
                    <div className={`stat-card-trend ${trendClass}`}><span>{trend}</span></div>
                </div>
                <div className={`stat-card-icon ${iconClass}`}>
                    <span className="material-symbols-rounded">{icon}</span>
                </div>
            </div>
        </div>
    )
}

function BehaviourCard({ title, reported_by_display, badge, report_type, description, date, action_taken }) {
    const type      = report_type === 'positive' || report_type === 'achievement' ? 'positive' : 'warning'
    const badgeCls  = type === 'positive' ? 'positive' : 'neutral'
    const badgeIcon = type === 'positive' ? 'sentiment_satisfied' : 'warning'
    const dateStr   = date ? new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'

    return (
        <div className={`behavior-card type-${type}`}>
            <div className="behavior-header">
                <div>
                    <h4>{title}</h4>
                    <p>{reported_by_display}</p>
                </div>
                <span className={`behavior-badge ${badgeCls}`}>
                    <span className="behaviour-icon material-symbols-rounded">{badgeIcon}</span>
                    {badge}
                </span>
            </div>
            <p className="behavior-description">{description}</p>
            <div className="behavior-meta">
                <div className="behavior-meta-item">
                    <span className="behavior-meta-label">Date</span>
                    <span className="behavior-meta-value">{dateStr}</span>
                </div>
                {action_taken && (
                    <div className="behavior-meta-item">
                        <span className="behavior-meta-label">Action Taken</span>
                        <span className="behavior-meta-value">{action_taken}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

const FILTERS = ['all', 'positive', 'achievement', 'warning', 'incident']

export function ParentBehaviour() {
    const [children,    setChildren]    = useState([])
    const [activeIdx,   setActiveIdx]   = useState(0)
    const [loading,     setLoading]     = useState(true)
    const [stats,       setStats]       = useState(null)
    const [reports,     setReports]     = useState([])
    const [loadingData, setLoadingData] = useState(false)
    const [filter,      setFilter]      = useState('all')

    useEffect(() => {
        getMyChildren()
            .then(d => setChildren(toList(d)))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (!children.length) return
        const child = children[activeIdx]
        if (!child) return
        setLoadingData(true)
        setStats(null)
        setReports([])
        setFilter('all')
        Promise.all([
            getChildBehaviourStats(child.id).catch(() => null),
            getChildBehaviourReports(child.id).catch(() => []),
        ]).then(([s, r]) => {
            setStats(s)
            setReports(toList(r))
        }).finally(() => setLoadingData(false))
    }, [children, activeIdx])

    const child = children[activeIdx]

    const statCards = stats ? [
        { cardClass: 'success', value: stats.positive_reports, label: 'Positive Reports', trend: 'This term',      trendClass: '',   icon: 'thumb_up',     iconClass: 'success' },
        { cardClass: 'warning', value: stats.warnings,          label: 'Warnings',         trend: 'Minor incidents', trendClass: '',   icon: 'warning',      iconClass: 'warning' },
        { cardClass: 'info',    value: stats.conduct_grade || '—', label: 'Conduct Grade', trend: stats.conduct_label || '', trendClass: 'up', icon: 'grade', iconClass: 'info' },
        { cardClass: 'success', value: stats.achievements,      label: 'Achievements',     trend: 'Awards earned',   trendClass: 'up', icon: 'emoji_events', iconClass: 'success' },
    ] : []

    const visible = filter === 'all'
        ? reports
        : reports.filter(r => r.report_type === filter)

    const positive = reports.filter(r => r.report_type === 'positive' || r.report_type === 'achievement')
    const warning  = reports.filter(r => r.report_type === 'warning' || r.report_type === 'incident')

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Behavior Reports"
                        subtitle="Track your child's conduct and achievements"
                        {...parentUser}
                    />

                    {!loading && children.length > 0 && (
                        <div className="child-switcher-bar">
                            <span className="child-switcher-label">Child:</span>
                            {children.map((c, i) => (
                                <button key={c.id}
                                    className={`child-tab${i === activeIdx ? ' active' : ''}`}
                                    onClick={() => setActiveIdx(i)}>
                                    <div className="child-tab-avatar amina">{initials(c.student_name)}</div>
                                    <span className="child-tab-name">{c.student_name}</span>
                                    <span className="child-tab-grade">&middot; {c.grade}{c.section}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <DashboardContent>
                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading…</p>
                        ) : !child ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>No children linked.</p>
                        ) : (
                            <>
                                {/* Conduct hero */}
                                {stats && (
                                    <div className="conduct-hero">
                                        <div className="conduct-hero-left">
                                            <div className="conduct-hero-avatar amina">{initials(child.student_name)}</div>
                                            <div>
                                                <p className="conduct-hero-name">{child.student_name}</p>
                                                <p className="conduct-hero-sub">{child.grade}{child.section} &nbsp;&middot;&nbsp; This Term</p>
                                            </div>
                                        </div>
                                        <div className="conduct-hero-stats">
                                            <div className="conduct-stat"><span className="label">Conduct</span><span className="value grade-a">{stats.conduct_grade || '—'}</span></div>
                                            <div className="conduct-stat"><span className="label">Positive</span><span className="value">{stats.positive_reports}</span></div>
                                            <div className="conduct-stat"><span className="label">Warnings</span><span className="value">{stats.warnings}</span></div>
                                            <div className="conduct-stat"><span className="label">Awards</span><span className="value">{stats.achievements}</span></div>
                                        </div>
                                    </div>
                                )}

                                {/* Stat cards */}
                                {statCards.length > 0 && (
                                    <div className="quick-stats-grid">
                                        {statCards.map((s, i) => <BehaviourStat key={i} {...s} />)}
                                    </div>
                                )}

                                {/* Reports */}
                                <div className="card mt-1-5">
                                    <div className="card-header">
                                        <h3 className="card-title">Recent Reports</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="behavior-filter-bar">
                                            <button className={`behavior-filter-btn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
                                                All <span className="count-badge">{reports.length}</span>
                                            </button>
                                            <button className={`behavior-filter-btn${filter === 'positive' ? ' active' : ''}`} onClick={() => setFilter('positive')}>
                                                <span className="material-symbols-rounded icon-14">thumb_up</span>
                                                Positive <span className="count-badge">{positive.length}</span>
                                            </button>
                                            <button className={`behavior-filter-btn${filter === 'warning' ? ' active' : ''}`} onClick={() => setFilter('warning')}>
                                                <span className="material-symbols-rounded icon-14">warning</span>
                                                Warnings <span className="count-badge">{warning.length}</span>
                                            </button>
                                        </div>
                                        {loadingData ? (
                                            <p style={{ color: 'var(--muted-foreground)', marginTop: '1rem' }}>Loading…</p>
                                        ) : visible.length === 0 ? (
                                            <p style={{ color: 'var(--muted-foreground)', marginTop: '1rem' }}>No reports found.</p>
                                        ) : (
                                            <div className="behavior-grid">
                                                {visible.map((r, i) => <BehaviourCard key={r.id || i} {...r} />)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
