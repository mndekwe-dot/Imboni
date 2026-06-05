import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { TeacherScheduleGrid } from '../../components/timetable/TeacherScheduleGrid'
import { WeekPicker } from '../../components/timetable/weekPicker'
import { getThisMonday } from '../../components/timetable/dateUtils'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

export function TeacherTimetable() {
    const [currentMonday, setCurrentMonday] = useState(() => getThisMonday())

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Teacher'
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="My Timetable"
                        subtitle="Your weekly teaching schedule"
                        userName={fullName}
                        userRole="Teacher"
                        userInitials={initials}
                        avatarClass="teacher-av"
                    />
                    <DashboardContent>

                        <div className="tt-notice">
                            <span className="material-symbols-rounded">lock</span>
                            <div>
                                <strong>Read-only</strong> — Your timetable is set by the Director of Studies. Contact DOS to request changes.
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <WeekPicker currentMonday={currentMonday} onChange={setCurrentMonday} />
                            </div>
                            <div className="card-content">
                                <TeacherScheduleGrid currentMonday={currentMonday} />
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
