import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'


const analyticsStats = [
    { iconClass: 'primary', icon: 'trending_up',  value: '78%',  label: 'Overall Performance',   trend: '+3% from last term', trendClass: 'positive' },
    { iconClass: 'success', icon: 'check_circle', value: '94%',  label: 'Attendance Rate',       trend: 'Above target',       trendClass: 'positive' },
    { iconClass: 'warning', icon: 'groups',       value: '1:15', label: 'Teacher-Student Ratio', trend: 'Optimal range',      trendClass: 'neutral'  },
    { iconClass: 'info',    icon: 'emoji_events', value: '342',  label: 'Top Performers',        trend: 'Above 80%',          trendClass: 'positive' },
]

const gradePerformance = [
    { grade: 'Grade 12', value: '82%', width: '82%' },
    { grade: 'Grade 11', value: '78%', width: '78%' },
    { grade: 'Grade 10', value: '75%', width: '75%' },
    { grade: 'Grade 9',  value: '72%', width: '72%' },
    { grade: 'Grade 8',  value: '69%', width: '69%' },
    { grade: 'Grade 7',  value: '71%', width: '71%' },
]

const subjectPerformance = [
    { subject: 'Mathematics', value: '76%', width: '76%', barColor: 'var(--success)' },
    { subject: 'English',     value: '81%', width: '81%', barColor: 'var(--success)' },
    { subject: 'Science',     value: '73%', width: '73%', barColor: 'var(--warning)' },
    { subject: 'History',     value: '79%', width: '79%', barColor: 'var(--success)' },
    { subject: 'Geography',   value: '74%', width: '74%', barColor: 'var(--success)' },
    { subject: 'Kiswahili',   value: '68%', width: '68%', barColor: 'var(--warning)' },
]

function AnalyticsStat({ iconClass, icon, value, label, trend, trendClass }) {
    return (
        <div className="stat-card">
            <div className="stat-header">
                <div className={`stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
            <div className={`stat-trend ${trendClass}`}>{trend}</div>
        </div>
    )
}

function GradeRow({ grade, value, width }) {
    return (
        <div className="perf-row">
            <div className="perf-row-header"><span>{grade}</span><strong>{value}</strong></div>
            <div className="progress"><div className="progress-bar" style={{ width }}></div></div>
        </div>
    )
}

function SubjectRow({ subject, value, width, barColor }) {
    return (
        <div className="perf-row">
            <div className="perf-row-header"><span>{subject}</span><strong>{value}</strong></div>
            <div className="progress"><div className="progress-bar" style={{ width, background: barColor }}></div></div>
        </div>
    )
}

export function DosAnalytics() {
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
                            <h1>School Analytics</h1>
                            <p>Comprehensive school performance insights</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Monday, March 23, 2026</span>
                            <button className="notification-btn">
                                <span className="material-symbols-rounded">notifications</span>
                                <span className="notification-badge">3</span>
                            </button>
                            <button className="btn btn-secondary btn-sm">This Term</button>
                            <button className="btn btn-primary btn-sm">Export Report</button>
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
                        <div className="stat-cards-grid">
                            {analyticsStats.map((stat, index) => (
                                <AnalyticsStat key={index} {...stat} />
                            ))}
                        </div>

                        <div className="analytics-grid">
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Performance by Grade</h3>
                                </div>
                                <div className="card-content">
                                    <div className="perf-list">
                                        {gradePerformance.map((row, index) => (
                                            <GradeRow key={index} {...row} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Subject Performance</h3>
                                </div>
                                <div className="card-content">
                                    <div className="perf-list">
                                        {subjectPerformance.map((row, index) => (
                                            <SubjectRow key={index} {...row} />
                                        ))}
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
