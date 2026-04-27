import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'


const children = [
    { initial: 'A', name: 'Uwase Amina',   grade: 'S4A' },
]

const aminaStats = [
    { icon: 'trending_up',    value: '85%', label: 'Overall Performance',  trend: '+5% from last term',   trendClass: 'positive', colorClass: 'success' },
    { icon: 'event_available',value: '96%', label: 'Attendance Rate',       trend: '23 present, 1 absent', trendClass: '',         colorClass: ''        },
    { icon: 'campaign',       value: '3',   label: 'Unread Announcements',  trend: '2 urgent',             trendClass: 'negative', colorClass: 'warning' },
    { icon: 'shield_person',  value: '2',   label: 'Behavior Reports',      trend: 'All positive',         trendClass: 'positive', colorClass: 'warning' },
]

const recentAssessments = [
    { iconClass: 'quiz',  icon: 'quiz',        title: 'Algebra Quiz #3',             sub: 'Individual Task • Feb 05',    score: '18/20', scoreClass: 'text-success' },
    { iconClass: 'group', icon: 'groups',       title: 'Climate Change Presentation', sub: 'Group Project (Lead) • Jan 28', score: '45/50', scoreClass: 'text-success' },
    { iconClass: 'quiz',  icon: 'history_edu',  title: 'Literature Essay',            sub: 'Weekly Assignment • Jan 15',   score: '12/20', scoreClass: 'text-warning' },
]

const recentResults = [
    { subject: 'Mathematics', type: 'Mid-Term', score: '85/100', grade: 'A', badgeClass: 'badge-success', date: 'Jan 15, 2026', lastRow: false },
    { subject: 'English',     type: 'Quiz',     score: '78/100', grade: 'B', badgeClass: 'badge-primary', date: 'Jan 14, 2026', lastRow: false },
    { subject: 'Physics',     type: 'Test',     score: '92/100', grade: 'A', badgeClass: 'badge-success', date: 'Jan 12, 2026', lastRow: false },
    { subject: 'Chemistry',   type: 'Lab',      score: '70/100', grade: 'B', badgeClass: 'badge-primary', date: 'Jan 10, 2026', lastRow: false },
    { subject: 'History',     type: 'Essay',    score: '88/100', grade: 'A', badgeClass: 'badge-success', date: 'Jan 8, 2026',  lastRow: true  },
]

const upcomingEvents = [
    { iconClass: 'meeting', icon: 'event',           title: 'Parent-Teacher Meeting',  date: 'Apr 25, 2026', time: '10:00 AM' },
    { iconClass: 'event',   icon: 'brand_awareness', title: 'Umuco Fest Cultural Festival', date: 'May 2, 2026',  time: '09:00 AM' },
    { iconClass: 'exam',    icon: 'assignment',      title: 'National Exam Prep Begins', date: 'May 10, 2026', time: '07:30 AM' },
    { iconClass: 'event',   icon: 'brand_awareness', title: 'Sports Day',              date: 'May 20, 2026', time: '10:00 AM' },
]


function AssessmentItem({ iconClass, icon, title, sub, score, scoreClass }) {
    return (
        <div className="assessment-item">
            <div className={`assessment-icon ${iconClass}`}>
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div className="assessment-info">
                <p className="font-bold">{title}</p>
                <p className="text-xs text-muted">{sub}</p>
            </div>
            <div className={`assessment-score ${scoreClass}`}>{score}</div>
        </div>
    )
}

function ResultRow({ subject, type, score, grade, badgeClass, date }) {
    return (
        <tr>
            <td className="subject-name">{subject}</td>
            <td className="type-submission">{type}</td>
            <td>{score}</td>
            <td><span className={`badge ${badgeClass}`}>{grade}</span></td>
            <td className="date-assignment">{date}</td>
        </tr>
    )
}

function EventCard({ iconClass, icon, title, date, time }) {
    return (
        <div className="event-card">
            <div className={`event-icon ${iconClass}`}>
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div className="event-content">
                <span className="event-title">{title}</span>
                <span className="event-date">{date}</span>
                <span className="event-time">
                    <span className="upcoming_events_icon material-symbols-rounded">timer</span>
                    {time}
                </span>
            </div>
        </div>
    )
}

export function ParentDashboard() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Parent Dashboard" subtitle="Here's what's happening with your children"
                        userName="Mrs. Chantal Uwase" userRole="Parent"
                        userInitials="CU" avatarClass="parent-av" notifications={parentUser.notifications}
                    />

                    <DashboardContent>
                        {/* Tabs */}
                        <div className="tabs">
                            <div className="tabs-list">
                                {children.map((child, i) => (
                                    <button key={child.name} className={`tabs-trigger${i === 0 ? ' active' : ''}`} onClick={() => {}}>
                                        <div className="tabs-trigger-avatar">{child.initial}</div>
                                        <span>{child.name}</span>
                                        <span className="badge badge-secondary select-xs">{child.grade}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Amina's Tab Content */}
                            <div id="amina-tab" className="tabs-content active">
                                {/* Stats Cards */}
                                <div className="portal-stat-grid">
                                    {aminaStats.map((s, i) => (
                                        <StatCard key={i} {...s} />
                                    ))}
                                </div>

                                {/* Recent Assessments */}
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">Recent Assessments & Projects</h3>
                                        <span className="badge badge-secondary">This Term</span>
                                    </div>
                                    <div className="card-content">
                                        <div className="assessment-list">
                                            {recentAssessments.map((a) => (
                                                <AssessmentItem key={a.title} {...a} />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Results */}
                                <div className="dashboard-content-grid">
                                    <div className="dashboard-content-grid-card">
                                        <div className="card-header">
                                            <h3 className="card-title">Recent Results</h3>
                                            <button className="btn btn-outline btn-sm">
                                                View All <span className="material-symbols-rounded">arrow_forward</span>
                                            </button>
                                        </div>
                                        <div className="card-content">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Subject</th><th>Type</th><th>Score</th><th>Grade</th><th>Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {recentResults.map((r) => (
                                                        <ResultRow key={r.subject} {...r} />
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Upcoming Events */}
                                <div className="upcoming-events card">
                                    <div className="card-header">
                                        <h3 className="card-title">Upcoming Events</h3>
                                        <button className="btn btn-outline btn-sm">
                                            View Calendar <span className="material-symbols-rounded">arrow_forward</span>
                                        </button>
                                    </div>
                                    <div className="card-content">
                                        <div className="grid">
                                            {upcomingEvents.map((e) => (
                                                <EventCard key={e.title} {...e} />
                                            ))}
                                        </div>
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
