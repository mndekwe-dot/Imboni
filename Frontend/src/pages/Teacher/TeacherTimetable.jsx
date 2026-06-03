import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { Timetable } from '../../components/timetable/Timetable'
import { TeacherScheduleGrid } from '../../components/timetable/TeacherScheduleGrid'
import { WeekPicker } from '../../components/timetable/weekPicker'
import { getThisMonday } from '../../components/timetable/dateUtils'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { getTeacherMyClasses } from '../../api/teacher'

export function TeacherTimetable() {
    const [view,          setView]          = useState('schedule')
    const [classId,       setClassId]       = useState('')
    const [currentMonday, setCurrentMonday] = useState(() => getThisMonday())
    const [myClasses,     setMyClasses]     = useState([])

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Teacher'
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    useEffect(() => {
        getTeacherMyClasses()
            .then(data => {
                const list = Array.isArray(data) ? data.map(c => c.class_name) : []
                setMyClasses(list)
                if (list.length > 0 && !classId) setClassId(list[0])
            })
            .catch(() => {})
    }, [])

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
                                <strong>Read-only timetable</strong> — Issued by the Director of Studies. Contact DOS to request changes.
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <div className="btn-row-sm">
                                    <button
                                        className={`btn btn-sm ${view === 'schedule' ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => setView('schedule')}
                                    >
                                        <span className="material-symbols-rounded icon-sm">person</span>
                                        My Schedule
                                    </button>
                                    <button
                                        className={`btn btn-sm ${view === 'class' ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => setView('class')}
                                    >
                                        <span className="material-symbols-rounded icon-sm">groups</span>
                                        Class View
                                    </button>
                                </div>

                                {view === 'schedule' && (
                                    <WeekPicker currentMonday={currentMonday} onChange={setCurrentMonday} />
                                )}
                                {view === 'class' && myClasses.length > 0 && (
                                    <div className="flex-row-gap-sm">
                                        <label className="form-label mb-0 whitespace-nowrap">Class:</label>
                                        <select
                                            className="form-control"
                                            style={{ width: 'auto', minWidth: 80 }}
                                            value={classId}
                                            onChange={e => setClassId(e.target.value)}
                                        >
                                            {myClasses.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="card-content">
                                {view === 'schedule' ? (
                                    <TeacherScheduleGrid
                                        teacherId="T001"
                                        currentMonday={currentMonday}
                                    />
                                ) : (
                                    classId ? (
                                        <Timetable type="academic" classId={classId} editable={false} />
                                    ) : (
                                        <p style={{ color: 'var(--muted-foreground)', padding: '2rem' }}>No classes found.</p>
                                    )
                                )}
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
