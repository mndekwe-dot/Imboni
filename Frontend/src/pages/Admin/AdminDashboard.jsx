import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useCurrentTerm } from '../../hooks/useCurrentTerm'
import { WelcomeBanner, bannerRole } from '../../components/layout/WelcomeBanner'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { StatCard } from '../../components/layout/StatCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import { getAdminDashboardStats, getAdminRecentActivity } from '../../api/admin'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import { useToast } from '../../context/ToastContext'
import { partialLoad } from '../../utils/errors'

function barColor(value) {
    if (value >= 90) return 'var(--success)'
    if (value >= 75) return 'var(--primary)'
    return 'var(--warning)'
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
    approval: { icon: 'check_circle', cls: 'success' },
    staff:    { icon: 'person_add',   cls: 'info'    },
    pending:  { icon: 'pending',      cls: 'warning' },
}

/**
 * The Admin dashboard's "Recent activity" rows while they load: the same row,
 * icon square and text block as the real list (.adm-activity-*), so it is the
 * right size by construction.
 */
function SkeletonActivity({ items = 5, label }) {
    const { t } = useTranslation()
    return (
        <div aria-busy="true">
            <span className="sr-only" role="status" aria-live="polite">{label || t('common.loading')}</span>
            {Array.from({ length: items }, (_, i) => (
                <div className="adm-activity-item" key={i} aria-hidden="true">
                    <span className="skel adm-activity-icon" />
                    <div className="adm-activity-details">
                        <div className="skel skel-line" style={{ width: i % 2 ? '58%' : '74%' }} />
                        <div className="skel skel-line" style={{ width: '28%' }} />
                    </div>
                </div>
            ))}
        </div>
    )
}

export function AdminDashboard() {
    const toast = useToast()
    const { t } = useTranslation()
    const { setting } = useSchoolSettings()
    const { term } = useCurrentTerm()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const navigate = useNavigate()

    const [stats,      setStats]      = useState(null)
    const [activities, setActivities] = useState([])
    const [loading,    setLoading]    = useState(true)

    useEffect(() => {
        Promise.all([
            getAdminDashboardStats().catch(partialLoad(toast, null)),
            getAdminRecentActivity({ limit: 5 }).catch(partialLoad(toast, [])),
        ]).then(([s, a]) => {
            setStats(s)
            setActivities(Array.isArray(a) ? a : (a?.results ?? []))
        }).finally(() => setLoading(false))
    }, [toast])

    const statCards = stats ? [
        { icon: 'groups',          value: stats.total_students,    label: t('admin.dashboard.totalStudents'),    trend: t('admin.dashboard.newThisTerm', { count: stats.new_students }), trendClass: 'positive', colorClass: ''        },
        { icon: 'badge',           value: stats.teaching_staff,   label: t('admin.dashboard.teachingStaff'),    trend: t('admin.dashboard.activeTeachers'),                  trendClass: 'neutral',  colorClass: 'info'    },
        { icon: 'trending_up',     value: `${stats.avg_performance}%`, label: t('admin.dashboard.avgPerformance'), trend: t('admin.dashboard.vsPrevTerm', { value: `${stats.avg_performance_change >= 0 ? '+' : ''}${stats.avg_performance_change}` }), trendClass: stats.avg_performance_change >= 0 ? 'positive' : 'negative', colorClass: 'success' },
        { icon: 'pending_actions', value: stats.pending_approvals, label: t('admin.dashboard.pendingApprovals'), trend: t('admin.dashboard.requiresAction'),                  trendClass: stats.pending_approvals > 0 ? 'negative' : 'positive', colorClass: 'warning' },
    ] : [
        { icon: 'groups',          value: '-', label: t('admin.dashboard.totalStudents'), colorClass: ''        },
        { icon: 'badge',           value: '-', label: t('admin.dashboard.teachingStaff'), colorClass: 'info'    },
        { icon: 'trending_up',     value: '-', label: t('admin.dashboard.avgPerformance'), colorClass: 'success' },
        { icon: 'pending_actions', value: '-', label: t('admin.dashboard.pendingApprovals'), colorClass: 'warning' },
    ]

    const performanceData = stats ? [
        { label: t('admin.dashboard.schoolAvg'),    value: stats.avg_performance    || 0 },
        { label: t('admin.dashboard.attendance'),    value: stats.attendance_rate    || 0 },
    ].filter(d => d.value > 0) : []

    const firstName = adminUser.userName.split(' ').find(w => !w.startsWith('Dr') && !w.startsWith('Mr') && !w.startsWith('Mrs')) || adminUser.userName.split(' ')[0]

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('admin.dashboard.title')}
                        subtitle={term
                            ? t('admin.dashboard.subtitleWithTerm', { term: term.name, year: term.year })
                            : t('admin.dashboard.subtitle')}
                        {...adminUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <WelcomeBanner
                            name={firstName}
                            role={bannerRole(t, t('roles.principal'), setting.school_name)}
                            badge={t('roles.principalShort')}
                        />

                        {/* Quick actions sit under the greeting where they are used,
                            not in a card below the fold. */}
                        <div className="quick-actions" role="group" aria-label={t('common.quickActions')}>
                            <button className="btn btn-primary" onClick={() => navigate('/admin/staff')}>
                                <span className="material-symbols-rounded" aria-hidden="true">person_add</span>
                                {t('admin.dashboard.manageStaff')}
                            </button>
                            <button className="btn btn-outline" onClick={() => navigate('/admin/announcements')}>
                                <span className="material-symbols-rounded" aria-hidden="true">announcement</span>
                                {t('admin.dashboard.postAnnouncement')}
                            </button>
                            <button className="btn btn-outline" onClick={() => navigate('/admin/students')}>
                                <span className="material-symbols-rounded" aria-hidden="true">groups</span>
                                {t('admin.dashboard.viewStudents')}
                            </button>
                            <button className="btn btn-outline" onClick={() => navigate('/admin/reports')}>
                                <span className="material-symbols-rounded" aria-hidden="true">bar_chart</span>
                                {t('admin.dashboard.viewReports')}
                            </button>
                        </div>

                        <div className="portal-stat-grid">
                            {statCards.map((s, i) => <StatCard key={i} {...s} loading={loading && !stats} />)}
                        </div>

                        <div className="cards-grid">

                            {/* Recent Activity */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">{t('admin.dashboard.recentActivity')}</h2>
                                </div>
                                <div className="card-content">
                                    {loading ? (
                                        <SkeletonActivity />
                                    ) : activities.length === 0 ? (
                                        <EmptyState compact icon="history" title={t('admin.dashboard.noRecentActivity')} />
                                    ) : (
                                        activities.map((item, i) => {
                                            const meta = ACTIVITY_ICON[item.activity_type] || { icon: 'info', cls: 'info' }
                                            return (
                                                <div key={i} className="adm-activity-item">
                                                    <span className={`adm-activity-icon ${meta.cls}`}>
                                                        <span className="material-symbols-rounded" aria-hidden="true">{meta.icon}</span>
                                                    </span>
                                                    <div className="adm-activity-details">
                                                        <p className="adm-activity-title">{item.description}</p>
                                                        <p className="adm-activity-time">{item.time_ago}</p>
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
                                        <h2 className="card-title">{t('admin.dashboard.schoolOverview')}</h2>
                                        <p className="card-description">{t('admin.dashboard.keyIndicators', { term: term?.name || '' })}</p>
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
                                            {[['var(--success)', t('admin.dashboard.legendExcellent')], ['var(--primary)', t('admin.dashboard.legendGood')], ['var(--warning)', t('admin.dashboard.legendNeeds')]].map(([color, label]) => (
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

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
