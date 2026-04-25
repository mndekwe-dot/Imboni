import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { EmptyState } from '../../components/ui/EmptyState'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import '../../styles/pages.css'
import { matronNavItems, matronSecondaryItems, matronUser } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const students = [
    { initials: 'UA', name: 'Uwase Amina',         id: '2024-001',              year: 'S4', classLetter: 'A', classBadge: 'S4A', room: 'Room 14B', dining: 'Table 7, Seat 3', house: 'Karisimbi', tonightClass: 'present', tonight: 'Present', action: 'none'           },
    { initials: 'MK', name: 'Mukamazimpaka Joy',   id: '2022-015 \u00b7 Prefect',year: 'S5', classLetter: 'A', classBadge: 'S5A', room: 'Room 12A', dining: 'Table 1, Seat 1', house: 'Karisimbi', tonightClass: 'present', tonight: 'Present', action: 'none'           },
    { initials: 'NI', name: 'Niyomugabo Iris',     id: '2025-014',              year: 'S2', classLetter: 'A', classBadge: 'S2A', room: 'Room 8C',  dining: 'Table 9, Seat 4', house: 'Karisimbi', tonightClass: 'late',    tonight: 'Late',    action: 'report-outline' },
    { initials: 'KU', name: 'Kayitesi Ursula',     id: '2024-078',              year: 'S3', classLetter: 'B', classBadge: 'S3B', room: 'Room 9A',  dining: 'Table 5, Seat 2', house: 'Karisimbi', tonightClass: 'absent',  tonight: 'Absent',  action: 'report-primary' },
    { initials: 'IB', name: 'Ingabire Belise',     id: '2023-042',              year: 'S4', classLetter: 'A', classBadge: 'S4A', room: 'Room 7B',  dining: 'Table 3, Seat 5', house: 'Karisimbi', tonightClass: 'present', tonight: 'Present', action: 'none'           },
    { initials: 'MB', name: 'Mukamana Brigitte',   id: '2023-061',              year: 'S4', classLetter: 'A', classBadge: 'S4A', room: 'Room 6C',  dining: 'Table 4, Seat 1', house: 'Karisimbi', tonightClass: 'present', tonight: 'Present', action: 'none'           },
    { initials: 'NN', name: 'Nzeyimana Naomie',    id: '2026-003',              year: 'S1', classLetter: 'A', classBadge: 'S1A', room: 'Room 3A',  dining: 'Table 11, Seat 2', house: 'Karisimbi', tonightClass: 'present', tonight: 'Present', action: 'none'          },
    { initials: 'RN', name: 'Rugamba Nadine',       id: '2026-017',              year: 'S1', classLetter: 'B', classBadge: 'S1B', room: 'Room 3B',  dining: 'Table 11, Seat 4', house: 'Karisimbi', tonightClass: 'present', tonight: 'Present', action: 'none'          },
    { initials: 'NE', name: 'Ndayishimiye Elise',  id: '2025-031',              year: 'S2', classLetter: 'A', classBadge: 'S2A', room: 'Room 5A',  dining: 'Table 8, Seat 1', house: 'Karisimbi', tonightClass: 'present', tonight: 'Present', action: 'none'           },
    { initials: 'UG', name: 'Uwimana Generose',    id: '2021-008 \u00b7 Head Girl', year: 'S6', classLetter: 'A', classBadge: 'S6A', room: 'Room 16A', dining: 'Table 2, Seat 1', house: 'Karisimbi', tonightClass: 'present', tonight: 'Present', action: 'none'   },
]

const tonightIcons = { present: 'check_circle', late: 'schedule', absent: 'cancel' }

function StudentStat({ colorClass, iconClass, icon, value, label }) {
    return (
        <div className={`matron-stat-card${colorClass ? ` ${colorClass}` : ''}`}>
            <div className={`matron-stat-icon${iconClass ? ` ${iconClass}` : ''}`}>
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div>
                <div className="matron-stat-value">{value}</div>
                <div className="matron-stat-label">{label}</div>
            </div>
        </div>
    )
}

