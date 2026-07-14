import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { parentNavItems, parentSecondaryItems } from './parentNav'
import {
    getPublishedAnnouncements, getAnnouncementStats,
    markAnnouncementRead, markAllAnnouncementsRead,
} from '../../api/parent'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'

const CATEGORY_COLOR = {
    urgent:   { bg: '#fef2f2', border: '#ef4444', badge: '#fee2e2', text: '#dc2626', icon: 'priority_high'  },
    academic: { bg: '#eff6ff', border: '#3b82f6', badge: '#dbeafe', text: '#2563eb', icon: 'school'         },
    event:    { bg: '#f5f3ff', border: '#8b5cf6', badge: '#ede9fe', text: '#7c3aed', icon: 'emoji_events'   },
    general:  { bg: '#f8fafc', border: '#64748b', badge: '#e2e8f0', text: '#475569', icon: 'campaign'       },
}

const AUDIENCE_LABEL = {
    all:            'School-wide',
    students:       'Students',
    teachers:       'Teachers',
    parents:        'Parents',
    grade_specific: '',
}

const CHIPS = [
    { key: 'All',      label: 'All'      },
    { key: 'Urgent',   label: 'Urgent'   },
    { key: 'Academic', label: 'Academic' },
    { key: 'Events',   label: 'Events'   },
    { key: 'General',  label: 'General'  },
]

function chipMatch(ann, chip) {
    if (chip === 'All')      return true
    if (chip === 'Urgent')   return ann.category === 'urgent'
    if (chip === 'Academic') return ann.category === 'academic'
    if (chip === 'Events')   return ann.category === 'event'
    if (chip === 'General')  return ann.category === 'general'
    return true
}

