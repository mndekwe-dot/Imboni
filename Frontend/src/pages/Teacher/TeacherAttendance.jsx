import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import '../../styles/pages.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'


const attendanceStats = [
    { cardClass: 'success', value: '28',  label: 'Present Today', trend: '90% of class',          trendClass: '',    icon: 'check_circle', iconClass: 'success' },
    { cardClass: 'danger',  value: '2',   label: 'Absent',        trend: 'Requires follow-up',    trendClass: 'down', icon: 'cancel',       iconClass: 'danger'  },
    { cardClass: 'warning', value: '1',   label: 'Late Arrivals', trend: 'Arrived after 8:00 AM', trendClass: '',    icon: 'schedule',     iconClass: 'warning' },
    { cardClass: 'info',    value: '91%', label: 'Weekly Rate',   trend: '+2% vs last week',      trendClass: 'up',  icon: 'analytics',    iconClass: 'info'    },
]

const attendanceStudents = [
    { initials: 'UA', name: 'Uwase Amina',       id: 'STU-001', status: 'Present', note: ''                    },
    { initials: 'KM', name: 'Mutabazi Kevin',     id: 'STU-002', status: 'Present', note: ''                    },
    { initials: 'HG', name: 'Hakizimana Grace',   id: 'STU-003', status: 'Present', note: ''                    },
    { initials: 'IM', name: 'Ingabire Marie',     id: 'STU-004', status: 'Absent',  note: 'Sick leave'          },
    { initials: 'UD', name: 'Umutoni Diane',      id: 'STU-005', status: 'Late',    note: 'Arrived 10 min late' },
]

function AttendanceStat({ cardClass, value, label, trend, trendClass, icon, iconClass }) {
    return (
        <div className={`stat-card ${cardClass}`}>
            <div className="stat-card-header">
                <div className="stat-card-body">
                    <div className="stat-card-value">{value}</div>
                    <div className="stat-card-label">{label}</div>
                    <div className={`stat-card-trend ${trendClass}`}>
                        {trendClass === 'up' && <span className="material-symbols-rounded icon-sm">trending_up</span>}
                        <span>{trend}</span>
                    </div>
                </div>
                <div className={`stat-card-icon ${iconClass}`}>
                    <span className="material-symbols-rounded">{icon}</span>
                </div>
            </div>
        </div>
    )
}

function AttendanceStudentRow({ initials, name, id, status, note }) {
    return (
        <tr>
            <td>
                <div className="student-info-cell">
                    <div className="student-avatar">{initials}</div>
                    <div>
                        <div className="student-name">{name}</div>
                        <div className="student-id-text">{id}</div>
                    </div>
                </div>
            </td>
            <td>
                <select className="input input-auto" defaultValue={status}>
                    <option>Present</option>
                    <option>Absent</option>
                    <option>Late</option>
                </select>
            </td>
            <td>
                <input type="text" className="input" placeholder="Optional notes..." defaultValue={note} />
            </td>
        </tr>
    )
}

export function TeacherAttendance() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn">
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Mark Attendance</h1>
                            <p>Track student attendance for today's class</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Monday, February 03, 2026</span>
                            <button className="notification-btn">
                                <span className="material-symbols-rounded">notifications</span>
                                <span className="notification-badge">5</span>
                            </button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Pacifique Rurangwa</span>
                                    <span className="header-user-role">Teacher</span>
                                </div>
                                <div className="header-user-av teacher-av">PR</div>
                            </div>
                        </div>
                    </header>

                    <div className="dashboard-content">

                        {/* Section → Year → Class Cascade Picker */}
                        <div className="tp-picker">
                            <div className="tp-picker-group">
                                <label className="tp-picker-label">Section</label>
                                <select className="tp-picker-select" id="dp-section">
                                    <option value="">All Sections</option>
                                    <option value="olevel">O-Level (S1–S3)</option>
                                    <option value="alevel">A-Level (S4–S6)</option>
                                </select>
                            </div>
                            <div className="tp-picker-group">
                                <label className="tp-picker-label">Year</label>
                                <select className="tp-picker-select" id="dp-year">
                                    <option value="">All Years</option>
                                    <option value="S1">S1</option>
                                    <option value="S2">S2</option>
                                    <option value="S3">S3</option>
                                    <option value="S4">S4</option>
                                    <option value="S5">S5</option>
                                    <option value="S6">S6</option>
                                </select>
                            </div>
                            <div className="tp-picker-group">
                                <label className="tp-picker-label">Class</label>
                                <select className="tp-picker-select" id="dp-class">
                                    <option value="">All Classes</option>
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                </select>
                            </div>
                            <span className="tp-picker-current" id="classLabel">S3A</span>
                        </div>

                        <div className="tab-nav">
                            <button className="tab-btn active">Daily View</button>
                            <button className="tab-btn">Weekly View</button>
                            <button className="tab-btn">Monthly View</button>
                            <button className="tab-btn">Reports</button>
                        </div>

                        <div className="action-toolbar">
                            <button className="btn btn-primary">
                                <span className="material-symbols-rounded icon-sm">done_all</span>
                                Mark All Present
                            </button>
                            <button className="btn btn-outline">
                                <span className="material-symbols-rounded icon-sm">download</span>
                                Export to Excel
                            </button>
                            <button className="btn btn-outline">
                                <span className="material-symbols-rounded icon-sm">print</span>
                                Print Report
                            </button>
                            <button className="btn btn-outline">
                                <span className="material-symbols-rounded icon-sm">send</span>
                                Send to Parents
                            </button>
                        </div>

                        <div className="quick-stats-grid">
                            {attendanceStats.map((stat, index) => (
                                <AttendanceStat key={index} {...stat} />
                            ))}
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title" id="attendanceCardTitle">S3A - Mathematics</h3>
                                <div className="card-actions">
                                    <select className="input input-auto">
                                        <option>Today - Feb 3, 2026</option>
                                        <option>Yesterday - Feb 2, 2026</option>
                                        <option>Feb 1, 2026</option>
                                    </select>
                                </div>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table className="students-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Status</th>
                                                <th>Notes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attendanceStudents.map((row, index) => (
                                                <AttendanceStudentRow key={index} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="card-footer">
                                <button className="btn btn-outline">Cancel</button>
                                <button className="btn btn-primary">Save Attendance</button>
                            </div>
                        </div>

                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h3 className="card-title">Attendance Patterns</h3>
                                <p className="card-description">Weekly attendance trends</p>
                            </div>
                            <div className="card-content">
                                <div className="chart-container">
                                    <div className="chart-placeholder">
                                        📊 Attendance pattern line chart
                                        <br /><small>Mon: 96% | Tue: 94% | Wed: 91% | Thu: 89% | Fri: 87%</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    )
}
