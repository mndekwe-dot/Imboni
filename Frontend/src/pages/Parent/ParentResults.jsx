import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const recentResults = [
    { subject: 'Mathematics', type: 'Mid-Term', score: '85/100', grade: 'A', badgeClass: 'badge-success', date: 'Jan 15, 2026' },
    { subject: 'English',     type: 'Quiz',     score: '78/100', grade: 'B', badgeClass: 'badge-primary', date: 'Jan 14, 2026' },
    { subject: 'Physics',     type: 'Test',     score: '92/100', grade: 'A', badgeClass: 'badge-success', date: 'Jan 12, 2026' },
    { subject: 'Chemistry',   type: 'Lab',      score: '70/100', grade: 'B', badgeClass: 'badge-primary', date: 'Jan 10, 2026' },
    { subject: 'History',     type: 'Essay',    score: '88/100', grade: 'A', badgeClass: 'badge-success', date: 'Jan 8, 2026'  },
]

const summativePerformance = [
    { subject: 'Mathematics', avgQuiz: '85%', groupWork: '92%', exam: '88%', final: '88.5%', gradeClass: 'a', grade: 'A' },
    { subject: 'English',     avgQuiz: '78%', groupWork: '88%', exam: '82%', final: '82.3%', gradeClass: 'a', grade: 'A' },
]

const assessments = [
    { iconClass: 'quiz',  icon: 'quiz',       title: 'Algebra Quiz #3',             sub: 'Individual Task \u00b7 Feb 05',      score: '18/20', scoreClass: 'text-success' },
    { iconClass: 'group', icon: 'groups',     title: 'Climate Change Presentation',  sub: 'Group Project (Lead) \u00b7 Jan 28', score: '45/50', scoreClass: 'text-success' },
    { iconClass: 'quiz',  icon: 'history_edu',title: 'Literature Essay',             sub: 'Weekly Assignment \u00b7 Jan 15',    score: '12/20', scoreClass: 'text-warning' },
]

const teacherReviews = [
    { avatarBg: 'var(--primary)', initials: 'PR', teacher: 'Mr. Pacifique Rurangwa',  role: 'Maths Teacher \u00b7 2 days ago',   text: "Amina's performance in Group Work was exemplary. She took a leadership role and helped her peers understand the complex variables." },
    { avatarBg: 'var(--accent)',  initials: 'SU', teacher: 'Ms. Sandrine Uwera',       role: 'Physics Teacher \u00b7 1 week ago', text: 'Noticeable improvement in quiz scores. Suggest more practice on the practical lab reports.' },
]

function ResultRow({ subject, type, score, grade, badgeClass, date }) {
    return (
        <tr>
            <td>{subject}</td>
            <td>{type}</td>
            <td>{score}</td>
            <td><span className={`badge ${badgeClass}`}>{grade}</span></td>
            <td>{date}</td>
        </tr>
    )
}

function SummativeRow({ subject, avgQuiz, groupWork, exam, final, gradeClass, grade }) {
    return (
        <tr>
            <td><strong>{subject}</strong></td>
            <td>{avgQuiz}</td>
            <td>{groupWork}</td>
            <td>{exam}</td>
            <td><strong>{final}</strong></td>
            <td><span className={`grade-badge ${gradeClass}`}>{grade}</span></td>
        </tr>
    )
}

function AssessmentItem({ iconClass, icon, title, sub, score, scoreClass }) {
    return (
        <div className="assessment-item">
            <div className={`assessment-icon ${iconClass}`}>
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div className="assessment-info">
                <p><strong>{title}</strong></p>
                <p className="text-xs text-muted">{sub}</p>
            </div>
            <div className={`assessment-score ${scoreClass}`}>{score}</div>
        </div>
    )
}

function ReviewBubble({ avatarBg, initials, teacher, role, text }) {
    return (
        <div className="review-bubble">
            <div className="review-header">
                <div className="avatar avatar-sm" style={{ background: avatarBg }}>{initials}</div>
                <div>
                    <p className="text-sm"><strong>{teacher}</strong></p>
                    <p className="text-xs text-muted">{role}</p>
                </div>
            </div>
            <p className="review-text text-sm">"{text}"</p>
        </div>
    )
}

export function ParentResults() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}>
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Academic Results</h1>
                            <p>Performance tracking and term reports</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <button className="btn btn-outline">
                                <span className="material-symbols-rounded">download</span> Export PDF
                            </button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Mrs. Chantal Uwase</span>
                                    <span className="header-user-role">Parent</span>
                                </div>
                                <div className="header-user-av parent-av">CU</div>
                            </div>
                        </div>
                    </header>

                    {/* Child Switcher */}
                    <div className="child-switcher-bar">
                        <span className="child-switcher-label">Viewing:</span>
                        <button className="child-tab active">
                            <div className="child-tab-avatar amina">A</div>
                            <div className="child-tab-info">
                                <span className="child-tab-name">Uwase Amina</span>
                                <span className="child-tab-grade">S4A</span>
                            </div>
                        </button>
                    </div>

                    <DashboardContent>

                        {/* Recent Results */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Recent Results â€” Uwase Amina</h3>
                                <button className="btn btn-outline btn-sm">
                                    View All <span className="material-symbols-rounded">arrow_forward</span>
                                </button>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Subject</th>
                                                <th>Type</th>
                                                <th>Score</th>
                                                <th>Grade</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentResults.map((row, index) => (
                                                <ResultRow key={index} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Summative Performance */}
                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h3 className="card-title">Summative Performance</h3>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Subject</th>
                                                <th>Avg Quiz</th>
                                                <th>Group Work</th>
                                                <th>Exam</th>
                                                <th>Final</th>
                                                <th>Grade</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summativePerformance.map((row, index) => (
                                                <SummativeRow key={index} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Assessments & Teacher Reviews */}
                        <div className="grid-2 mt-1-5">
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Recent Assessments &amp; Projects</h3>
                                    <span className="badge badge-secondary">This Term</span>
                                </div>
                                <div className="card-content">
                                    <div className="assessment-list">
                                        {assessments.map((item, index) => (
                                            <AssessmentItem key={index} {...item} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title">Teacher Reviews</h3>
                                </div>
                                <div className="card-content">
                                    <div className="review-timeline">
                                        {teacherReviews.map((review, index) => (
                                            <ReviewBubble key={index} {...review} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
