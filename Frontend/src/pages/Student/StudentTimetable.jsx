import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { Timetable } from '../../components/timetable/Timetable'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'
import { studentNavItems, studentSecondaryItems, studentUser } from './studentNav'


// Student's assigned class — replace with auth profile data later
const MY_CLASS = 'S4A'

export function StudentTimetable() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="My Timetable"
                        subtitle={`Class ${MY_CLASS} — Term 2, 2026`}
                        userName="Uwase Amina"
                        userRole={`Student · ${MY_CLASS}`}
                        userInitials="UA"
                        avatarClass="student-av"
                    />
                    <div className="dashboard-content">
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Class {MY_CLASS} — Weekly Schedule</h2>
                            </div>
                            <div className="card-content">
                                {/* editable not passed → defaults to false — students cannot edit */}
                                <Timetable type="academic" classId={MY_CLASS} />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    )
}
