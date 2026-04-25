import { useState } from 'react'
import { Sidebar } from '../layout/Sidebar'
import { DashboardHeader } from '../layout/DashboardHeader'
import { AnnouncementItem } from './AnnouncementItem'
import { EmptyState } from '../ui/EmptyState'
import { Modal } from '../ui/Modal'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/pages.css'
import { DashboardContent } from '../layout/DashboardContent'

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
    const [activeChip, setActiveChip]   = useState(chips[0])
    const [search, setSearch]           = useState('')
    const [selected, setSelected]       = useState(null)   // announcement being viewed

    const filtered = announcements.filter(a => {
        const matchChip   = activeChip === chips[0] || a.type?.toLowerCase() === activeChip.toLowerCase()
        const matchSearch = !search || [a.title, a.body, a.author].some(f => f?.toLowerCase().includes(search.toLowerCase()))
        return matchChip && matchSearch
    })

    const unreadCount = filtered.filter(a => a.isUnread).length

    return (
        <>
            {/* Announcement detail modal */}
            {selected && (
                <Modal
                    title={selected.title}
                    icon={selected.icon ?? 'campaign'}
                    onClose={() => setSelected(null)}
                    size="wide"
                    footer={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>
                                <span className="material-symbols-rounded icon-sm">arrow_back</span> Back
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => setSelected(null)}>
                                <span className="material-symbols-rounded icon-sm">done</span>
                                {selected.isUnread ? 'Mark as Read' : 'Close'}
                            </button>
                        </div>
                    }
                >
                    {/* Type badge + meta */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                        <span className={`ann-type-badge ${selected.type ?? 'general'}`} style={{ fontSize: '0.75rem', padding: '3px 10px' }}>
                            {(selected.type ?? 'general').charAt(0).toUpperCase() + (selected.type ?? 'general').slice(1)}
                        </span>
                        <span className="ann-dot"></span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>{selected.date}</span>
                        {selected.audience && <>
                            <span className="ann-dot"></span>
                            <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>{selected.audience}</span>
                        </>}
                    </div>

                    {/* Full body */}
                    <div style={{
                        fontSize: '0.92rem', lineHeight: 1.75,
                        color: 'var(--foreground)',
                        padding: '1.25rem',
                        background: 'var(--muted)',
                        borderRadius: 10,
                        marginBottom: '1.25rem',
                    }}>
                        {selected.body}
                    </div>

                    {/* Author */}
                    {selected.author && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                                {selected.author.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, color: 'var(--foreground)', fontSize: '0.85rem' }}>{selected.author}</div>
                                <div style={{ fontSize: '0.75rem' }}>Posted {selected.date}</div>
                            </div>
                        </div>
                    )}
                </Modal>
            )}

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
                    <DashboardContent>

                        {topPanel}

                        <div className={`ann-page-wrap${sidebar ? '' : ' ann-no-sidebar'}`}>

                            {/* Single container: search + chips + list */}
                            <div style={{
                                background: 'var(--card)',
                                border: '1px solid var(--border)',
                                borderRadius: 16,
                                overflow: 'hidden',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                                flex: 1,
                                minWidth: 0,
                            }}>
                                {/* Toolbar row */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    flexWrap: 'wrap', padding: '0.875rem 1.25rem',
                                    borderBottom: '1px solid var(--border)',
                                }}>
                                    <div className="ann-search-wrap" style={{ flex: 1, minWidth: 180 }}>
                                        <span className="material-symbols-rounded">search</span>
                                        <input
                                            type="text"
                                            placeholder="Search announcements..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                        />
                                        {search && (
                                            <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--muted-foreground)' }}>
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

                                {/* List header */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)',
                                    background: 'var(--muted)',
                                }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {activeChip === chips[0] ? 'All Announcements' : `${activeChip} Announcements`}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {unreadCount > 0 && (
                                            <span style={{ fontSize: '0.73rem', fontWeight: 600, padding: '0.15rem 0.55rem', background: 'var(--primary)', color: '#fff', borderRadius: 20 }}>
                                                {unreadCount} unread
                                            </span>
                                        )}
                                        <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                                            {filtered.length} item{filtered.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>

                                {/* Items or EmptyState */}
                                {filtered.length === 0 ? (
                                    <div style={{ padding: '1rem' }}>
                                        <EmptyState
                                            icon="campaign"
                                            title={search ? `No results for "${search}"` : `No ${activeChip.toLowerCase()} announcements`}
                                            description={search ? 'Try different keywords or clear the search.' : 'There are no announcements in this category right now.'}
                                            action={
                                                search
                                                    ? { label: 'Clear Search', icon: 'close', onClick: () => setSearch('') }
                                                    : activeChip !== chips[0]
                                                        ? { label: 'Show All', icon: 'refresh', onClick: () => setActiveChip(chips[0]) }
                                                        : undefined
                                            }
                                        />
                                    </div>
                                ) : (
                                    <div className="ann-list ann-list-contained">
                                        {filtered.map((item, i) => (
                                            <AnnouncementItem key={i} {...item} onClick={() => setSelected(item)} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {sidebar && (
                                <div className="ann-sidebar">
                                    {sidebar}
                                </div>
                            )}
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
