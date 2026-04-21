import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'


const recentBroadcasts = [
    { avatar: 'JN', avatarClass: '',              title: 'S4 National Exam Prep â€“ Schedule Update', sentTo: 'All Teachers', time: '2h ago',               badgeClass: 'urgent',   badge: 'Urgent',   views: '124', isDraft: false, excerpt: 'Please note that the S4 national exam preparation session originally scheduled for Monday has been moved to Wednesday. All invigilators should update their rosters accordingly.' },
    { avatar: 'JN', avatarClass: '',              title: 'Sports Day Logistics',       sentTo: 'Parents',      time: '1 day ago',            badgeClass: 'event',    badge: 'Event',    views: '450', isDraft: false, excerpt: 'Parents are invited to attend the annual sports gala starting at 9:00 AM this Friday at the main sports ground. Refreshments will be provided.'        },
    { avatar: 'JN', avatarClass: '',              title: 'S4 & S6 Exam Timetable Published', sentTo: 'All Students', time: '3 days ago',           badgeClass: 'academic', badge: 'Academic', views: '892', isDraft: false, excerpt: 'The official Term 2 exam timetable for S4 and S6 is now available on the student portal. Please review and report any conflicts to the DOS office.'             },
    { avatar: 'JN', avatarClass: 'avatar-warning',title: 'End of Term Assembly',       sentTo: null,           time: 'Last edited 5 days ago', badgeClass: 'general', badge: 'General', views: null,  isDraft: true,  excerpt: 'Reminder that the end-of-term assembly will be held on the last Friday of term. All students and staff are expected to attend...'                    },
]

function BroadcastItem({ avatar, avatarClass, title, sentTo, time, badgeClass, badge, views, isDraft, excerpt }) {
    return (
        <div className="ann-item">
            <div className="ann-item-header">
                <div className={`ann-avatar${avatarClass ? ' ' + avatarClass : ''}`}>{avatar}</div>
                <div className="ann-item-meta">
                    <div className="ann-item-title">{title}</div>
                    <div className="ann-item-sub">
                        {isDraft ? 'Draft' : `Sent to: ${sentTo}`} &nbsp;&middot;&nbsp; {time}
                    </div>
                </div>
                <span className={`ann-badge ${badgeClass}`}>{badge}</span>
            </div>
            <p className="ann-excerpt">{excerpt}</p>
            <div className="ann-item-footer">
                {isDraft
                    ? <span className="ann-views"><span className="material-symbols-rounded">draft</span> Draft</span>
                    : <span className="ann-views"><span className="material-symbols-rounded">visibility</span> {views} views</span>
                }
                <div className="ann-item-actions">
                    <button className="ann-icon-btn"><span className="material-symbols-rounded">edit</span></button>
                    {isDraft && <button className="ann-icon-btn"><span className="material-symbols-rounded">publish</span></button>}
                    <button className="ann-icon-btn danger"><span className="material-symbols-rounded">delete</span></button>
                </div>
            </div>
        </div>
    )
}