function StudentRow({ initials, name, id, year, classLetter, classBadge, room, dining, house, tonightClass, tonight, action }) {
    return (
        <tr data-year={year} data-classletter={classLetter} data-dorm="kigoma" data-name={name.toLowerCase()}>
            <td>
                <div className="stu-cell">
                    <div className="stu-av">{initials}</div>
                    <div>
                        <div className="stu-name">{name}</div>
                        <div className="stu-id">{id}</div>
                    </div>
                </div>
            </td>
            <td><span className="class-badge">{classBadge}</span></td>
            <td>{room}</td>
            <td>{dining}</td>
            <td>{house}</td>
            <td>
                <span className={`status-pill ${tonightClass}`}>
                    <span className="material-symbols-rounded">{tonightIcons[tonightClass]}</span>{tonight}
                </span>
            </td>
            <td>
                {action === 'none' && <span>&mdash;</span>}
                {action === 'report-outline' && <button className="btn btn-sm btn-outline"><span className="material-symbols-rounded">report</span> Report</button>}
                {action === 'report-primary' && <button className="btn btn-sm btn-primary"><span className="material-symbols-rounded">report</span> Report</button>}
            </td>
        </tr>
    )
}

export function MatronStudents() {
    const { config } = useSchoolConfig()
    const [section, setSection] = useState('')
    const [year, setYear] = useState('')
    const [classVal, setClassVal] = useState('')

    const visibleStudents = students.filter(s => {
        if (year && s.year !== year) return false
        if (classVal && s.classLetter !== classVal) return false
        return true
    })

    const studentStats = [
        { colorClass: '',      iconClass: '',      icon: 'groups',       value: visibleStudents.length,                                                label: 'Total Students'  },
        { colorClass: 'green', iconClass: 'green', icon: 'check_circle', value: visibleStudents.filter(s => s.tonightClass === 'present').length,      label: 'Present Tonight' },
        { colorClass: 'red',   iconClass: 'red',   icon: 'cancel',       value: visibleStudents.filter(s => s.tonightClass === 'absent').length,       label: 'Absent'          },
        { colorClass: '',      iconClass: '',      icon: 'meeting_room', value: [...new Set(visibleStudents.map(s => s.room))].length,                 label: 'Rooms Occupied'  },
    ]

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}><span className="material-symbols-rounded">menu</span></button>
                        <div className="dashboard-header-title">
                            <h1>My Students</h1>
                            <p>Karisimbi House &mdash; 10 students</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Monday, March 09, 2026</span>
                            <button className="notification-btn">
                                <span className="material-symbols-rounded">notifications</span>
                                <span className="notification-badge">2</span>
                            </button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Mrs. Gloriose Hakizimana</span>
                                    <span className="header-user-role">Matron</span>
                                </div>
                                <div className="header-user-av matron-av">GH</div>
                            </div>
                        </div>
                    </header>

                    <DashboardContent>

                        <ClassPicker
                            sections={config.sections}
                            section={section} onSectionChange={setSection}
                            year={year} onYearChange={setYear}
                            classVal={classVal} onClassChange={setClassVal}
                        />

                        <div className="matron-stat-grid" style={{ marginBottom: '1.25rem' }}>
                            {studentStats.map((stat, index) => (
                                <StudentStat key={index} {...stat} />
                            ))}
                        </div>

                        {/* Toolbar container */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            flexWrap: 'wrap', margin: '1rem 0',
                            background: 'var(--card)', border: '1px solid var(--border)',
                            borderRadius: 16, padding: '0.75rem 1rem',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                        }}>
                            <div className="search-bar-wrap" style={{ flex: 1, minWidth: 220 }}>
                                <span className="material-symbols-rounded">search</span>
                                <input type="text" placeholder="Search by name, class or student ID..." />
                            </div>
                            <div style={{ flex: 1 }} />
                            <button className="btn btn-outline" style={{ fontSize: '0.82rem' }}>
                                <span className="material-symbols-rounded icon-sm">download</span> Export List
                            </button>
                            <button className="btn btn-outline" style={{ fontSize: '0.82rem' }}>
                                <span className="material-symbols-rounded icon-sm">print</span> Print Roll
                            </button>
                        </div>

                        {visibleStudents.length === 0 ? (
                            <EmptyState
                                icon="people"
                                title="No students found"
                                description="No students match the selected class filter."
                            />
                        ) : (
                            <div style={{
                                background: 'var(--card)', border: '1px solid var(--border)',
                                borderRadius: 16, overflow: 'hidden',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
                                }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Karisimbi House Students</div>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
                                        {visibleStudents.length} student{visibleStudents.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="table-responsive">
                                    <table className="students-list-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Class</th>
                                                <th>Room</th>
                                                <th>Dining</th>
                                                <th>Dormitory</th>
                                                <th>Tonight</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleStudents.map((student, index) => (
                                                <StudentRow key={index} {...student} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
