import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'


const classes = [
    { className: 'S3A', subject: 'Mathematics', students: 32, avgScore: '85%', schedule: 'Mon, Wed, Fri - 8:00 AM',  room: 'Room 101', year: 'S3', letter: 'A' },
    { className: 'S3B', subject: 'Mathematics', students: 28, avgScore: '78%', schedule: 'Tue, Thu - 10:00 AM',      room: 'Room 102', year: 'S3', letter: 'B' },
    { className: 'S4A', subject: 'Mathematics', students: 35, avgScore: '82%', schedule: 'Mon, Wed, Fri - 11:00 AM', room: 'Room 103', year: 'S4', letter: 'A' },
    { className: 'S2A', subject: 'Mathematics', students: 30, avgScore: '76%', schedule: 'Tue, Thu - 2:00 PM',       room: 'Room 105', year: 'S2', letter: 'A' },
    { className: 'S1B', subject: 'Mathematics', students: 29, avgScore: '70%', schedule: 'Mon, Wed, Fri - 1:00 PM',  room: 'Room 107', year: 'S1', letter: 'B' },
]

const homeworkSubmissions = [
    { label: 'S3A - Chapter 5 Assignment',  submitted: 28, total: 32, pct: 88 },
    { label: 'S3B - Trigonometry Quiz',     submitted: 22, total: 28, pct: 79 },
    { label: 'S4A - Calculus Problems',     submitted: 30, total: 35, pct: 86 },
    { label: 'S2A - Linear Equations',      submitted: 25, total: 30, pct: 83 },
    { label: 'S1B - Basic Operations',      submitted: 27, total: 29, pct: 93 },
]

const barData = [
    { label: 'S3A', height: '85%', value: '85%' },
    { label: 'S3B', height: '78%', value: '78%' },
    { label: 'S4A', height: '82%', value: '82%' },
    { label: 'S2A', height: '76%', value: '76%' },
    { label: 'S1B', height: '70%', value: '70%' },
]

function ClassCard({ className, subject, students, avgScore, schedule, room, year, letter }) {
    return (
        <div className="class-detail-card" data-year={year} data-classletter={letter}>
            <div className="class-header">
                <div className="class-title-section">
                    <h3>{className}</h3>
                    <span className="class-subject">{subject}</span>
                </div>
            </div>
            <div className="class-stats">
                <div className="stat-item">
                    <div className="stat-value">{students}</div>
                    <div className="stat-label">Students</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{avgScore}</div>
                    <div className="stat-label">Avg Score</div>
                </div>
            </div>
            <div className="class-schedule">
                <div className="class-schedule-item"><span>{schedule}</span></div>
                <div className="class-schedule-item"><span>{room}</span></div>
            </div>
            <div className="class-actions">
                <button className="btn btn-primary btn-sm">View Students</button>
                <button className="btn btn-outline btn-sm">Enter Results</button>
            </div>
        </div>
    )
}

function ProgressBar({ label, submitted, total, pct }) {
    return (
        <div className="progress-indicator">
            <div className="progress-header">
                <span className="progress-header-label">{label}</span>
                <span className="progress-header-value">{submitted}/{total} submitted ({pct}%)</span>
            </div>
            <div className="progress-bar-container">
                <div className="progress-bar-fill" data-width={pct}></div>
            </div>
        </div>
    )
}

function BarGroup({ label, height, value }) {
    return (
        <div className="bar-group">
            <div className="bar-fill" style={{ height }}><span>{value}</span></div>
            <span className="bar-label">{label}</span>
        </div>
    )
}

export function TeacherClasses() {
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
                            <h1>My Classes</h1>
                            <p>Manage your teaching classes</p>
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
                            <button className="btn btn-outline" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
                                <span className="material-symbols-rounded icon-sm">download</span>
                                Export Data
                            </button>
                        </div>

                        <div className="classes-grid" id="classesGrid">
                            {classes.map((cls, index) => (
                                <ClassCard key={index} {...cls} />
                            ))}
                        </div>

                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h3 className="card-title">Homework Submission Status</h3>
                                <p className="card-description">Track student homework completion</p>
                            </div>
                            <div className="card-content">
                                {homeworkSubmissions.map((item, index) => (
                                    <ProgressBar key={index} {...item} />
                                ))}
                            </div>
                        </div>

                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h3 className="card-title">Class Performance Comparison</h3>
                                <p className="card-description">Average scores across all your classes</p>
                            </div>
                            <div className="card-content">
                                <div className="chart-container">
                                    <div className="chart-placeholder">
                                        <div className="performance-chart-wrapper">
                                            {barData.map((bar, index) => (
                                                <BarGroup key={index} {...bar} />
                                            ))}
                                        </div>
                                        <br /><small>S3A: 85% | S3B: 78% | S4A: 82% | S2A: 76% | S1B: 70%</small>
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
