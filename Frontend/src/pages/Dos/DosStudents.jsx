import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'


const studentStats = [
    { iconClass: 'info',    icon: 'people',       trend: '+15 this term',   trendClass: 'positive', value: '1,245', label: 'Total Students'      },
    { iconClass: 'success', icon: 'check_circle', trend: '96% enrollment',  trendClass: 'positive', value: '1,198', label: 'Active Students'     },
    { iconClass: 'warning', icon: 'person_add',   trend: 'This term',       trendClass: 'neutral',  value: '47',    label: 'New Admissions'      },
    { iconClass: 'success', icon: 'trending_up',  trend: '+3% improvement', trendClass: 'positive', value: '78%',   label: 'Average Performance' },
]
const students = [
    { initials: 'UA', name: 'Uwase Amina',       adm: 'ADM-2026-001', house: 'Bisoke',    t1: '74%', t2: '78%', curr: '81%', standClass: 'dos-stand-good',      standing: 'Good'      },
    { initials: 'KM', name: 'Mutabazi Kevin',     adm: 'ADM-2026-002', house: 'Muhabura',  t1: '65%', t2: '68%', curr: '70%', standClass: 'dos-stand-good',      standing: 'Good'      },
    { initials: 'IM', name: 'Ingabire Marie',     adm: 'ADM-2026-003', house: 'Bisoke',    t1: '88%', t2: '91%', curr: '90%', standClass: 'dos-stand-excellent', standing: 'Excellent' },
    { initials: 'PN', name: 'Nkurunziza Peter',   adm: 'ADM-2026-004', house: 'Sabyinyo',  t1: '55%', t2: '52%', curr: '58%', standClass: 'dos-stand-concern',   standing: 'Concern'   },
    { initials: 'UD', name: 'Umutoni Diane',      adm: 'ADM-2026-005', house: 'Karisimbi', t1: '79%', t2: '82%', curr: '84%', standClass: 'dos-stand-excellent', standing: 'Excellent' },
    { initials: 'JB', name: 'Bizimana James',     adm: 'ADM-2026-006', house: 'Muhabura',  t1: '61%', t2: '65%', curr: '67%', standClass: 'dos-stand-good',      standing: 'Good'      },
    { initials: 'HG', name: 'Hakizimana Grace',   adm: 'ADM-2026-007', house: 'Bisoke',    t1: '93%', t2: '95%', curr: '94%', standClass: 'dos-stand-excellent', standing: 'Excellent' },
    { initials: 'EN', name: 'Ndagijimana Eric',   adm: 'ADM-2026-008', house: 'Sabyinyo',  t1: '48%', t2: '55%', curr: '59%', standClass: 'dos-stand-concern',   standing: 'Concern'   },
]

function StudentStatCard({ iconClass, icon, trend, trendClass, value, label }) {
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

function StudentRow({ initials, name, adm, house, t1, t2, curr, standClass, standing }) {
    return (
        <tr>
            <td><div className="tm-teacher-cell"><div className="tm-av">{initials}</div><span>{name}</span></div></td>
            <td>{adm}</td><td>{house}</td><td>{t1}</td><td>{t2}</td><td>{curr}</td>
            <td><span className={standClass}>{standing}</span></td>
            <td><button className="tm-btn">View</button></td>
        </tr>
    )
}

export function DosStudents() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}>
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Student Management</h1>
                            <p>Monitor student enrollment and performance</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Monday, February 09, 2026</span>
                            <button className="btn btn-primary">Add Student</button>
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
                            {studentStats.map((stat) => (
                                <StudentStatCard key={stat.label} {...stat} />
                            ))}
                        </div>

                        {/* Class Picker */}
                        <div className="dos-picker">
                            <div className="dos-picker-group">
                                <label className="dos-picker-label" htmlFor="pick-section">Section</label>
                                <select className="dos-picker-select" id="pick-section">
                                    <option value="ordinary">Ordinary Level</option>
                                    <option value="advanced">Advanced Level</option>
                                </select>
                            </div>
                            <span className="dos-picker-arrow material-symbols-rounded">chevron_right</span>
                            <div className="dos-picker-group">
                                <label className="dos-picker-label" htmlFor="pick-year">Year</label>
                                <select className="dos-picker-select" id="pick-year">
                                    <option value="S1">S1</option>
                                    <option value="S2">S2</option>
                                    <option value="S3">S3</option>
                                </select>
                            </div>
                            <span className="dos-picker-arrow material-symbols-rounded">chevron_right</span>
                            <div className="dos-picker-group">
                                <label className="dos-picker-label" htmlFor="pick-class">Class</label>
                                <select className="dos-picker-select" id="pick-class">
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                </select>
                            </div>
                            <div className="dos-picker-badge">
                                <span className="material-symbols-rounded">groups</span>
                                <span>S1A &bull; Ordinary</span>
                            </div>
                        </div>

                        {/* Class Student Table */}
                        <div className="card mt-1-5">
                            <div className="card-header">
                                <div>
                                    <h2 className="card-title">Form 1A â€” Students</h2>
                                    <p className="dos-class-meta">Class Teacher: Ms. Claudine Umutoni &bull; 8 students</p>
                                </div>
                                <div className="page-search-box dos-class-search">
                                    <span className="material-symbols-rounded">search</span>
                                    <input type="text" placeholder="Search in this class..." />
                                </div>
                            </div>
                            <div className="card-content">
                                <div className="tm-table-wrap">
                                    <table className="tm-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Adm No.</th>
                                                <th>Dormitory</th>
                                                <th>Term 1</th>
                                                <th>Term 2</th>
                                                <th>Current</th>
                                                <th>Standing</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {students.map((student) => (
                                                <StudentRow key={student.adm} {...student} />
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
