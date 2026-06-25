import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'
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
        <div style={{
            background: '#fff', borderRadius: 12, padding: '1rem 1.25rem',
            display: 'flex', alignItems: 'center', gap: '0.9rem',
            border: '1px solid var(--border)', flex: 1, minWidth: 130,
        }}>
            <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: color + '18', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
                <span className="material-symbols-rounded" style={{ color, fontSize: '1.2rem' }}>{icon}</span>
            </div>
            <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>{label}</div>
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
        <div style={{
            background: isRead ? '#fff' : cat.bg,
            border: `1px solid ${isRead ? 'var(--border)' : cat.border + '60'}`,
            borderLeft: `4px solid ${cat.border}`,
            borderRadius: 12,
            padding: '1.1rem 1.25rem',
            display: 'flex',
            gap: '1rem',
            transition: 'box-shadow 0.15s',
            opacity: isRead ? 0.82 : 1,
        }}>
            {/* Icon */}
            <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: cat.badge,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 2,
            }}>
                <span className="material-symbols-rounded" style={{ color: cat.text, fontSize: '1.1rem' }}>
                    {cat.icon}
                </span>
            </div>

            {/* Body */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Meta row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    <span style={{
                        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
                        background: cat.badge, color: cat.text,
                        borderRadius: 5, padding: '0.15rem 0.5rem', textTransform: 'uppercase',
                    }}>
                        {ann.category}
                    </span>
                    {audience && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                            · {audience}
                        </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        · {relDate(date)}
                    </span>
                    {!isRead && (
                        <span style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: cat.border, display: 'inline-block', marginLeft: 2,
                        }} />
                    )}
                </div>

                {/* Title */}
                <h4 style={{
                    margin: '0 0 0.35rem',
                    fontSize: '0.95rem',
                    fontWeight: isRead ? 500 : 700,
                    color: 'var(--foreground)',
                    lineHeight: 1.3,
                }}>
                    {ann.title}
                </h4>

                {/* Content */}
                <p style={{
                    margin: '0 0 0.6rem',
                    fontSize: '0.85rem',
                    color: 'var(--muted-foreground)',
                    lineHeight: 1.55,
                }}>
                    {ann.content}
                </p>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                        — {ann.author_name || 'Administration'}
                    </span>
                    {!isRead && (
                        <button
                            onClick={() => onMarkRead(ann.id)}
                            style={{
                                fontSize: '0.75rem', padding: '0.2rem 0.65rem',
                                borderRadius: 6, border: `1px solid ${cat.border}`,
                                background: 'transparent', color: cat.text,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                fontWeight: 500,
                            }}
                        >
                            <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>done</span>
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
                        {...parentUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {/* Stats row */}
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                            <StatBox icon="inbox"             value={loading ? '—' : announcements.length} label="Total"          color="#3b82f6" />
                            <StatBox icon="mark_email_unread" value={loading ? '—' : unreadCount}          label="Unread"         color="#f59e0b" />
                            <StatBox icon="priority_high"     value={loading ? '—' : urgentCount}          label="Urgent"         color="#ef4444" />
                            <StatBox icon="event"             value={loading ? '—' : eventCount}           label="Upcoming Events" color="#8b5cf6" />
                        </div>

                        {/* Toolbar: chips + mark all */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem',
                        }}>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {CHIPS.map(c => {
                                    const active = chip === c.key
                                    return (
                                        <button key={c.key}
                                            onClick={() => setChip(c.key)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.35rem',
                                                padding: '0.35rem 0.85rem', borderRadius: 20,
                                                border: active ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                                                background: active ? 'var(--primary)' : '#fff',
                                                color: active ? '#fff' : 'var(--foreground)',
                                                fontSize: '0.82rem', fontWeight: active ? 600 : 400,
                                                cursor: 'pointer', transition: 'all 0.15s',
                                            }}
                                        >
                                            {c.label}
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 600,
                                                background: active ? 'rgba(255,255,255,0.25)' : 'var(--muted)',
                                                color: active ? '#fff' : 'var(--muted-foreground)',
                                                borderRadius: 10, padding: '0.05rem 0.4rem',
                                            }}>
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
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        padding: '0.4rem 1rem', borderRadius: 8,
                                        border: '1px solid var(--border)', background: '#fff',
                                        color: 'var(--primary)', fontSize: '0.82rem',
                                        fontWeight: 500, cursor: 'pointer',
                                    }}
                                >
                                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>done_all</span>
                                    {markingAll ? 'Marking…' : 'Mark all as read'}
                                </button>
                            )}
                        </div>

                        {/* Feed */}
                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading announcements…</p>
                        ) : visible.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>inbox</span>
                                No announcements in this category.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
