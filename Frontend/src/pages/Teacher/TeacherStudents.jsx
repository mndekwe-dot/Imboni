import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import '../../styles/pages.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'


const students = [
    { initials: 'UA', name: 'Uwase Amina',          id: 'STU-001', className: 'S4A', attendance: '95%', performance: '88%', year: 'S4', letter: 'A' },
    { initials: 'KM', name: 'Mutabazi Kevin',        id: 'STU-002', className: 'S4A', attendance: '92%', performance: '85%', year: 'S4', letter: 'A' },
    { initials: 'IM', name: 'Ingabire Marie',        id: 'STU-003', className: 'S3B', attendance: '92%', performance: '90%', year: 'S3', letter: 'B' },
    { initials: 'PN', name: 'Nkurunziza Peter',      id: 'STU-004', className: 'S4B', attendance: '90%', performance: '86%', year: 'S4', letter: 'B' },
    { initials: 'UD', name: 'Umutoni Diane',         id: 'STU-005', className: 'S2A', attendance: '87%', performance: '79%', year: 'S2', letter: 'A' },
    { initials: 'JB', name: 'Bizimana James',        id: 'STU-006', className: 'S5A', attendance: '94%', performance: '91%', year: 'S5', letter: 'A' },
    { initials: 'HG', name: 'Hakizimana Grace',      id: 'STU-007', className: 'S3A', attendance: '85%', performance: '80%', year: 'S3', letter: 'A' },
    { initials: 'EN', name: 'Ndagijimana Eric',      id: 'STU-008', className: 'S6A', attendance: '89%', performance: '75%', year: 'S6', letter: 'A' },
    { initials: 'MS', name: 'Mukamazimpaka Sandra',  id: 'STU-009', className: 'S1B', attendance: '88%', performance: '77%', year: 'S1', letter: 'B' },
    { initials: 'NP', name: 'Nsabimana Patrick',     id: 'STU-010', className: 'S2B', attendance: '91%', performance: '82%', year: 'S2', letter: 'B' },
]

function StudentRow({ initials, name, id, className, attendance, performance, year, letter }) {
    return (
        <tr data-year={year} data-classletter={letter}>
            <td>
                <div className="student-info-cell">
                    <div className="student-avatar">{initials}</div>
                    <div>
                        <div className="student-name">{name}</div>
                        <div className="student-id-text">{id}</div>
                    </div>
                </div>
            </td>
            <td>{id}</td>
            <td>{className}</td>
            <td>{attendance}</td>
            <td>{performance}</td>
            <td><button className="btn btn-sm btn-outline">View</button></td>
        </tr>
    )
}

export function TeacherStudent() {
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
                            <h1>Students</h1>
                            <p>Manage student information and performance</p>
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
                            <span className="tp-picker-current" id="classLabel">All Classes</span>
                        </div>

                        <div className="search-filter-bar">
                            <div className="search-input-wrapper">
                                <span className="material-symbols-rounded search-input-icon">search</span>
                                <input type="text" className="input search-input" placeholder="Search by name or ID..." />
                            </div>
                            <div className="filter-group">
                                <select className="input input-auto">
                                    <option>All Performance</option>
                                    <option>Above 85%</option>
                                    <option>70-85%</option>
                                    <option>Below 70%</option>
                                </select>
                                <select className="input input-auto">
                                    <option>All Attendance</option>
                                    <option>Above 90%</option>
                                    <option>Below 90%</option>
                                </select>
                                <button className="btn btn-outline">
                                    <span className="material-symbols-rounded icon-sm">download</span>
                                    Export
                                </button>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Student List</h3>
                                <p className="card-description" id="studentListDesc">All students in your classes</p>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table className="students-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Student ID</th>
                                                <th>Class</th>
                                                <th>Attendance</th>
                                                <th>Performance</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id="studentsBody">
                                            {students.map((row, index) => (
                                                <StudentRow key={index} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="grid-2 mt-1-5">
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Performance Distribution</h3>
                                    <p className="card-description">Student score ranges</p>
                                </div>
                                <div className="card-content">
                                    <div className="chart-container">
                                        <div className="chart-placeholder">
                                            📈 Performance distribution histogram
                                            <br /><small>85-100%: 18 students | 70-84%: 35 students | 50-69%: 8 students</small>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Attendance Trends</h3>
                                    <p className="card-description">Weekly attendance patterns</p>
                                </div>
                                <div className="card-content">
                                    <div className="chart-container">
                                        <div className="chart-placeholder">
                                            📅 Attendance trend line graph
                                            <br /><small>Week 1: 94% | Week 2: 91% | Week 3: 96% | Week 4: 93%</small>
                                        </div>
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
