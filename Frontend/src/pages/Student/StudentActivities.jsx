import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { EmptyState } from '../../components/ui/EmptyState'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import {
    getStudentProfile, getStudentDiscipline,
    getStudentActivities, getStudentActivityEvents,
    joinActivity, withdrawActivity,
} from '../../api/student'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'

const MAIN_TABS   = ['Discipline Records', 'Extracurricular Activities', 'Upcoming Events']
const TYPE_TABS   = ['All', 'Positive', 'Negative', 'Warning']

function reportTypeDisplay(type) {
    switch (type) {
        case 'positive':    return { label: 'Positive',    typeClass: 'disc-type-positive' }
        case 'achievement': return { label: 'Achievement', typeClass: 'disc-type-positive' }
        case 'warning':     return { label: 'Warning',     typeClass: 'disc-type-warning'  }
        case 'incident':    return { label: 'Negative',    typeClass: 'disc-type-negative' }
        default:            return { label: type,          typeClass: ''                   }
    }
}

function typeFilterMatch(report, filter) {
    if (filter === 'All') return true
    if (filter === 'Positive') return report.report_type === 'positive' || report.report_type === 'achievement'
    if (filter === 'Warning')  return report.report_type === 'warning'
    if (filter === 'Negative') return report.report_type === 'incident'
    return true
}

function DisciplineRow({ report }) {
    const { label, typeClass } = reportTypeDisplay(report.report_type)
    const dateStr = report.date
        ? new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '-'
    const isPos  = report.report_type === 'positive' || report.report_type === 'achievement'
    const isNeg  = report.report_type === 'incident'
    const isWarn = report.report_type === 'warning'
    const pointsClass = isPos ? 'disc-points-pos' : (isNeg || isWarn ? 'disc-points-neg' : '')
    const pointsLabel = isPos ? '+' : (isNeg ? '-' : 'W')
    const statusClass = isPos ? 'badge-soft-success' : (isNeg ? 'badge-soft-danger' : 'badge-soft-warning')
    const statusLabel = isPos ? 'Awarded' : (isNeg ? 'Noted' : 'Warning')

    return (
        <tr>
            <td>{dateStr}</td>
            <td><span className={typeClass}>{label}</span></td>
            <td>{report.title || report.description}</td>
            <td>{report.reported_by || '-'}</td>
            <td><span className={pointsClass}>{pointsLabel}</span></td>
            <td><span className={`badge ${statusClass}`}>{statusLabel}</span></td>
        </tr>
    )
}

