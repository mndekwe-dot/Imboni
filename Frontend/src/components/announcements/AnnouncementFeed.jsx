import { useState } from 'react'
import { Sidebar } from '../layout/Sidebar'
import { DashboardHeader } from '../layout/DashboardHeader'
import { AnnouncementItem } from './AnnouncementItem'
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

                        <div className="ann-filter-row">
                            <div className="ann-search-wrap">
                                <span className="material-symbols-rounded">search</span>
                                <input type="text" placeholder="Search announcements..." />
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
                            <div className="ann-list">
                                {announcements.map((item, i) => (
                                    <AnnouncementItem key={i} {...item} />
                                ))}
                            </div>
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
