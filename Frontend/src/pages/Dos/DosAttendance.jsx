import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'


const attendanceStats = [
    { iconClass: 'success', icon: 'how_to_reg',         trend: 'This week',       trendClass: 'positive', value: '94%', label: 'Student Attendance Rate' },
    { iconClass: 'warning', icon: 'person_off',         trend: 'Needs follow-up', trendClass: 'negative', value: '73',  label: 'Absent Today'            },
    { iconClass: 'info',    icon: 'schedule',           trend: 'This week',       trendClass: 'neutral',  value: '18',  label: 'Late Arrivals'           },
    { iconClass: 'success', icon: 'supervisor_account', trend: 'Today',           trendClass: 'positive', value: '98%', label: 'Teacher Attendance Rate' },
]

const attendanceRows = [
    { initials: 'UA', name: 'Uwase Amina',      mon: 'present', tue: 'present', wed: 'present', thu: 'present', fri: 'present', present: 5, rate: '100%' },
    { initials: 'KM', name: 'Mutabazi Kevin',   mon: 'present', tue: 'absent',  wed: 'present', thu: 'present', fri: 'present', present: 4, rate: '80%'  },
    { initials: 'IM', name: 'Ingabire Marie',   mon: 'present', tue: 'present', wed: 'present', thu: 'present', fri: 'present', present: 5, rate: '100%' },
    { initials: 'PN', name: 'Nkurunziza Peter', mon: 'absent',  tue: 'absent',  wed: 'present', thu: 'late',    fri: 'present', present: 2, rate: '40%'  },
    { initials: 'UD', name: 'Umutoni Diane',    mon: 'present', tue: 'present', wed: 'present', thu: 'present', fri: 'present', present: 5, rate: '100%' },
    { initials: 'JB', name: 'Bizimana James',   mon: 'present', tue: 'present', wed: 'late',    thu: 'present', fri: 'present', present: 4, rate: '80%'  },
    { initials: 'HG', name: 'Hakizimana Grace', mon: 'present', tue: 'present', wed: 'present', thu: 'present', fri: 'present', present: 5, rate: '100%' },
    { initials: 'EN', name: 'Ndagijimana Eric', mon: 'excused', tue: 'present', wed: 'present', thu: 'present', fri: 'absent',  present: 3, rate: '60%'  },
]

function AttendanceStat({ iconClass, icon, trend, trendClass, value, label }) {
    return (
        <div className="stat-card">
            <div className="stat-header">
                <div className={`stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
                <span className={`stat-trend ${trendClass}`}>{trend}</span>
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    )
}

function AttendancePip({ status }) {
    const letter = { present: 'P', absent: 'A', late: 'L', excused: 'E' }[status] || status[0].toUpperCase()
    return <span className={`att-pip ${status}`}>{letter}</span>
}

function AttendanceRow({ initials, name, mon, tue, wed, thu, fri, present, rate }) {
    return (
        <tr>
            <td><div className="tm-teacher-cell"><div className="tm-av">{initials}</div><span>{name}</span></div></td>
            <td><AttendancePip status={mon} /></td>
            <td><AttendancePip status={tue} /></td>
            <td><AttendancePip status={wed} /></td>
            <td><AttendancePip status={thu} /></td>
            <td><AttendancePip status={fri} /></td>
            <td>{present}</td>
            <td>{rate}</td>
        </tr>
    )
}

export function DosAttendance() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn">
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Attendance</h1>
                            <p>Track student and teacher attendance by class</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Monday, March 09, 2026</span>
                            <button className="notification-btn">
                                <span className="material-symbols-rounded">notifications</span>
                                <span className="notification-badge">2</span>
                            </button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Dr. Jean-Claude Ndagijimana</span>
                                    <span className="header-user-role">Director of Studies</span>
                                </div>
                                <div className="header-user-av dos-av">JN</div>
                            </div>
                        </div>
                    </header>

                    <div className="dashboard-content">
                        <div className="quick-stats">
                            {attendanceStats.map((stat, index) => (
                                <AttendanceStat key={index} {...stat} />
                            ))}
                        </div>

                        {/* View Mode Toggle */}
                        <div className="att-mode-bar">
                            <button className="att-mode-btn active">
                                <span className="material-symbols-rounded">groups</span> Student Attendance
                            </button>
                            <button className="att-mode-btn">
                                <span className="material-symbols-rounded">person</span> Teacher Attendance
                            </button>
                        </div>

                        {/* Class Picker */}
                        <div className="dos-picker mt-1-5">
                            <div className="dos-picker-group">
                                <label className="dos-picker-label" htmlFor="att-section">Section</label>
                                <select className="dos-picker-select" id="att-section">
                                    <option value="ordinary">Ordinary Level</option>
                                    <option value="advanced">Advanced Level</option>
                                </select>
                            </div>
                            <span className="dos-picker-arrow material-symbols-rounded">chevron_right</span>
                            <div className="dos-picker-group">
                                <label className="dos-picker-label" htmlFor="att-year">Year</label>
                                <select className="dos-picker-select" id="att-year">
                                    <option value="S1">S1</option>
                                    <option value="S2">S2</option>
                                    <option value="S3">S3</option>
                                </select>
                            </div>
                            <span className="dos-picker-arrow material-symbols-rounded">chevron_right</span>
                            <div className="dos-picker-group">
                                <label className="dos-picker-label" htmlFor="att-class">Class</label>
                                <select className="dos-picker-select" id="att-class">
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                </select>
                            </div>
                            <div className="dos-picker-group">
                                <label className="dos-picker-label" htmlFor="att-week">Week of</label>
                                <input type="date" className="dos-picker-select" id="att-week" defaultValue="2026-03-09" />
                            </div>
                            <div className="dos-picker-badge">
                                <span className="material-symbols-rounded">fact_check</span>
                                <span>S1A &bull; Ordinary</span>
                            </div>
                        </div>

                        {/* Student Attendance Table */}
                        <div className="card mt-1-5">
                            <div className="card-header">
                                <div>
                                    <h2 className="card-title">S1A — Weekly Attendance</h2>
                                    <p className="dos-class-meta">Week: 09 Mar – 13 Mar 2026 &bull; Class Teacher: Ms. Claudine Umutoni</p>
                                </div>
                                <div className="att-legend">
                                    <span className="att-pip present">P</span> Present
                                    <span className="att-pip absent">A</span> Absent
                                    <span className="att-pip late">L</span> Late
                                    <span className="att-pip excused">E</span> Excused
                                </div>
                            </div>
                            <div className="card-content">
                                <div className="tm-table-wrap">
                                    <table className="tm-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th>
                                                <th>Present</th>
                                                <th>Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attendanceRows.map((row, index) => (
                                                <AttendanceRow key={index} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    )
}
