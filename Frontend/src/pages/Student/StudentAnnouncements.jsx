import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { getStudentAnnouncements, getAnnouncementStats } from '../../api/student'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'

const CATEGORY_ICON = {
    urgent:   'priority_high',
    academic: 'school',
    event:    'emoji_events',
    general:  'campaign',
}

const CHIPS = ['All', 'Urgent', 'Academic', 'Events', 'General']

function AnnouncementItem({ ann }) {
    const icon    = CATEGORY_ICON[ann.category] || 'campaign'
    const date    = ann.published_at || ann.created_at
    const dateStr = date
        ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : ''

    return (
        <div className={`announcement-item type-${ann.category || 'general'}`}>
            <div className="ann-icon-wrap">
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div className="ann-content">
                <div className="ann-meta">
                    <span className={`ann-chip type-${ann.category}`}>{(ann.category || 'general').toUpperCase()}</span>
                    <span className="ann-date">{dateStr}</span>
                </div>
                <h4 className="ann-title">{ann.title}</h4>
                <p className="ann-body">{ann.content}</p>
                <p className="ann-author">— {ann.author || 'Administration'}</p>
            </div>
        </div>
    )
}

export function StudentAnnouncements() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [announcements, setAnnouncements] = useState([])
    const [stats,         setStats]         = useState(null)
    const [loading,       setLoading]       = useState(true)
    const [chip,          setChip]          = useState('All')

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim()
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()

    useEffect(() => {
        Promise.all([
            getStudentAnnouncements().catch(() => []),
            getAnnouncementStats().catch(() => null),
        ]).then(([anns, s]) => {
            setAnnouncements(Array.isArray(anns) ? anns : [])
            setStats(s)
        }).finally(() => setLoading(false))
    }, [])

    const urgentCount = announcements.filter(a => a.category === 'urgent').length
    const eventCount  = announcements.filter(a => a.category === 'event').length

    const statCards = [
        { colorClass: 'info',    icon: 'inbox',             value: loading ? '—' : announcements.length,      label: 'Total',           trend: 'Published'     },
        { colorClass: 'warning', icon: 'mark_email_unread', value: loading ? '—' : (stats?.unread ?? '—'),    label: 'Unread',          trend: 'New'           },
        { colorClass: 'danger',  icon: 'priority_high',     value: loading ? '—' : urgentCount,               label: 'Urgent',          trend: 'Action needed' },
        { colorClass: 'success', icon: 'event',             value: loading ? '—' : eventCount,                label: 'Upcoming Events', trend: 'This month'    },
    ]

    const visible = chip === 'All'
        ? announcements
        : announcements.filter(a => {
            if (chip === 'Urgent')   return a.category === 'urgent'
            if (chip === 'Academic') return a.category === 'academic'
            if (chip === 'Events')   return a.category === 'event'
            if (chip === 'General')  return a.category === 'general'
            return true
        })

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Announcements"
                        subtitle="School notices, class updates & activity alerts"
                        userName={fullName}
                        userRole="Student"
                        userInitials={initials}
                        avatarClass="student-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <div className="portal-stat-grid mb-5">
                            {statCards.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        {/* Filter chips */}
                        <div className="ann-chips-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                            {CHIPS.map(c => (
                                <button
                                    key={c}
                                    className={`chip${chip === c ? ' chip-active' : ''}`}
                                    onClick={() => setChip(c)}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading announcements…</p>
                        ) : visible.length === 0 ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>No announcements found.</p>
                        ) : (
                            <div className="ann-feed">
                                {visible.map(a => <AnnouncementItem key={a.id} ann={a} />)}
                            </div>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
