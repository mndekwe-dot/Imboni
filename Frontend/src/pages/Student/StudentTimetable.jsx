import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { Timetable } from '../../components/timetable/Timetable'
import { getThisMonday } from '../../components/timetable/dateUtils'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { getStudentTimetable } from '../../api/student'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'

/**
 * The student's class week, as the DOS built it. It used to render the static
 * sample timetable keyed by class name, so every student saw invented lessons.
 */
export function StudentTimetable() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [currentMonday, setCurrentMonday] = useState(() => getThisMonday())
    const [data,    setData]    = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(false)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim()
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()

    useEffect(() => {
        getStudentTimetable()
            .then(setData)
            .catch(() => setError(true))
            .finally(() => setLoading(false))
    }, [])

    const className = data?.class || ''
    // The class is in the header; each lesson's second line is its teacher.
    const slots = useMemo(() => (data?.slots || []).map(s => ({ ...s, class_name: '' })), [data])
    const userRole  = className ? `${t('roles.student')} · ${className}` : t('roles.student')

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('student.timetable.title')}
                        subtitle={className
                            ? t('student.timetable.subtitleWithClass', { class: className })
                            : t('student.timetable.subtitle')}
                        userName={fullName}
                        userRole={userRole}
                        userInitials={initials}
                        avatarClass="student-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        <div className="card">
                            <div className="card-content">
                                {loading ? (
                                    <p className="u-pad u-muted">{t('common.loading')}</p>
                                ) : error ? (
                                    <p className="u-pad u-muted">{t('student.timetable.loadError')}</p>
                                ) : (
                                    <Timetable
                                        type="teacher"
                                        teacherSlots={slots}
                                        freeLabel=""
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
