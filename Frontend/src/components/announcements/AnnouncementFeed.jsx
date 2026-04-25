import { useState } from 'react'
import { Sidebar } from '../layout/Sidebar'
import { DashboardHeader } from '../layout/DashboardHeader'
import { AnnouncementItem } from './AnnouncementItem'
import { EmptyState } from '../ui/EmptyState'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/pages.css'

export function AnnouncementFeed({
    navItems,
    secondaryItems,
    title = 'Announcements',
    subtitle,
    userName,
    userRole,
    userInitials,
    avatarClass,
    notifications,
    announcements = [],
    chips = ['All'],
    sidebar,
    topPanel,
}) {
    const [activeChip, setActiveChip] = useState(chips[0])
    const [search, setSearch]         = useState('')

    const filtered = announcements.filter(a => {
        const matchChip   = activeChip === chips[0] || a.type?.toLowerCase() === activeChip.toLowerCase()
        const matchSearch = !search || [a.title, a.body, a.author].some(f => f?.toLowerCase().includes(search.toLowerCase()))
        return matchChip && matchSearch
    })

    const unreadCount = filtered.filter(a => a.isUnread).length

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={navItems} secondaryItems={secondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={title}
                        subtitle={subtitle}
                        userName={userName}
                        userRole={userRole}
                        userInitials={userInitials}
                        avatarClass={avatarClass}
                        notifications={notifications}
                    />
                    <div className="dashboard-content">

                        {topPanel}

                        {/* Toolbar container */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            flexWrap: 'wrap', marginBottom: '1rem',
                            background: 'var(--card)', border: '1px solid var(--border)',
                            borderRadius: 16, padding: '0.75rem 1rem',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                        }}>
                            <div className="ann-search-wrap" style={{ flex: 1, minWidth: 200 }}>
                                <span className="material-symbols-rounded">search</span>
                                <input
                                    type="text"
                                    placeholder="Search announcements..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch('')}
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--muted-foreground)' }}
                                    >
                                        <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>close</span>
                                    </button>
                                )}
                            </div>
                            <div className="ann-chip-bar">
                                {chips.map(chip => (
                                    <button
                                        key={chip}
                                        className={`ann-chip${chip === activeChip ? ' active' : ''}${chip.toLowerCase() === 'urgent' ? ' urgent' : ''}`}
                                        onClick={() => setActiveChip(chip)}
                                    >
                                        {chip}
                                    </button>
                                ))}
                            </div>
                            <button className="btn btn-outline btn-sm">
                                <span className="material-symbols-rounded">done_all</span> Mark All Read
                            </button>
                        </div>

                        <div className={`ann-page-wrap${sidebar ? '' : ' ann-no-sidebar'}`}>

                            {/* Single container for all announcements */}
                            {filtered.length === 0 ? (
                                <EmptyState
                                    icon="campaign"
                                    title={search ? `No results for "${search}"` : `No ${activeChip.toLowerCase()} announcements`}
                                    description={search
                                        ? 'Try different keywords or clear the search.'
                                        : 'There are no announcements in this category right now.'
                                    }
                                    action={
                                        search
                                            ? { label: 'Clear Search', icon: 'close', onClick: () => setSearch('') }
                                            : activeChip !== chips[0]
                                                ? { label: 'Show All', icon: 'refresh', onClick: () => setActiveChip(chips[0]) }
                                                : undefined
                                    }
                                />
                            ) : (
                                <div style={{
                                    background: 'var(--card)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 16,
                                    overflow: 'hidden',
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                                    flex: 1,
                                    minWidth: 0,
                                }}>
                                    {/* Container header */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
                                    }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                            {activeChip === chips[0] ? 'All Announcements' : `${activeChip} Announcements`}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {unreadCount > 0 && (
                                                <span style={{
                                                    fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem',
                                                    background: 'var(--primary)', color: '#fff', borderRadius: 20,
                                                }}>
                                                    {unreadCount} unread
                                                </span>
                                            )}
                                            <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
                                                {filtered.length} item{filtered.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Items — divider-separated, no individual card borders */}
                                    <div className="ann-list ann-list-contained">
                                        {filtered.map((item, i) => (
                                            <AnnouncementItem key={i} {...item} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {sidebar && (
                                <div className="ann-sidebar">
                                    {sidebar}
                                </div>
                            )}
                        </div>

                    </div>
                </main>
            </div>
        </>
    )
}
