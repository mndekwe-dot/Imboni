import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { AttendanceRecord } from '../../components/attendance/AttendanceRecord'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { getStudentProfile, getStudentAttendanceStats, getStudentAttendanceCalendar } from '../../api/student'
import { useToast } from '../../context/ToastContext'
import { errorMessage, partialLoad } from '../../utils/errors'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'

/* The endpoint wraps the month's records; the shared record wants the list. */
const loadMonth = (year, month) =>
    getStudentAttendanceCalendar(month, year).then(cal => cal?.records ?? [])

export function StudentAttendance() {
    const { t } = useTranslation()
    const toast = useToast()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [profile, setProfile] = useState(null)
    const [stats,   setStats]   = useState(null)
    const [loading, setLoading] = useState(true)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim()
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()

    useEffect(() => {
        Promise.all([
            getStudentProfile().catch(partialLoad(toast, null)),
            getStudentAttendanceStats().catch(e => {
                toast.error(errorMessage(e, t('attendance.loadFailed')))
                return null
            }),
        ]).then(([prof, s]) => {
            setProfile(prof)
            setStats(s)
        }).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const gradeSection = profile ? `${profile.grade}${profile.section}` : ''
    const userRole     = gradeSection
        ? `${t('roles.student')} · ${gradeSection}`
        : t('roles.student')

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.attendance')}
                        subtitle={gradeSection
                            ? t('attendance.subtitleWithClass', { class: gradeSection })
                            : t('attendance.subtitle')}
                        userName={fullName}
                        userRole={userRole}
                        userInitials={initials}
                        avatarClass="student-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        <AttendanceRecord stats={stats} loading={loading} loadMonth={loadMonth} />
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
