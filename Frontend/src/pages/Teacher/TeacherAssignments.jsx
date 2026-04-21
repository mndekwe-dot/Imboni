import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'


const assignmentStats = [
    { iconClass: 'info',    icon: 'assignment',   value: '12', label: 'Total This Term'     },
    { iconClass: 'success', icon: 'check_circle', value: '5',  label: 'Active'              },
    { iconClass: 'warning', icon: 'pending',      value: '47', label: 'Awaiting Submission' },
    { iconClass: 'primary', icon: 'rate_review',  value: '23', label: 'Need Grading'        },
]

const assignments = [
    { status: 'active', icon: 'calculate',   iconBg: 'var(--primary-light)',     iconColor: 'var(--primary)',           title: 'Problem Set 4 — Quadratic Equations',          subject: 'Mathematics · S3A', due: 'Due Mar 15, 2026',     pubClass: 'active', submitted: 18,   total: 34,   submittedBg: 'var(--warning-light)',     submittedColor: 'var(--warning)'     },
    { status: 'active', icon: 'calculate',   iconBg: 'var(--primary-light)',     iconColor: 'var(--primary)',           title: 'CAT 2 Take-home — Trigonometry',                subject: 'Mathematics · S3B', due: 'Due Mar 11, 2026',     pubClass: 'active', submitted: 6,    total: 32,   submittedBg: 'var(--destructive-light)', submittedColor: 'var(--destructive)'  },
    { status: 'active', icon: 'science',     iconBg: 'var(--primary-light)',     iconColor: 'var(--primary)',           title: 'Lab Report — Projectile Motion Experiment',    subject: 'Physics · S4A',     due: 'Due Mar 18, 2026',     pubClass: 'active', submitted: 30,   total: 30,   submittedBg: 'var(--success-light)',     submittedColor: 'var(--success)'     },
    { status: 'past',   icon: 'history_edu', iconBg: 'var(--muted)',             iconColor: 'var(--muted-foreground)',  title: 'Problem Set 3 — Linear Equations',             subject: 'Mathematics · S3A', due: 'Was due Feb 28, 2026', pubClass: 'draft',  submitted: 34,   total: 34,   submittedBg: 'var(--success-light)',     submittedColor: 'var(--success)'     },
    { status: 'draft',  icon: 'draft',       iconBg: 'var(--warning-light)',     iconColor: 'var(--warning)',           title: 'Electricity and Magnetism — Extended Problems', subject: 'Physics · S4A',     due: 'Due Apr 2, 2026',      pubClass: 'draft',  submitted: null, total: null, submittedBg: 'var(--muted)',             submittedColor: 'var(--muted-foreground)' },
]

function AssignmentStat({ iconClass, icon, value, label }) {
    return (
        <div className="stat-card">
            <div className="stat-header">
                <div className={`stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    )
}

function AssignmentCard({ status, icon, iconBg, iconColor, title, subject, due, pubClass, submitted, total, submittedBg, submittedColor }) {
    const submittedLabel = submitted === null ? 'Not published' : `${submitted} / ${total} submitted`
    return (
        <div className="card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0, background: iconBg, color: iconColor }}>
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.2rem' }}>{title}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.35rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>book</span>{subject}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>event</span>{due}</span>
                    <span className={`pub-badge ${pubClass}`}>{status === 'past' ? 'Past' : status === 'draft' ? 'Draft' : 'Active'}</span>
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 999, background: submittedBg, color: submittedColor }}>{submittedLabel}</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {status === 'draft' && <button className="btn btn-sm btn-primary">Publish</button>}
                    {status !== 'past' && <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">edit</span></button>}
                    {status !== 'past' && <button className="btn btn-outline btn-sm" style={{ color: 'var(--destructive)', borderColor: 'var(--destructive)' }}><span className="material-symbols-rounded">delete</span></button>}
                    {(status === 'active' || status === 'past') && <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">group</span> Submissions</button>}
                </div>
            </div>
        </div>
    )
}

export function TeacherAssignments() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" aria-label="Toggle navigation menu">
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Assignments</h1>
                            <p>Create, manage, and track student submissions</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <button className="btn btn-primary">
                                <span className="material-symbols-rounded">add</span> New Assignment
                            </button>
                            <button className="notification-btn">
                                <span className="material-symbols-rounded">notifications</span>
                                <span className="notification-badge">2</span>
                            </button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Mr. Pacifique Rurangwa</span>
                                    <span className="header-user-role">Teacher</span>
                                </div>
                                <div className="header-user-av" style={{ background: 'var(--primary)' }}>PR</div>
                            </div>
                        </div>
                    </header>

                    <div className="dashboard-content">

                        {/* Stats */}
                        <div className="stat-cards-grid" style={{ marginBottom: '1.5rem' }}>
                            {assignmentStats.map((stat, index) => (
                                <AssignmentStat key={index} {...stat} />
                            ))}
                        </div>

                        {/* Toolbar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                            <div className="filter-tabs-bar" style={{ margin: 0 }}>
                                <button className="filter-tab active">All <span className="badge">12</span></button>
                                <button className="filter-tab">Active <span className="badge">5</span></button>
                                <button className="filter-tab">Past <span className="badge">6</span></button>
                                <button className="filter-tab">Draft <span className="badge">1</span></button>
                            </div>
                            <div style={{ flex: 1 }}></div>
                            <select className="form-input" style={{ width: 'auto', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                                <option value="">All Classes</option>
                                <option>S3A</option>
                                <option>S3B</option>
                                <option>S4A</option>
                            </select>
                            <select className="form-input" style={{ width: 'auto', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
                                <option value="">All Subjects</option>
                                <option>Mathematics</option>
                                <option>Physics</option>
                                <option>Chemistry</option>
                            </select>
                        </div>

                        {/* Assignment list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {assignments.map((a, index) => (
                                <AssignmentCard key={index} {...a} />
                            ))}
                        </div>

                        {/* Create / Edit Assignment form */}
                        <div className="card" style={{ marginTop: '1.5rem' }}>
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">add_circle</span> New Assignment</h3>
                            </div>
                            <div className="card-content">
                                <div className="tt-form">
                                    <div className="tt-form-row">
                                        <div className="form-group">
                                            <label className="form-label">Title</label>
                                            <input type="text" className="form-input" placeholder="e.g. Problem Set 4 — Quadratic Equations" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Class</label>
                                            <select className="form-input">
                                                <option value="">— Select class —</option>
                                                <option>S3A</option>
                                                <option>S3B</option>
                                                <option>S4A</option>
                                                <option>S4B</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Subject</label>
                                            <select className="form-input">
                                                <option value="">— Select subject —</option>
                                                <option>Mathematics</option>
                                                <option>Physics</option>
                                                <option>Chemistry</option>
                                                <option>English</option>
                                                <option>History</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="tt-form-row">
                                        <div className="form-group">
                                            <label className="form-label">Due Date</label>
                                            <input type="date" className="form-input" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Max Score</label>
                                            <input type="number" className="form-input" placeholder="e.g. 100" min="1" max="100" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Save as</label>
                                            <select className="form-input">
                                                <option value="active">Publish now</option>
                                                <option value="draft">Save as draft</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Instructions</label>
                                        <textarea className="form-input" style={{ minHeight: '80px', resize: 'vertical' }} placeholder="Describe the assignment and list submission requirements…"></textarea>
                                    </div>
                                    <div className="tt-form-actions">
                                        <button className="btn btn-secondary">Clear</button>
                                        <button className="btn btn-primary"><span className="material-symbols-rounded">save</span> Save Assignment</button>
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
