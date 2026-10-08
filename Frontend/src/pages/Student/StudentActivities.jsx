import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSection } from '../../components/ui/ListSection'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { formatWeekdayShort } from '../../utils/date'
import {
    getStudentProfile,
    getStudentActivities, getStudentActivityEvents,
    joinActivity, withdrawActivity,
} from '../../api/student'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'
import { useToast } from '../../context/ToastContext'
import { partialLoad, errorMessage } from '../../utils/errors'

const TAB_ACTIVITIES = 'activities'
const TAB_EVENTS     = 'events'

function ActivityCard({ activity, enrolled, onJoin, onWithdraw, joining }) {
    const { t } = useTranslation()
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
                        {teacher_name && <span>{t('student.activities.coordinator', { name: teacher_name })}</span>}
                        {max_members && <span className="actcard-meta-count">{t('student.activities.members', { count: enrolled_count, max: max_members })}</span>}
                    </div>
                </div>
                <div className="u-shrink-0">
                    {enrolled ? (
                        <button
                            className="btn btn-sm btn-outline"
                            onClick={() => onWithdraw(activity)}
                            disabled={joining === id}
                        >
                            {joining === id ? t('student.activities.withdrawing') : t('common.withdraw')}
                        </button>
                    ) : is_full ? (
                        <span className="badge badge-soft-warning">{t('common.full')}</span>
                    ) : (
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onJoin(activity)}
                            disabled={joining === id}
                        >
                            {joining === id ? t('student.activities.joining') : t('common.join')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export function StudentActivities() {
    const toast = useToast()
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [mainTab,    setMainTab]    = useState(TAB_ACTIVITIES)
    const [profile,    setProfile]    = useState(null)
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
            getStudentProfile().catch(partialLoad(toast, null)),
            getStudentActivities().catch(partialLoad(toast, null)),
            getStudentActivityEvents().catch(partialLoad(toast, [])),
        ]).then(([prof, act, ev]) => {
            setProfile(prof)
            setActivities(act)
            setEvents(Array.isArray(ev) ? ev : [])
        }).finally(() => setLoading(false))
    }, [toast])

    const gradeSection = profile ? `${profile.grade}${profile.section}` : ''
    const userRole     = gradeSection
        ? `${t('roles.student')} · ${gradeSection}`
        : t('roles.student')

    // Join and withdraw are the same move in opposite directions: run it, say
    // what happened, then reload so the enrolled/available split is the server's.
    async function change(activity, action, okKey, failKey) {
        setJoining(activity.id)
        try {
            await action(activity.id)
            toast.success(t(okKey, { name: activity.name }))
            const updated = await getStudentActivities().catch(partialLoad(toast, activities))
            setActivities(updated)
        } catch (e) {
            toast.error(errorMessage(e, t(failKey)))
        } finally {
            setJoining(null)
        }
    }

    const handleJoin     = activity => change(activity, joinActivity,     'student.activities.joined',    'student.activities.joinFailed')
    const handleWithdraw = activity => change(activity, withdrawActivity, 'student.activities.withdrawn', 'student.activities.withdrawFailed')

    const enrolled  = activities?.enrolled  || []
    const available = activities?.available || []

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('student.activities.title')}
                        subtitle={t('student.activities.subtitle')}
                        userName={fullName}
                        userRole={userRole}
                        userInitials={initials}
                        avatarClass="student-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <div className="toolbar-card">
                            {[[TAB_ACTIVITIES, 'tabActivities'], [TAB_EVENTS, 'tabEvents']].map(([tab, key]) => (
                                <button
                                    key={tab}
                                    className={`btn ${mainTab === tab ? 'btn-primary' : 'btn-outline'} act-main-tab`}
                                    onClick={() => setMainTab(tab)}
                                >
                                    {t(`student.activities.${key}`)}
                                </button>
                            ))}
                        </div>

                        {/* Tab: Extracurricular Activities */}
                        {mainTab === TAB_ACTIVITIES && (
                            loading ? (
                                <p className="u-pad u-muted">{t('student.activities.loadingActivities')}</p>
                            ) : (enrolled.length === 0 && available.length === 0) ? (
                                <EmptyState
                                    icon="sports_soccer"
                                    title={t('student.activities.noneFound')}
                                    description={t('student.activities.noneDesc')}
                                />
                            ) : (
                                <>
                                    {enrolled.length > 0 && (
                                        <ListSection
                                            className="mb-1-5"
                                            icon="check_circle"
                                            title={t('student.activities.enrolled')}
                                            count={enrolled.length}
                                        >
                                            {enrolled.map(a => (
                                                <ActivityCard key={a.id} activity={a} enrolled onWithdraw={handleWithdraw} joining={joining} />
                                            ))}
                                        </ListSection>
                                    )}
                                    {available.length > 0 && (
                                        <ListSection
                                            icon="sports_soccer"
                                            title={t('student.activities.available')}
                                            count={available.length}
                                        >
                                            {available.map(a => (
                                                <ActivityCard key={a.id} activity={a} enrolled={false} onJoin={handleJoin} joining={joining} />
                                            ))}
                                        </ListSection>
                                    )}
                                </>
                            )
                        )}

                        {/* Tab: Upcoming Events */}
                        {mainTab === TAB_EVENTS && (
                            loading ? (
                                <p className="u-pad u-muted">{t('student.activities.loadingEvents')}</p>
                            ) : events.length === 0 ? (
                                <EmptyState
                                    icon="event"
                                    title={t('student.activities.noEvents')}
                                    description={t('student.activities.noEventsDesc')}
                                />
                            ) : (
                                <ListSection
                                    icon="event"
                                    title={t('student.activities.upcomingEvents')}
                                    count={events.length}
                                    pad={false}
                                >
                                    {events.map(ev => {
                                        const dateStr = ev.date
                                            ? formatWeekdayShort(ev.date)
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
                                </ListSection>
                            )
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
