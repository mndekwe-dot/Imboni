import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { Timetable } from '../../components/timetable/Timetable'
import { getThisMonday } from '../../components/timetable/dateUtils'
import { getTeacherTimetable } from '../../api/teacher'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

/**
 * The teacher's own weekly timetable.
 *
 * Renders the same <Timetable> the DOS, Discipline, Student and Parent portals
 * render. It used to have a grid of its own, which is why it was the one
 * timetable in the app with no subject colours, no home-room line, no "Now"
 * marker and no period labels. The teacher's rows come from the backend rather
 * than the static data the others read, so they are pivoted into that grid's
 * shape on the way in — see components/timetable/teacherSchedule.js.
 */
export function TeacherTimetable() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [currentMonday, setCurrentMonday] = useState(() => getThisMonday())
    const [slots,   setSlots]   = useState([])
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Teacher'
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    useEffect(() => {
        getTeacherTimetable()
            .then(data => setSlots(Array.isArray(data) ? data : (data?.results ?? [])))
            .catch(() => setError(t('teacher.timetable.loadFailed')))
            .finally(() => setLoading(false))
    }, [t])

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('teacher.timetable.title')}
                        subtitle={t('teacher.timetable.subtitle')}
                        userName={fullName}
                        userRole={t('roles.teacher')}
                        userInitials={initials}
                        avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <div className="tt-notice">
                            <span className="material-symbols-rounded">lock</span>
                            <div>
                                <strong>{t('teacher.timetable.readOnly')}</strong>{' '}
                                {t('teacher.timetable.readOnlyNote')}
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-content">
                                {loading ? (
                                    <p className="tt-note">{t('common.loading')}</p>
                                ) : error ? (
                                    <p className="tt-note tt-note--error">{error}</p>
                                ) : (
                                    <Timetable
                                        type="teacher"
                                        teacherSlots={slots}
                                        freeLabel={t('teacher.timetable.free')}
                                        currentMonday={currentMonday}
                                        onWeekChange={setCurrentMonday}
                                    />
                                )}
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
