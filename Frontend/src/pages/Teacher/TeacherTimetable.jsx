import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { Timetable } from '../../components/timetable/Timetable'
import { TeacherScheduleGrid } from '../../components/timetable/TeacherScheduleGrid'
import { WeekPicker } from '../../components/timetable/weekPicker'
import { getThisMonday } from '../../components/timetable/dateUtils'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


// Classes this teacher is assigned to — T001 Mr. Pacifique Rurangwa teaches Math
const MY_CLASSES = ['S1A', 'S1B', 'S2A', 'S2B', 'S3A', 'S4A', 'S4B', 'S5B']

const timetableStats = [
    { colorClass: 'info',    icon: 'school',           value: '28', label: 'Lessons / Week', trend: 'This term'  },
    { colorClass: 'success', icon: 'menu_book',        value: '8',  label: 'Classes Taught',  trend: 'S1A – S5B' },
    { colorClass: 'warning', icon: 'self_improvement', value: '6',  label: 'Prep Periods',    trend: 'Per week'  },
    { colorClass: '',        icon: 'coffee',           value: '6',  label: 'Free Periods',    trend: 'Per week'  },
]

export function TeacherTimetable() {
    const [view, setView]           = useState('schedule')   // 'schedule' | 'class'
    const [classId, setClassId]     = useState('S3A')
    const [currentMonday, setCurrentMonday] = useState(() => getThisMonday())

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="My Timetable"
                        subtitle="Your weekly teaching schedule — Term 2, 2026"
                        name="Mr. Pacifique Rurangwa"
                        role="Teacher · Mathematics"
                        initials="PR"
                        avatarClass="teacher-av"
                    />
                    <DashboardContent>

                        {/* Read-only notice */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--teacher-light)', border: '1px solid var(--teacher)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: 'var(--teacher-hover)' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '1.2rem' }}>lock</span>
                            <div>
                                <strong>Read-only timetable</strong> — Issued by Dr. I. Nsabimana (DOS). Contact the Director of Studies to request changes.
                            </div>
                        </div>

                        <div className="portal-stat-grid" style={{ marginBottom: '1.25rem' }}>
                            {timetableStats.map((stat, i) => (
                                <StatCard key={i} {...stat} />
                            ))}
                        </div>

                        <div className="card">
                            <div className="card-header">
                                {/* View toggle — left */}
                                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
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

                                {/* Right controls — week picker or class selector */}
                                {view === 'schedule' && (
                                    <WeekPicker
                                        currentMonday={currentMonday}
                                        onChange={setCurrentMonday}
                                    />
                                )}
                                {view === 'class' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Class:</label>
                                        <select
                                            className="form-control"
                                            style={{ width: 'auto', minWidth: 80 }}
                                            value={classId}
                                            onChange={e => setClassId(e.target.value)}
                                        >
                                            {MY_CLASSES.map(c => (
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
                                    <Timetable
                                        type="academic"
                                        classId={classId}
                                        editable={false}
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
