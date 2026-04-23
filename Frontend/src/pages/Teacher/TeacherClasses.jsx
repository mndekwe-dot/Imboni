import { Sidebar } from '../../components/layout/Sidebar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'
import { useState } from 'react'


const classes = [
    { className: 'S3A', subject: 'Mathematics', students: 32, avgScore: '85%', schedule: 'Mon, Wed, Fri - 8:00 AM', room: 'Room 101', year: 'S3', letter: 'A' },
    { className: 'S3B', subject: 'Mathematics', students: 28, avgScore: '78%', schedule: 'Tue, Thu - 10:00 AM', room: 'Room 102', year: 'S3', letter: 'B' },
    { className: 'S4A', subject: 'Mathematics', students: 35, avgScore: '82%', schedule: 'Mon, Wed, Fri - 11:00 AM', room: 'Room 103', year: 'S4', letter: 'A' },
    { className: 'S2A', subject: 'Mathematics', students: 30, avgScore: '76%', schedule: 'Tue, Thu - 2:00 PM', room: 'Room 105', year: 'S2', letter: 'A' },
    { className: 'S1B', subject: 'Mathematics', students: 29, avgScore: '70%', schedule: 'Mon, Wed, Fri - 1:00 PM', room: 'Room 107', year: 'S1', letter: 'B' },
]

const homeworkSubmissions = [
    { label: 'S3A - Chapter 5 Assignment', submitted: 28, total: 32, pct: 88 },
    { label: 'S3B - Trigonometry Quiz', submitted: 22, total: 28, pct: 79 },
    { label: 'S4A - Calculus Problems', submitted: 30, total: 35, pct: 86 },
    { label: 'S2A - Linear Equations', submitted: 25, total: 30, pct: 83 },
    { label: 'S1B - Basic Operations', submitted: 27, total: 29, pct: 93 },
]

const barData = [
    { label: 'S3A', height: '85%', value: '85%' },
    { label: 'S3B', height: '78%', value: '78%' },
    { label: 'S4A', height: '82%', value: '82%' },
    { label: 'S2A', height: '76%', value: '76%' },
    { label: 'S1B', height: '70%', value: '70%' },
]
const SECTIONS = [
    {
        name: 'O-Level',
        years: ['S1', 'S2', 'S3'],
        classes: ['A', 'B', 'C'],
    },
    {
        name: 'A-Level',
        years: ['S4', 'S5', 'S6'],
        classes: ['MPG', 'PCB', 'MEG', 'MPC'],
    },
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
    const [section, setSection] = useState('')
    const [year, setYear] = useState('')
    const [classVal, setClassVal] = useState('')
    const [openClass, setOpenClass] = useState(null)
    const [viewStudent, setViewStudent] = useState(null)
    const [resultStudent, setResultStudent] = useState(null)
    const visible = classes.filter(cls => {
        if (section) {
            const sec = SECTIONS.find(s => s.name === section)
            if (sec && !sec.years.includes(cls.year)) return false
        }
        if (year && cls.year !== year) return false
        if (classVal && cls.letter !== classVal) return false
        return true
    })


    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Dashboard" subtitle="Teacher" {...teacherUser} />

                    <div className="dashboard-content">

                        {/* Section â†’ Year â†’ Class Cascade Picker */}
                        <div className="tp-picker">
                            <ClassPicker
                                sections={SECTIONS}
                                section={section} onSectionChange={setSection}
                                year={year} onYearChange={setYear}
                                classVal={classVal} onClassChange={setClassVal}
                            />
                            <span className="tp-picker-current" id="classLabel">All Classes</span>
                        </div>

                        <div className="classes-grid" id="classesGrid">
                            {visible.length > 0 ? (
                                <div className="classes-grid">
                                    {visible.map((cls, index) => (
                                        <ClassCard key={index} {...cls} />
                                    ))}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted-foreground)' }}>
                                    No classes found.
                                </div>
                            )}

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
