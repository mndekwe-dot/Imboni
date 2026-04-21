import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'


const teacherStats = [
    { iconClass: 'info',    icon: 'school',   trend: '+3 this term', trendClass: 'positive', value: '85',   label: 'Total Teachers'        },
    { iconClass: 'success', icon: 'badge',    trend: '53% of staff', trendClass: 'neutral',  value: '45',   label: 'Full-Time'             },
    { iconClass: 'warning', icon: 'schedule', trend: '47% of staff', trendClass: 'neutral',  value: '40',   label: 'Part-Time'             },
    { iconClass: 'info',    icon: 'groups',   trend: 'Optimal',      trendClass: 'positive', value: '1:15', label: 'Student-Teacher Ratio' },
]

const teachers = [
    { initials: 'CU', avClass: 'english',  name: 'Claudine Umutoni',      id: 'TST-001', subject: 'English',     type: 'Full-Time', typeClass: 'fulltime', classes: ['S1A', 'S3A'],          statusClass: 'active', status: 'Active' },
    { initials: 'PR', avClass: 'math',     name: 'Pacifique Rurangwa',     id: 'TST-002', subject: 'Mathematics', type: 'Full-Time', typeClass: 'fulltime', classes: ['S2A', 'S2B'],          statusClass: 'active', status: 'Active' },
    { initials: 'IN', avClass: 'sciences', name: 'Immaculée Nsabimana',    id: 'TST-003', subject: 'Biology',     type: 'Full-Time', typeClass: 'fulltime', classes: ['S3A', 'S3B', 'S4A'],  statusClass: 'active', status: 'Active' },
    { initials: 'TB', avClass: 'sciences', name: 'Théophile Bizimana',     id: 'TST-004', subject: 'Chemistry',   type: 'Part-Time', typeClass: 'parttime', classes: ['S2B'],                  statusClass: 'active', status: 'Active' },
    { initials: 'SU', avClass: 'sciences', name: 'Sandrine Uwera',         id: 'TST-005', subject: 'Physics',     type: 'Full-Time', typeClass: 'fulltime', classes: ['S3A', 'S3B', 'S4A'],  statusClass: 'active', status: 'Active' },
    { initials: 'JN', avClass: 'english',  name: 'Janvier Ntakirutimana',  id: 'TST-006', subject: 'History',     type: 'Full-Time', typeClass: 'fulltime', classes: ['S3A', 'S4A'],          statusClass: 'active', status: 'Active' },
]

function TeacherStat({ iconClass, icon, trend, trendClass, value, label }) {
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

function TeacherRow({ initials, avClass, name, id, subject, type, typeClass, classes, statusClass, status }) {
    return (
        <tr>
            <td>
                <div className="tm-teacher-cell">
                    <div className={`tm-av ${avClass}`}>{initials}</div>
                    <div>
                        <div className="tm-name">{name}</div>
                        <div className="tm-id">{id}</div>
                    </div>
                </div>
            </td>
            <td>{subject}</td>
            <td><span className={`tm-badge ${typeClass}`}>{type}</span></td>
            <td>{classes.map((cls, i) => <span key={i} className="tm-chip">{cls}</span>)}</td>
            <td><span className={`tm-status ${statusClass}`}>{status}</span></td>
            <td className="tm-actions">
                <button className="tm-btn"><span className="material-symbols-rounded">edit</span> Edit</button>
                <button className="tm-btn assign"><span className="material-symbols-rounded">class</span> Assign</button>
            </td>
        </tr>
    )
}

export function DosTeachers() {
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
                            <h1>Teacher Management</h1>
                            <p>View, add, update teachers and manage class assignments</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Monday, March 09, 2026</span>
                            <button className="notification-btn">
                                <span className="material-symbols-rounded">notifications</span>
                                <span className="notification-badge">2</span>
                            </button>
                            <button className="btn btn-primary">
                                <span className="material-symbols-rounded">person_add</span> Add Teacher
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
                            {teacherStats.map((stat, index) => (
                                <TeacherStat key={index} {...stat} />
                            ))}
                        </div>

                        {/* Search + Filter Bar */}
                        <div className="tm-toolbar">
                            <div className="page-search-box">
                                <span className="material-symbols-rounded">search</span>
                                <input id="teacher-search" type="text" placeholder="Search by name or subject..." />
                            </div>
                            <div className="tm-filter-dropdowns">
                                <div className="tm-filter-group">
                                    <label className="tm-filter-label">Subject</label>
                                    <select className="dos-picker-select" id="subject-filter">
                                        <option value="">All Subjects</option>
                                        <option>Mathematics</option>
                                        <option>English</option>
                                        <option>Biology</option>
                                        <option>Chemistry</option>
                                        <option>Physics</option>
                                        <option>History</option>
                                        <option>Geography</option>
                                        <option>Kinyarwanda</option>
                                        <option>CRE</option>
                                        <option>Art &amp; Design</option>
                                    </select>
                                </div>
                                <div className="tm-filter-group">
                                    <label className="tm-filter-label">Class</label>
                                    <select className="dos-picker-select" id="class-filter">
                                        <option value="">All Classes</option>
                                        <option>S1A</option><option>S1B</option><option>S1C</option>
                                        <option>S2A</option><option>S2B</option><option>S2C</option>
                                        <option>S3A</option><option>S3B</option><option>S3C</option>
                                        <option>S4A</option><option>S4B</option><option>S4C</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Teacher List Table */}
                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h2 className="card-title">All Teachers <span className="tm-count">85</span></h2>
                            </div>
                            <div className="card-content">
                                <div className="tm-table-wrap">
                                    <table className="tm-table">
                                        <thead>
                                            <tr>
                                                <th>Teacher</th>
                                                <th>Subject</th>
                                                <th>Type</th>
                                                <th>Classes Assigned</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {teachers.map((teacher, index) => (
                                                <TeacherRow key={index} {...teacher} />
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
