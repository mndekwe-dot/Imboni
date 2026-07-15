import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { Timetable } from '../../components/timetable/Timetable'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { getStudentProfile } from '../../api/student'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'

export function StudentTimetable() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim()
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()

    useEffect(() => {
        getStudentProfile()
            .then(setProfile)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const gradeSection = profile ? `${profile.grade}${profile.section}` : null
    const userRole     = gradeSection ? `Student · ${gradeSection}` : 'Student'

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="My Timetable"
                        subtitle={gradeSection ? `Class ${gradeSection} — Weekly Schedule` : 'Weekly Schedule'}
                        userName={fullName}
                        userRole={userRole}
                        userInitials={initials}
                        avatarClass="student-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {loading ? (
                            <p className="u-pad u-muted">Loading…</p>
                        ) : !gradeSection ? (
                            <p className="u-pad u-muted">Could not load class information.</p>
                        ) : (
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Class {gradeSection} — Weekly Schedule</h2>
                                </div>
                                <div className="card-content">
                                    <Timetable type="academic" classId={gradeSection} />
                                </div>
                            </div>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
