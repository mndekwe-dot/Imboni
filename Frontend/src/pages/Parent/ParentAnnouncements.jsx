import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { parentNavItems, parentSecondaryItems } from './parentNav'
import { formatDate } from '../../utils/date'
import {
    getPublishedAnnouncements, getAnnouncementStats,
    markAnnouncementRead, markAllAnnouncementsRead,
} from '../../api/parent'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'
import { StatCard } from '../../components/layout/StatCard'
import { FilterBar } from '../../components/ui/FilterBar'
import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import '../../styles/tables.css'

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

/* Keys, resolved inside the component. As plain strings the whole filter row
   stayed English under the language switch. */
const CHIPS = [
    { key: 'All',      labelKey: 'announcements.filterAll'   },
    { key: 'Urgent',   labelKey: 'announcements.catUrgent'   },
    { key: 'Academic', labelKey: 'announcements.catAcademic' },
    { key: 'Events',   labelKey: 'announcements.catEvents'   },
    { key: 'General',  labelKey: 'announcements.catGeneral'  },
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
    return formatDate(d)
}

// Was a copy of the shared tile taking a raw hex per box (#3b82f6, #f59e0b,
// #ef4444, #8b5cf6) - colour literals in JSX, disconnected from the palette
// and from any meaning. The boxes now name a semantic family instead, so
// "urgent" is the same red here as everywhere else in the app.
function StatBox({ icon, value, label, tone }) {
    return <StatCard icon={icon} value={value} label={label} colorClass={tone} />
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
                <span className="material-symbols-rounded" aria-hidden="true">{cat.icon}</span>
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
                        By {ann.author_name || 'Administration'}
                    </span>
                    {!isRead && (
                        <button onClick={() => onMarkRead(ann.id)} className="pann-mark-btn">
                            <span className="material-symbols-rounded" aria-hidden="true">done</span>
                            Mark as read
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export function ParentAnnouncements() {
    const { t } = useTranslation()
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
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.announcements')}
                        subtitle={t('parent.announcements.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {/* Stats row */}
                        <div className="portal-stat-grid mb-1-5">
                            <StatBox icon="inbox"             value={loading ? '-' : announcements.length} label={t('announcements.statTotal')}    tone="info" />
                            <StatBox icon="mark_email_unread" value={loading ? '-' : unreadCount}          label={t('announcements.statUnread')}   tone="warning" />
                            <StatBox icon="priority_high"     value={loading ? '-' : urgentCount}          label={t('announcements.catUrgent')}    tone="red" />
                            <StatBox icon="event"             value={loading ? '-' : eventCount}           label={t('announcements.statUpcoming')} tone="" />
                        </div>

                        {/* The shared FilterBar in a toolbar card, as on every
                            other list page. This was a hand-rolled chip row
                            with its own class names and its own count pill,
                            floating on the page background beside a button
                            that was not a .btn. */}
                        <div className="toolbar-card mb-1-5">
                            <FilterBar
                                options={CHIPS.map(c => ({
                                    key: c.key,
                                    label: t(c.labelKey),
                                    count: chipCounts[c.key] ?? 0,
                                }))}
                                active={chip}
                                onChange={setChip}
                            />
                            <div className="toolbar-spacer" />
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAll}
                                    disabled={markingAll}
                                    className="btn btn-outline btn-sm"
                                >
                                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">done_all</span>
                                    {markingAll ? t('announcements.markingAll') : t('announcements.markAllRead')}
                                </button>
                            )}
                        </div>

                        <ListSection
                            icon="campaign"
                            title={t(CHIPS.find(c => c.key === chip)?.labelKey ?? 'announcements.filterAll')}
                            count={loading ? null : t('announcements.count', { count: visible.length })}
                        >
                            {loading ? (
                                <p className="u-muted">{t('announcements.loading')}</p>
                            ) : visible.length === 0 ? (
                                <EmptyState
                                    icon="inbox"
                                    title={t('announcements.noneMatch')}
                                    description={t('announcements.noneMatchDesc')}
                                    action={chip !== 'All'
                                        ? { label: t('common.clearFilters'), icon: 'close', onClick: () => setChip('All') }
                                        : undefined}
                                />
                            ) : (
                                <div className="u-stack-sm">
                                    {visible.map(a => (
                                        <AnnouncementCard key={a.id} ann={a} onMarkRead={handleMarkRead} />
                                    ))}
                                </div>
                            )}
                        </ListSection>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
