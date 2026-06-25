import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { DataTable } from '../../components/ui/DataTable'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import '../../styles/pages.css'
import { matronNavItems, matronSecondaryItems, matronUser } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { formatSchoolDate } from '../../utils/date'
import { getMatronStudents } from '../../api/matron'
import { useSessionUser } from '../../hooks/useSessionUser'


function initialsOf(name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

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

function StudentRow({ initials, name, studentCode, year, classBadge, room, dormitory, boardingType }) {
    return (
        <tr data-year={year} data-name={name.toLowerCase()}>
            <td>
                <div className="stu-cell">
                    <div className="stu-av">{initials}</div>
                    <div>
                        <div className="stu-name">{name}</div>
                        <div className="stu-id">{studentCode}</div>
                    </div>
                </div>
            </td>
            <td><span className="class-badge">{classBadge}</span></td>
            <td>{room}</td>
            <td>{dormitory}</td>
            <td style={{ textTransform: 'capitalize' }}>{boardingType}</td>
        </tr>
    )
}

export function MatronStudents() {
    const sessionUser = useSessionUser()
    const { config } = useSchoolConfig()
    const { setting } = useSchoolSettings()
    const [section, setSection] = useState('')
    const [year, setYear] = useState('')
    const [classVal, setClassVal] = useState('')
    const [search, setSearch] = useState('')
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        getMatronStudents(search ? { search } : undefined)
            .then(data => setStudents(Array.isArray(data) ? data : []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [search])

    const visibleStudents = students
        .map(s => ({
            initials: initialsOf(s.full_name),
            name: s.full_name,
            studentCode: s.student_code,
            year: `S${s.grade}`,
            classLetter: s.section,
            classBadge: `S${s.grade}${s.section}`,
            room: s.room_number,
            dormitory: s.dormitory,
            boardingType: s.boarding_type,
        }))
        .filter(s => {
            if (year && s.year !== year) return false
            if (classVal && s.classLetter !== classVal) return false
            return true
        })

    const studentStats = [
        { colorClass: '',      iconClass: '',      icon: 'groups',       value: visibleStudents.length,                                              label: 'Total Students'   },
        { colorClass: 'green', iconClass: 'green', icon: 'home',         value: visibleStudents.filter(s => s.boardingType === 'full').length,       label: 'Full Boarders'    },
        { colorClass: '',      iconClass: '',      icon: 'wb_sunny',     value: visibleStudents.filter(s => s.boardingType === 'day').length,        label: 'Day Boarders'     },
        { colorClass: '',      iconClass: '',      icon: 'meeting_room', value: [...new Set(visibleStudents.map(s => s.room))].length,               label: 'Rooms Occupied'   },
    ]

    if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>
    if (error) return <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>

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
                            <p>{matronUser.userRole.split('—').pop().trim()} &mdash; {visibleStudents.length} students</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">{formatSchoolDate(setting.timezone)}</span>
                            <button className="notification-btn">
                                <span className="material-symbols-rounded">notifications</span>
                                <span className="notification-badge">2</span>
                            </button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">{sessionUser.userName}</span>
                                    <span className="header-user-role">Matron</span>
                                </div>
                                <Link to="/profile?role=matron" className={`header-user-av ${sessionUser.avatarClass}`}>{sessionUser.userInitials}</Link>
                            </div>
                        </div>
                    </header>

                    <DashboardContent>

                        <ClassPicker
                            sections={config}
                            section={section} onSectionChange={setSection}
                            year={year} onYearChange={setYear}
                            classVal={classVal} onClassChange={setClassVal}
                        />

                        <div className="matron-stat-grid mb-5">
                            {studentStats.map((stat, index) => (
                                <StudentStat key={index} {...stat} />
                            ))}
                        </div>

                        <div className="toolbar-card">
                            <div className="toolbar-search">
                                <span className="material-symbols-rounded">search</span>
                                <input
                                    type="text"
                                    placeholder="Search by name or student ID..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="toolbar-spacer" />
                            <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded icon-sm">download</span> Export</button>
                            <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded icon-sm">print</span> Print Roll</button>
                        </div>

                        <DataTable
                            title={`${matronUser.userRole.split('—').pop().trim()} Students`}
                            data={visibleStudents}
                            columns={['Student','Class','Room','Dormitory','Boarding Type']}
                            renderRow={(student, index) => <StudentRow key={index} {...student} />}
                            emptyIcon="people"
                            emptyTitle="No students found"
                            emptyDesc="No students match the selected filters."
                        />

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