function relDate(dateStr) {
    if (!dateStr) return ''
    const d     = new Date(dateStr)
    const now   = new Date()
    const diff  = Math.floor((now - d) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff < 7)  return `${diff}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatBox({ icon, value, label, color }) {
    return (
        <div className="pann-stat" style={{ '--stat-color': color, '--stat-bg': color + '18' }}>
            <div className="pann-stat-icon">
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div>
                <div className="pann-stat-value">{value}</div>
                <div className="pann-stat-label">{label}</div>
            </div>
        </div>
    )
}

function AnnouncementCard({ ann, onMarkRead }) {
    const cat     = CATEGORY_COLOR[ann.category] || CATEGORY_COLOR.general
    const isRead  = ann.is_read
    const date    = ann.published_at || ann.created_at
    const audience = ann.target_grade || AUDIENCE_LABEL[ann.target_audience] || ann.target_audience

    return (
        <div
            className={`pann-card${isRead ? ' pann-card--read' : ''}`}
            style={{
                '--cat-bg': cat.bg,
                '--cat-border': cat.border,
                '--cat-border-soft': cat.border + '60',
                '--cat-badge': cat.badge,
                '--cat-text': cat.text,
            }}
        >
            {/* Icon */}
            <div className="pann-card-icon">
                <span className="material-symbols-rounded">{cat.icon}</span>
            </div>

            {/* Body */}
            <div className="pann-card-body">
                {/* Meta row */}
                <div className="pann-card-meta">
                    <span className="pann-cat-badge">{ann.category}</span>
                    {audience && (
                        <span className="pann-meta-text">· {audience}</span>
                    )}
                    <span className="pann-meta-text">· {relDate(date)}</span>
                    {!isRead && <span className="pann-unread-dot" />}
                </div>

                {/* Title */}
                <h4 className="pann-card-title">{ann.title}</h4>

                {/* Content */}
                <p className="pann-card-content">{ann.content}</p>

                {/* Footer */}
                <div className="pann-card-footer">
                    <span className="pann-card-author">
                        — {ann.author_name || 'Administration'}
                    </span>
                    {!isRead && (
                        <button onClick={() => onMarkRead(ann.id)} className="pann-mark-btn">
                            <span className="material-symbols-rounded">done</span>
                            Mark as read
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export function ParentAnnouncements() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [announcements, setAnnouncements] = useState([])
    const [stats,         setStats]         = useState(null)
    const [loading,       setLoading]       = useState(true)
    const [chip,          setChip]          = useState('All')
    const [markingAll,    setMarkingAll]    = useState(false)

    function load() {
        return Promise.all([
            getPublishedAnnouncements().catch(() => []),
            getAnnouncementStats().catch(() => null),
        ]).then(([anns, s]) => {
            setAnnouncements(Array.isArray(anns) ? anns : (anns?.results ?? []))
            setStats(s)
        })
    }

    useEffect(() => {
        load().finally(() => setLoading(false))
    }, [])

    function handleMarkRead(id) {
        markAnnouncementRead(id).catch(() => {})
        setAnnouncements(prev =>
            prev.map(a => a.id === id ? { ...a, is_read: true } : a)
        )
        setStats(prev => prev ? { ...prev, unread: Math.max(0, (prev.unread ?? 1) - 1) } : prev)
    }

    async function handleMarkAll() {
        setMarkingAll(true)
        try {
            await markAllAnnouncementsRead()
            setAnnouncements(prev => prev.map(a => ({ ...a, is_read: true })))
            setStats(prev => prev ? { ...prev, unread: 0 } : prev)
        } catch {/* silently fail */} finally {
            setMarkingAll(false)
        }
    }

    const unreadCount = announcements.filter(a => !a.is_read).length
    const urgentCount = announcements.filter(a => a.category === 'urgent').length
    const eventCount  = announcements.filter(a => a.category === 'event').length

    const visible = announcements.filter(a => chipMatch(a, chip))
    const chipCounts = {
        All:      announcements.length,
        Urgent:   urgentCount,
        Academic: announcements.filter(a => a.category === 'academic').length,
        Events:   eventCount,
        General:  announcements.filter(a => a.category === 'general').length,
    }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Announcements"
                        subtitle="Stay updated with school news and notifications"
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {/* Stats row */}
                        <div className="pann-stats-row">
                            <StatBox icon="inbox"             value={loading ? '—' : announcements.length} label="Total"          color="#3b82f6" />
                            <StatBox icon="mark_email_unread" value={loading ? '—' : unreadCount}          label="Unread"         color="#f59e0b" />
                            <StatBox icon="priority_high"     value={loading ? '—' : urgentCount}          label="Urgent"         color="#ef4444" />
                            <StatBox icon="event"             value={loading ? '—' : eventCount}           label="Upcoming Events" color="#8b5cf6" />
                        </div>

                        {/* Toolbar: chips + mark all */}
                        <div className="u-row-between u-mb">
                            <div className="pann-chip-row">
                                {CHIPS.map(c => {
                                    const active = chip === c.key
                                    return (
                                        <button key={c.key}
                                            onClick={() => setChip(c.key)}
                                            className={`pann-chip${active ? ' active' : ''}`}
                                        >
                                            {c.label}
                                            <span className="pann-chip-count">
                                                {chipCounts[c.key] ?? 0}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>

                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAll}
                                    disabled={markingAll}
                                    className="pann-markall-btn"
                                >
                                    <span className="material-symbols-rounded">done_all</span>
                                    {markingAll ? 'Marking…' : 'Mark all as read'}
                                </button>
                            )}
                        </div>

                        {/* Feed */}
                        {loading ? (
                            <p className="u-pad u-muted">Loading announcements…</p>
                        ) : visible.length === 0 ? (
                            <div className="u-pad-xl u-center-text u-muted">
                                <span className="material-symbols-rounded pann-empty-icon">inbox</span>
                                No announcements in this category.
                            </div>
                        ) : (
                            <div className="u-stack-sm">
                                {visible.map(a => (
                                    <AnnouncementCard key={a.id} ann={a} onMarkRead={handleMarkRead} />
                                ))}
                            </div>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