function ActivityCard({ activity, enrolled, onJoin, onWithdraw, joining }) {
    const { id, name, description, category, schedule, venue, max_members, enrolled_count, teacher_name, is_full } = activity
    return (
        <div className="card mb-1 actcard">
            <div className="actcard-row">
                <div>
                    <div className="actcard-name">{name}</div>
                    <div className="actcard-cat">
                        {category} {schedule ? `· ${schedule}` : ''} {venue ? `· ${venue}` : ''}
                    </div>
                    {description && <p className="actcard-desc">{description}</p>}
                    <div className="actcard-meta">
                        {teacher_name && <span>Coordinator: {teacher_name}</span>}
                        {max_members && <span className="actcard-meta-count">{enrolled_count}/{max_members} members</span>}
                    </div>
                </div>
                <div className="u-shrink-0">
                    {enrolled ? (
                        <button
                            className="btn btn-sm btn-outline"
                            onClick={() => onWithdraw(id)}
                            disabled={joining === id}
                        >
                            {joining === id ? 'Withdrawing…' : 'Withdraw'}
                        </button>
                    ) : is_full ? (
                        <span className="badge badge-soft-warning">Full</span>
                    ) : (
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onJoin(id)}
                            disabled={joining === id}
                        >
                            {joining === id ? 'Joining…' : 'Join'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export function StudentActivities() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [mainTab,    setMainTab]    = useState('Discipline Records')
    const [typeFilter, setTypeFilter] = useState('All')
    const [profile,    setProfile]    = useState(null)
    const [discipline, setDiscipline] = useState(null)
    const [activities, setActivities] = useState(null)
    const [events,     setEvents]     = useState([])
    const [loading,    setLoading]    = useState(true)
    const [joining,    setJoining]    = useState(null)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim()
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()

    useEffect(() => {
        Promise.all([
            getStudentProfile().catch(() => null),
            getStudentDiscipline().catch(() => null),
            getStudentActivities().catch(() => null),
            getStudentActivityEvents().catch(() => []),
        ]).then(([prof, disc, act, ev]) => {
            setProfile(prof)
            setDiscipline(disc)
            setActivities(act)
            setEvents(Array.isArray(ev) ? ev : [])
        }).finally(() => setLoading(false))
    }, [])

    const gradeSection = profile ? `${profile.grade}${profile.section}` : ''
    const userRole     = gradeSection ? `Student · ${gradeSection}` : 'Student'

    const reports  = discipline?.reports || []
    const conductGrade = discipline?.conduct_grade || '-'
    const conductLabel = discipline?.conduct_label || ''

    const positiveCount = reports.filter(r => r.report_type === 'positive' || r.report_type === 'achievement').length
    const negativeCount = reports.filter(r => r.report_type === 'incident' || r.report_type === 'warning').length

    const filteredReports = reports.filter(r => typeFilterMatch(r, typeFilter))

    function countForType(t) {
        if (t === 'All') return reports.length
        return reports.filter(r => typeFilterMatch(r, t)).length
    }

    async function handleJoin(id) {
        setJoining(id)
        try {
            await joinActivity(id)
            const updated = await getStudentActivities().catch(() => activities)
            setActivities(updated)
        } catch {
            // join error silently ignored
        } finally {
            setJoining(null)
        }
    }

    async function handleWithdraw(id) {
        setJoining(id)
        try {
            await withdrawActivity(id)
            const updated = await getStudentActivities().catch(() => activities)
            setActivities(updated)
        } catch {
            // withdraw error silently ignored
        } finally {
            setJoining(null)
        }
    }

    const enrolled  = activities?.enrolled  || []
    const available = activities?.available || []

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Activities & Discipline"
                        subtitle="Behaviour record and extracurricular activities"
                        userName={fullName}
                        userRole={userRole}
                        userInitials={initials}
                        avatarClass="student-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        {/* Conduct summary */}
                        <div className="behavior-score-card">
                            <div className="score-ring-wrap">
                                <svg width="90" height="90" viewBox="0 0 90 90">
                                    <circle className="score-ring-bg" cx="45" cy="45" r="36" />
                                    <circle className="score-ring-fg" cx="45" cy="45" r="36"
                                        strokeDasharray="226"
                                        strokeDashoffset={loading ? 226 : Math.max(226 - (positiveCount * 20), 0)} />
                                </svg>
                                <div className="score-ring-label">{loading ? '-' : conductGrade}<small>/term</small></div>
                            </div>
                            <div className="score-info">
                                <div className="score-title">Conduct Grade (Current Term)</div>
                                <span className={`score-status ${conductGrade === 'A' || conductGrade === 'B' ? 'good' : 'warning'}`}>
                                    {loading ? '-' : conductLabel}
                                </span>
                                <div className="score-breakdown">
                                    <span className="score-breakdown-item score-pos">
                                        <span className="material-symbols-rounded">add_circle</span>
                                        {loading ? '-' : `${positiveCount} positive record${positiveCount !== 1 ? 's' : ''}`}
                                    </span>
                                    <span className="score-breakdown-item score-neg">
                                        <span className="material-symbols-rounded">remove_circle</span>
                                        {loading ? '-' : `${negativeCount} warning${negativeCount !== 1 ? 's' : ''}`}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Tab toolbar */}
                        <div className="toolbar-card">
                            {MAIN_TABS.map(tab => (
                                <button
                                    key={tab}
                                    className={`btn ${mainTab === tab ? 'btn-primary' : 'btn-outline'} act-main-tab`}
                                    onClick={() => setMainTab(tab)}
                                >
                                    {tab}
                                </button>
                            ))}
                            {mainTab === 'Discipline Records' && (
                                <>
                                    <div className="vdivider" />
                                    {TYPE_TABS.map(t => (
                                        <button
                                            key={t}
                                            className={`btn ${typeFilter === t ? 'btn-primary' : 'btn-outline'} act-type-tab`}
                                            onClick={() => setTypeFilter(t)}
                                        >
                                            {t}
                                            <span className="tab-count-sm">{countForType(t)}</span>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Tab: Discipline Records */}
                        {mainTab === 'Discipline Records' && (
                            loading ? (
                                <p className="u-pad u-muted">Loading records…</p>
                            ) : filteredReports.length === 0 ? (
                                <EmptyState
                                    icon="verified_user"
                                    title={`No ${typeFilter.toLowerCase()} records`}
                                    description="No discipline records match this filter."
                                    action={{ label: 'Show All', icon: 'refresh', onClick: () => setTypeFilter('All') }}
                                />
                            ) : (
                                <div className="act-list-card">
                                    <div className="act-list-header">
                                        <div className="act-list-title">Behavior &amp; Discipline Records</div>
                                        <span className="act-list-count">{filteredReports.length} record{filteredReports.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="table-responsive">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Date</th><th>Type</th><th>Description</th>
                                                    <th>Recorded By</th><th>Points</th><th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredReports.map(r => <DisciplineRow key={r.id} report={r} />)}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )
                        )}

                        {/* Tab: Extracurricular Activities */}
                        {mainTab === 'Extracurricular Activities' && (
                            loading ? (
                                <p className="u-pad u-muted">Loading activities…</p>
                            ) : (enrolled.length === 0 && available.length === 0) ? (
                                <EmptyState
                                    icon="sports_soccer"
                                    title="No activities available"
                                    description="Extracurricular activities will appear here when they are available."
                                />
                            ) : (
                                <>
                                    {enrolled.length > 0 && (
                                        <div className="act-list-card mb-1-5">
                                            <div className="act-list-header">
                                                <div className="act-list-title">My Enrolled Activities</div>
                                                <span className="act-list-count">{enrolled.length}</span>
                                            </div>
                                            {enrolled.map(a => (
                                                <ActivityCard key={a.id} activity={a} enrolled onWithdraw={handleWithdraw} joining={joining} />
                                            ))}
                                        </div>
                                    )}
                                    {available.length > 0 && (
                                        <div className="act-list-card">
                                            <div className="act-list-header">
                                                <div className="act-list-title">Available Activities</div>
                                                <span className="act-list-count">{available.length}</span>
                                            </div>
                                            {available.map(a => (
                                                <ActivityCard key={a.id} activity={a} enrolled={false} onJoin={handleJoin} joining={joining} />
                                            ))}
                                        </div>
                                    )}
                                </>
                            )
                        )}

                        {/* Tab: Upcoming Events */}
                        {mainTab === 'Upcoming Events' && (
                            loading ? (
                                <p className="u-pad u-muted">Loading events…</p>
                            ) : events.length === 0 ? (
                                <EmptyState
                                    icon="event"
                                    title="No upcoming events"
                                    description="Events for your enrolled activities will appear here."
                                />
                            ) : (
                                <div className="act-list-card">
                                    <div className="act-list-header">
                                        <div className="act-list-title">Upcoming Activity Events</div>
                                        <span className="act-list-count">{events.length}</span>
                                    </div>
                                    {events.map(ev => {
                                        const dateStr = ev.date
                                            ? new Date(ev.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                                            : '-'
                                        return (
                                            <div key={ev.id} className="assign-item act-event-item">
                                                <span className="assign-subject-dot schedule-dot-teal"></span>
                                                <div className="assign-info">
                                                    <div className="assign-title">{ev.title || ev.activity_name}</div>
                                                    <div className="assign-subject">
                                                        {ev.activity_name}{ev.venue ? ` · ${ev.venue}` : ''}
                                                        {ev.start_time ? ` · ${ev.start_time.slice(0,5)}` : ''}
                                                        {ev.end_time   ? `-${ev.end_time.slice(0,5)}`    : ''}
                                                    </div>
                                                </div>
                                                <span className="assign-due due-later">{dateStr}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