export function DosAnnouncement() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}>
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Announcements</h1>
                            <p>Compose and broadcast school-wide announcements</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Monday, March 09, 2026</span>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Dr. Jean-Claude Ndagijimana</span>
                                    <span className="header-user-role">Director of Studies</span>
                                </div>
                                <div className="header-user-av dos-av">JN</div>
                            </div>
                        </div>
                    </header>

                    <div className="dashboard-content">
                        <div className="ann-grid">

                            {/* LEFT: Compose Form */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">
                                        <span className="material-symbols-rounded">edit_note</span> Create New Announcement
                                    </h2>
                                </div>
                                <div className="card-content">
                                    <form>
                                        <div className="form-group ann-form-group">
                                            <label className="form-label">Category</label>
                                            <div className="ann-category-row">
                                                <label className="ann-cat-label urgent">
                                                    <input type="radio" name="ann-cat" value="urgent" />
                                                    <span className="material-symbols-rounded">priority_high</span> Urgent
                                                </label>
                                                <label className="ann-cat-label academic">
                                                    <input type="radio" name="ann-cat" value="academic" defaultChecked />
                                                    <span className="material-symbols-rounded">school</span> Academic
                                                </label>
                                                <label className="ann-cat-label event">
                                                    <input type="radio" name="ann-cat" value="event" />
                                                    <span className="material-symbols-rounded">event</span> Event
                                                </label>
                                                <label className="ann-cat-label general">
                                                    <input type="radio" name="ann-cat" value="general" />
                                                    <span className="material-symbols-rounded">info</span> General
                                                </label>
                                            </div>
                                        </div>

                                        <div className="form-group ann-form-group">
                                            <label className="form-label" htmlFor="annTitle">Announcement Title</label>
                                            <input type="text" className="form-input" id="annTitle" placeholder="e.g. Mid-Term Exam Schedule Revision" />
                                        </div>

                                        <div className="form-group ann-form-group">
                                            <label className="form-label">Send To</label>
                                            <div className="ann-audience-grid">
                                                <label className="ann-audience-item">
                                                    <input type="checkbox" defaultChecked />
                                                    <span className="material-symbols-rounded">school</span> All Teachers
                                                </label>
                                                <label className="ann-audience-item">
                                                    <input type="checkbox" />
                                                    <span className="material-symbols-rounded">group</span> All Students
                                                </label>
                                                <label className="ann-audience-item">
                                                    <input type="checkbox" />
                                                    <span className="material-symbols-rounded">family_restroom</span> Parents / Guardians
                                                </label>
                                                <label className="ann-audience-item">
                                                    <input type="checkbox" />
                                                    <span className="material-symbols-rounded">manage_accounts</span> Department Heads
                                                </label>
                                            </div>
                                        </div>

                                        <div className="ann-form-row">
                                            <div className="ann-form-col">
                                                <label className="form-label">Year Group (optional)</label>
                                                <select className="form-input" id="annYear">
                                                    <option value="">All Year Groups</option>
                                                    <option>S1 (Form 1)</option>
                                                    <option>S2 (Form 2)</option>
                                                    <option>S3 (Form 3)</option>
                                                    <option>S4 (Form 4)</option>
                                                    <option>S5 (Form 5)</option>
                                                    <option>S6 (Form 6)</option>
                                                </select>
                                            </div>
                                            <div className="ann-form-col">
                                                <label className="form-label">Schedule Send (optional)</label>
                                                <input type="datetime-local" className="form-input" id="annSchedule" />
                                            </div>
                                        </div>

                                        <div className="form-group ann-content-group">
                                            <label className="form-label" htmlFor="annContent">Announcement Content</label>
                                            <textarea className="form-input" id="annContent" rows={6} placeholder="Type the full announcement details here..."></textarea>
                                        </div>

                                        <div className="ann-form-actions">
                                            <button type="button" className="btn btn-secondary">Clear</button>
                                            <button type="button" className="btn btn-secondary">
                                                <span className="material-symbols-rounded">draft</span> Save Draft
                                            </button>
                                            <button type="button" className="btn btn-primary">
                                                <span className="material-symbols-rounded">send</span> Publish Now
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>

                            {/* RIGHT: Recent Broadcasts */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Recent Broadcasts</h2>
                                    <span className="badge badge-published">18 published</span>
                                </div>
                                <div className="card-content">
                                    <div className="ann-filter-row">
                                        <button className="ann-filter-pill active">All</button>
                                        <button className="ann-filter-pill">Published</button>
                                        <button className="ann-filter-pill">Drafts</button>
                                        <button className="ann-filter-pill">Archive</button>
                                    </div>
                                    <div>
                                        {recentBroadcasts.map((item, index) => (
                                            <BroadcastItem key={index} {...item} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    )
}
