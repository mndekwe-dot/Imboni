import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'


const resultRows = [
    { initials: 'UA', name: 'Uwase Amina',       id: 'STU-001', assessment: 'Mid-Term Exam', score: '85/100', gradeClass: 'a', grade: 'A', date: 'Jan 15, 2026' },
    { initials: 'KM', name: 'Mutabazi Kevin',    id: 'STU-002', assessment: 'Mid-Term Exam', score: '78/100', gradeClass: 'b', grade: 'B', date: 'Jan 15, 2026' },
    { initials: 'HG', name: 'Hakizimana Grace',  id: 'STU-003', assessment: 'Mid-Term Exam', score: '92/100', gradeClass: 'a', grade: 'A', date: 'Jan 15, 2026' },
    { initials: 'IM', name: 'Ingabire Marie',    id: 'STU-004', assessment: 'Mid-Term Exam', score: '88/100', gradeClass: 'a', grade: 'A', date: 'Jan 15, 2026' },
    { initials: 'PN', name: 'Nkurunziza Peter',  id: 'STU-005', assessment: 'Mid-Term Exam', score: '79/100', gradeClass: 'b', grade: 'B', date: 'Jan 15, 2026' },
    { initials: 'JB', name: 'Bizimana James',    id: 'STU-006', assessment: 'Mid-Term Exam', score: '94/100', gradeClass: 'a', grade: 'A', date: 'Jan 15, 2026' },
]

function ResultRow({ initials, name, id, assessment, score, gradeClass, grade, date }) {
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
            <td>{assessment}</td>
            <td>{score}</td>
            <td><span className={`grade-badge ${gradeClass}`}>{grade}</span></td>
            <td>{date}</td>
            <td><button className="btn btn-sm btn-outline">Edit</button></td>
        </tr>
    )
}

export function TeacherResults() {
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
                            <h1>Enter Results</h1>
                            <p>Manage student examination and assessment results</p>
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

                        <div className="action-toolbar">
                            <button className="btn btn-primary">
                                <span className="material-symbols-rounded icon-sm">add</span>
                                Add New Results
                            </button>
                            <button className="btn btn-outline">
                                <span className="material-symbols-rounded icon-sm">grid_on</span>
                                Bulk Entry Mode
                            </button>
                            <button className="btn btn-outline">
                                <span className="material-symbols-rounded icon-sm">file_upload</span>
                                Import CSV
                            </button>
                            <button className="btn btn-outline">
                                <span className="material-symbols-rounded icon-sm">download</span>
                                Export Report
                            </button>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title" id="resultsCardTitle">S3A - Mid-Term Results</h3>
                                <div className="card-actions">
                                    <select className="input input-auto">
                                        <option>Mid-Term Exam</option>
                                        <option>End Term Exam</option>
                                        <option>CAT 1</option>
                                        <option>CAT 2</option>
                                    </select>
                                </div>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table className="results-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Assessment</th>
                                                <th>Score</th>
                                                <th>Grade</th>
                                                <th>Date</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resultRows.map((row, index) => (
                                                <ResultRow key={index} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h3 className="card-title">Grade Distribution Analysis</h3>
                                <p className="card-description">Mid-Term Exam - S3A Mathematics</p>
                            </div>
                            <div className="card-content">
                                <div className="grid-2">
                                    <div className="chart-container">
                                        <div className="chart-placeholder">
                                            📊 Grade distribution histogram
                                            <br /><small>A (80-100): 12 | B (70-79): 15 | C (60-69): 4 | D (50-59): 1</small>
                                        </div>
                                    </div>

                                    <div className="quick-stats-grid" data-grid-cols="1">
                                        <div className="stat-card success">
                                            <div className="stat-card-header">
                                                <div className="stat-card-body">
                                                    <div className="stat-card-value">85%</div>
                                                    <div className="stat-card-label">Class Average</div>
                                                    <div className="stat-card-trend up">
                                                        <span className="material-symbols-rounded icon-sm">trending_up</span>
                                                        <span>+3% from last exam</span>
                                                    </div>
                                                </div>
                                                <div className="stat-card-icon success">
                                                    <span className="material-symbols-rounded">school</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="stat-card info">
                                            <div className="stat-card-header">
                                                <div className="stat-card-body">
                                                    <div className="stat-card-value">94</div>
                                                    <div className="stat-card-label">Highest Score</div>
                                                    <div className="stat-card-trend">
                                                        <span>Bizimana James</span>
                                                    </div>
                                                </div>
                                                <div className="stat-card-icon info">
                                                    <span className="material-symbols-rounded">emoji_events</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="stat-card warning">
                                            <div className="stat-card-header">
                                                <div className="stat-card-body">
                                                    <div className="stat-card-value">97%</div>
                                                    <div className="stat-card-label">Pass Rate</div>
                                                    <div className="stat-card-trend">
                                                        <span>31/32 students passed</span>
                                                    </div>
                                                </div>
                                                <div className="stat-card-icon warning">
                                                    <span className="material-symbols-rounded">task_alt</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h3 className="card-title">Performance Trends Over Time</h3>
                                <p className="card-description">Track class performance across assessments</p>
                            </div>
                            <div className="card-content">
                                <div className="chart-container">
                                    <div className="chart-placeholder">
                                        📈 Performance trend line graph
                                        <br /><small>Jan: 78% | Feb: 81% | Mar: 85% | Apr: 82%</small>
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
