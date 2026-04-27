import { Sidebar } from '../../components/layout/Sidebar'
import { Link } from 'react-router'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const behaviourStats = [
    { cardClass: 'success', value: '12', label: 'Positive Reports', trend: 'This term',      trendClass: '',   icon: 'thumb_up',     iconClass: 'success' },
    { cardClass: 'warning', value: '1',  label: 'Warnings',         trend: 'Minor incidents', trendClass: '',   icon: 'warning',      iconClass: 'warning' },
    { cardClass: 'info',    value: 'A',  label: 'Conduct Grade',    trend: 'Excellent',       trendClass: 'up', icon: 'grade',        iconClass: 'info'    },
    { cardClass: 'success', value: '5',  label: 'Achievements',     trend: 'Awards earned',   trendClass: 'up', icon: 'emoji_events', iconClass: 'success' },
]

const behaviourReports = [
    { type: 'positive', title: 'Outstanding Class Participation', teacher: 'Mr. Pacifique Rurangwa \u00b7 Mathematics',        badge: 'Positive',  badgeClass: 'positive', badgeIcon: 'sentiment_satisfied', date: 'April 10, 2026', action: 'Commendation Letter',      reportedBy: 'Mr. Pacifique Rurangwa',    desc: "Amina actively participated in class discussions and helped fellow students understand complex mathematical concepts. She demonstrated strong leadership and empathy." },
    { type: 'warning',  title: 'Late Arrival to Class',          teacher: 'Ms. Sandrine Uwera \u00b7 Physics',             badge: 'Minor',     badgeClass: 'neutral',   badgeIcon: 'schedule',            date: 'April 3, 2026', action: 'Verbal Warning (Excused)', reportedBy: 'Ms. Sandrine Uwera',    desc: 'Student arrived 10 minutes late to Physics class. Reason provided: helping a fellow student who fell in the hallway. Considered excused.' },
    { type: 'positive', title: 'Umuco Fest Leadership',         teacher: 'Dr. Jean-Claude Ndagijimana \u00b7 Director of Studies', badge: 'Excellent', badgeClass: 'positive',  badgeIcon: 'star',                date: 'March 28, 2026', action: 'Certificate of Excellence', reportedBy: 'Dr. Jean-Claude Ndagijimana', desc: 'Successfully organized and led the school cultural festival preparations, demonstrating exceptional leadership and organizational skills that inspired fellow students.' },
]

const achievements = [
    { icon: 'emoji_events',      title: 'Science Fair Winner',  date: 'January 15, 2026' },
    { icon: 'military_tech',     title: 'Top of Class \u2013 Maths', date: 'December 2025'    },
    { icon: 'workspace_premium', title: 'Perfect Attendance',   date: 'Term 3, 2025'     },
    { icon: 'diversity_3',       title: 'Community Leader',     date: 'November 2025'    },
    { icon: 'menu_book',         title: 'Reading Champion',     date: 'October 2025'     },
]

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

function BehaviourCard({ type, title, teacher, badge, badgeClass, badgeIcon, date, action, reportedBy, desc }) {
    return (
        <div className={`behavior-card type-${type}`}>
            <div className="behavior-header">
                <div>
                    <h4>{title}</h4>
                    <p>{teacher}</p>
                </div>
                <span className={`behavior-badge ${badgeClass}`}>
                    <span className="behaviour-icon material-symbols-rounded">{badgeIcon}</span>
                    {badge}
                </span>
            </div>
            <p className="behavior-description">{desc}</p>
            <div className="behavior-meta">
                <div className="behavior-meta-item">
                    <span className="behavior-meta-label">Date</span>
                    <span className="behavior-meta-value">{date}</span>
                </div>
                <div className="behavior-meta-item">
                    <span className="behavior-meta-label">Action Taken</span>
                    <span className="behavior-meta-value">{action}</span>
                </div>
                <div className="behavior-meta-item">
                    <span className="behavior-meta-label">Reported By</span>
                    <span className="behavior-meta-value">{reportedBy}</span>
                </div>
            </div>
        </div>
    )
}

function AchievementCard({ icon, title, date }) {
    return (
        <div className="achievement-card">
            <div className="achievement-icon">
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div>
                <p className="achievement-title">{title}</p>
                <p className="achievement-date">{date}</p>
            </div>
        </div>
    )
}

export function ParentBehaviour() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}>
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Behavior Reports</h1>
                            <p>Track your child's conduct and achievements</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Sunday, March 08, 2026</span>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Mrs. Chantal Uwase</span>
                                    <span className="header-user-role">Parent</span>
                                </div>
                                <Link to="/profile" className="header-user-av parent-av">CU</Link>
                            </div>
                        </div>
                    </header>

                    {/* Child Switcher */}
                    <div className="child-switcher-bar">
                        <span className="child-switcher-label">Child:</span>
                        <button className="child-tab active">
                            <div className="child-tab-avatar amina">UA</div>
                            <span className="child-tab-name">Uwase Amina</span>
                            <span className="child-tab-grade">&middot; S4A</span>
                        </button>
                    </div>

                    <DashboardContent>

                        {/* Conduct Hero */}
                        <div className="conduct-hero">
                            <div className="conduct-hero-left">
                                <div className="conduct-hero-avatar amina">UA</div>
                                <div>
                                    <p className="conduct-hero-name">Uwase Amina</p>
                                    <p className="conduct-hero-sub">S4A &nbsp;&middot;&nbsp; Bisoke House &nbsp;&middot;&nbsp; Term 2, 2026</p>
                                </div>
                            </div>
                            <div className="conduct-hero-stats">
                                <div className="conduct-stat"><span className="label">Conduct</span><span className="value grade-a">A</span></div>
                                <div className="conduct-stat"><span className="label">Positive</span><span className="value">12</span></div>
                                <div className="conduct-stat"><span className="label">Warnings</span><span className="value">1</span></div>
                                <div className="conduct-stat"><span className="label">Awards</span><span className="value">5</span></div>
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="quick-stats-grid">
                            {behaviourStats.map((stat, index) => (
                                <BehaviourStat key={index} {...stat} />
                            ))}
                        </div>

                        {/* Reports + Achievements */}
                        <div className="grid-2 mt-1-5">
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Recent Reports</h3>
                                </div>
                                <div className="card-content">
                                    <div className="behavior-filter-bar">
                                        <button className="behavior-filter-btn active">
                                            All <span className="count-badge">3</span>
                                        </button>
                                        <button className="behavior-filter-btn">
                                            <span className="material-symbols-rounded icon-14">thumb_up</span>
                                            Positive <span className="count-badge">2</span>
                                        </button>
                                        <button className="behavior-filter-btn">
                                            <span className="material-symbols-rounded icon-14">warning</span>
                                            Warnings <span className="count-badge">1</span>
                                        </button>
                                    </div>
                                    <div className="behavior-grid">
                                        {behaviourReports.map((report, index) => (
                                            <BehaviourCard key={index} {...report} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Achievements</h3>
                                    <span className="badge badge-accent">5 earned</span>
                                </div>
                                <div className="card-content">
                                    <div className="achievements-grid">
                                        {achievements.map((a, index) => (
                                            <AchievementCard key={index} {...a} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
