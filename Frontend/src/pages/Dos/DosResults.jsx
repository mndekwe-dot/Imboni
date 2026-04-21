import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'


// ── Approval tab data ──
const resultStats = [
    { iconClass: 'warning', icon: 'pending',      trend: 'Requires review',  trendClass: 'negative', value: '24',  label: 'Pending Approval' },
    { iconClass: 'success', icon: 'check_circle', trend: 'This term',        trendClass: 'positive', value: '156', label: 'Approved'         },
    { iconClass: 'danger',  icon: 'cancel',       trend: 'Needs correction', trendClass: 'negative', value: '8',   label: 'Rejected'         },
    { iconClass: 'info',    icon: 'analytics',    trend: 'Average',          trendClass: 'neutral',  value: '87%', label: 'Approval Rate'    },
]

const pendingResults = [
    { title: 'S4A - Mathematics Mid-Term', submittedBy: 'Mr. Pacifique Rurangwa',  date: 'Feb 8, 2026', students: 32, avg: '85%', highest: 94 },
    { title: 'S3B - English Language',     submittedBy: 'Mr. Fidèle Hakizimana',   date: 'Feb 7, 2026', students: 28, avg: '78%', highest: 88 },
    { title: 'S2A - Biology Practical',    submittedBy: 'Dr. Immaculée Nsabimana', date: 'Feb 6, 2026', students: 30, avg: '82%', highest: 97 },
]

function ResultStat({ iconClass, icon, trend, trendClass, value, label }) {
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

function ResultCard({ title, submittedBy, date, students, avg, highest }) {
    return (
        <div className="result-card">
            <div className="result-header">
                <div className="result-info">
                    <h3>{title}</h3>
                    <p>Submitted by {submittedBy} &bull; {date}</p>
                </div>
                <span className="badge pending">Pending</span>
            </div>
            <div className="result-stats">
                <div className="result-stat"><div className="stat-value">{students}</div><div className="stat-label">Students</div></div>
                <div className="result-stat"><div className="stat-value">{avg}</div><div className="stat-label">Average</div></div>
                <div className="result-stat"><div className="stat-value">{highest}</div><div className="stat-label">Highest</div></div>
            </div>
            <div className="result-actions">
                <button className="btn btn-primary btn-sm">Review</button>
                <button className="btn btn-secondary btn-sm">View Details</button>
            </div>
        </div>
    )
}

// ── Analytics tab data ──
const analyticsStats = [
    { iconClass: 'primary', icon: 'trending_up',  value: '78%',  label: 'Overall Performance',   trend: '+3% from last term', trendClass: 'positive' },
    { iconClass: 'success', icon: 'check_circle', value: '94%',  label: 'Attendance Rate',       trend: 'Above target',       trendClass: 'positive' },
    { iconClass: 'warning', icon: 'groups',       value: '1:15', label: 'Teacher-Student Ratio', trend: 'Optimal range',      trendClass: 'neutral'  },
    { iconClass: 'info',    icon: 'emoji_events', value: '342',  label: 'Top Performers',        trend: 'Above 80%',          trendClass: 'positive' },
]

const gradePerformance = [
    { grade: 'S6', value: '82%', width: '82%' },
    { grade: 'S5', value: '78%', width: '78%' },
    { grade: 'S4', value: '75%', width: '75%' },
    { grade: 'S3', value: '72%', width: '72%' },
    { grade: 'S2', value: '69%', width: '69%' },
    { grade: 'S1', value: '71%', width: '71%' },
]

const subjectPerformance = [
    { subject: 'Mathematics', value: '76%', width: '76%', barColor: 'var(--success)' },
    { subject: 'English',     value: '81%', width: '81%', barColor: 'var(--success)' },
    { subject: 'Science',     value: '73%', width: '73%', barColor: 'var(--warning)' },
    { subject: 'History',     value: '79%', width: '79%', barColor: 'var(--success)' },
    { subject: 'Geography',   value: '74%', width: '74%', barColor: 'var(--success)' },
    { subject: 'Kinyarwanda', value: '68%', width: '68%', barColor: 'var(--warning)' },
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

// ── Main page ──
export function DosResults() {
    const [activeTab, setActiveTab] = useState('approval')

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Results"
                        subtitle="Approval queue and school performance analytics — Term 2, 2026"
                        {...dosUser}
                    />

                    <div className="dashboard-content">

                        {/* Tab switcher */}
                        <div className="filter-tabs-bar" style={{ marginBottom: '1.25rem' }}>
                            <button
                                className={`filter-tab${activeTab === 'approval' ? ' active' : ''}`}
                                onClick={() => setActiveTab('approval')}
                            >
                                <span className="material-symbols-rounded">pending</span> Approval Queue
                                <span className="approval-count-badge" style={{ marginLeft: '0.4rem' }}>24</span>
                            </button>
                            <button
                                className={`filter-tab${activeTab === 'analytics' ? ' active' : ''}`}
                                onClick={() => setActiveTab('analytics')}
                            >
                                <span className="material-symbols-rounded">bar_chart</span> Analytics
                            </button>
                        </div>

                        {/* ── APPROVAL TAB ── */}
                        {activeTab === 'approval' && (
                            <>
                                <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
                                    <button className="tab active">Pending <span className="badge">24</span></button>
                                    <button className="tab">Approved</button>
                                    <button className="tab">Rejected</button>
                                    <button className="tab">All</button>
                                </div>

                                <div className="quick-stats">
                                    {resultStats.map((stat, i) => <ResultStat key={i} {...stat} />)}
                                </div>

                                <div className="search-filter">
                                    <div className="page-search-box">
                                        <span className="material-symbols-rounded">search</span>
                                        <input type="text" placeholder="Search by teacher, subject, or class..." />
                                    </div>
                                    <div className="filter-buttons">
                                        <button className="btn btn-secondary active">All</button>
                                        <button className="btn btn-secondary">This Week</button>
                                        <button className="btn btn-secondary">Mathematics</button>
                                        <button className="btn btn-secondary">English</button>
                                    </div>
                                </div>

                                <div className="results-list">
                                    {pendingResults.map((result, i) => <ResultCard key={i} {...result} />)}
                                </div>
                            </>
                        )}

                        {/* ── ANALYTICS TAB ── */}
                        {activeTab === 'analytics' && (
                            <>
                                <div className="stat-cards-grid">
                                    {analyticsStats.map((stat, i) => <AnalyticsStat key={i} {...stat} />)}
                                </div>

                                <div className="analytics-grid">
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Performance by Grade</h3>
                                            <button className="btn btn-secondary btn-sm">
                                                <span className="material-symbols-rounded">download</span> Export
                                            </button>
                                        </div>
                                        <div className="card-content">
                                            <div className="perf-list">
                                                {gradePerformance.map((row, i) => <GradeRow key={i} {...row} />)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Subject Performance</h3>
                                        </div>
                                        <div className="card-content">
                                            <div className="perf-list">
                                                {subjectPerformance.map((row, i) => <SubjectRow key={i} {...row} />)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                    </div>
                </main>
            </div>
        </>
    )
}
