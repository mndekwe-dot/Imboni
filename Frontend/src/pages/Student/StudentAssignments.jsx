import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { EmptyState } from '../../components/ui/EmptyState'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { getStudentProfile, getStudentAssignments, submitAssignment } from '../../api/student'
import { getStudentQuizzes } from '../../api/teacher'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'

const STATUS_TABS = ['All', 'Pending', 'Submitted', 'Overdue']

function normaliseStatus(status) {
    if (status === 'graded') return 'Submitted'
    if (status === 'submitted') return 'Submitted'
    if (status === 'late') return 'Overdue'
    if (status === 'overdue') return 'Overdue'
    return 'Pending'
}

function subjectIcon(subject) {
    const s = (subject || '').toLowerCase()
    if (s.includes('math'))        return 'calculate'
    if (s.includes('physics'))     return 'science'
    if (s.includes('english'))     return 'edit_note'
    if (s.includes('chemistry'))   return 'biotech'
    if (s.includes('history'))     return 'history_edu'
    if (s.includes('computer'))    return 'computer'
    if (s.includes('biology'))     return 'eco'
    return 'assignment'
}

function dueDateColor(dateStr, status) {
    if (status === 'Submitted') return 'var(--muted-foreground)'
    if (!dateStr) return 'var(--muted-foreground)'
    const today = new Date()
    const due = new Date(dateStr)
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diff = Math.round((due - today) / 86400000)
    if (diff < 0) return 'var(--destructive)'
    if (diff === 0) return 'var(--destructive)'
    if (diff <= 3) return 'var(--warning)'
    return 'var(--muted-foreground)'
}

function formatDueDate(dateStr, status) {
    if (!dateStr) return '—'
    const today = new Date()
    const due = new Date(dateStr)
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    if (status === 'Submitted') {
        return `Submitted ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    const diff = Math.round((due - today) / 86400000)
    if (diff < 0) return `Was due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    if (diff === 0) return `Due today — ${due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    return `Due ${due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
}

function gradeStyle(grade) {
    if (grade == null) return null
    if (grade >= 80) return { background: 'var(--success-light)', color: 'var(--success)' }
    if (grade >= 60) return { background: 'var(--student-light)', color: 'var(--student)' }
    return { background: 'var(--warning-light)', color: 'var(--warning)' }
}

function AssignmentStat({ iconClass, icon, value, valueColor, label }) {
    return (
        <div className="student-stat-card">
            <div className={`stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            <div className="stat-body">
                <div className="stat-value" style={valueColor ? { color: valueColor } : {}}>{value}</div>
                <div className="stat-label">{label}</div>
            </div>
        </div>
    )
}

function AssignmentCard({ assignment, onSubmit }) {
    const { id, title, subject, teacher, due_date, status: rawStatus, grade, feedback } = assignment
    const status  = normaliseStatus(rawStatus)
    const icon    = subjectIcon(subject)
    const dueText = formatDueDate(due_date, status)
    const dueColor = dueDateColor(due_date, status)
    const gs       = gradeStyle(grade)

    const cardClass  = status === 'Submitted' ? 'submitted' : status === 'Overdue' ? 'overdue' : 'pending'
    const tagClass   = `tag-${cardClass}`
    const dueIcon    = status === 'Submitted' ? 'check_circle' : 'event'

    return (
        <div className={`assignment-card ${cardClass}`}>
            <div className="assignment-icon"><span className="material-symbols-rounded">{icon}</span></div>
            <div className="assignment-body">
                <div className="assignment-title">{title}</div>
                <div className="assignment-subject">{subject}{teacher ? ` · ${teacher}` : ''}</div>
                <div className="assignment-meta">
                    <span className="assignment-due" style={{ color: dueColor }}>
                        <span className="material-symbols-rounded">{dueIcon}</span>
                        {dueText}
                    </span>
                    <span className={`assignment-status-tag ${tagClass}`}>{status}</span>
                </div>
                {feedback && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginTop: '0.3rem' }}>
                        <em>{feedback}</em>
                    </div>
                )}
            </div>
            <div className="assignment-actions">
                {status === 'Overdue' && (
                    <button className="btn btn-sm btn-outline btn-destructive-outline" onClick={() => onSubmit(id)}>
                        Submit Now
                    </button>
                )}
                {status === 'Pending' && (
                    <button className="btn btn-sm btn-primary" onClick={() => onSubmit(id)}>
                        Upload
                    </button>
                )}
                {gs && (
                    <span className="badge" style={{ ...gs, padding: '0.3rem 0.7rem' }}>
                        {grade != null ? `${parseFloat(grade).toFixed(0)}%` : '—'}
                    </span>
                )}
            </div>
        </div>
    )
}

export function StudentAssignments() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const navigate = useNavigate()
    const [profile,     setProfile]     = useState(null)
    const [assignments, setAssignments] = useState([])
    const [quizzes,     setQuizzes]     = useState([])
    const [loading,     setLoading]     = useState(true)
    const [statusFilter, setStatusFilter] = useState('All')

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim()
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()

    useEffect(() => {
        Promise.all([
            getStudentProfile().catch(() => null),
            getStudentAssignments().catch(() => []),
            getStudentQuizzes().catch(() => []),
        ]).then(([prof, ass, qzs]) => {
            setProfile(prof)
            setAssignments(Array.isArray(ass) ? ass : [])
            setQuizzes(Array.isArray(qzs) ? qzs : [])
        }).finally(() => setLoading(false))
    }, [])

    async function handleSubmit(id) {
        try {
            await submitAssignment(id, {})
            const updated = await getStudentAssignments().catch(() => assignments)
            setAssignments(Array.isArray(updated) ? updated : assignments)
        } catch {
            // submission error — silently ignore for now
        }
    }

    const gradeSection = profile ? `${profile.grade}${profile.section}` : ''
    const userRole     = gradeSection ? `Student · ${gradeSection}` : 'Student'

    const pendingCount   = assignments.filter(a => normaliseStatus(a.status) === 'Pending').length
    const submittedCount = assignments.filter(a => normaliseStatus(a.status) === 'Submitted').length
    const overdueCount   = assignments.filter(a => normaliseStatus(a.status) === 'Overdue').length

    const statData = [
        { iconClass: 'orange', icon: 'pending',    value: pendingCount,   valueColor: 'var(--warning)',     label: 'Pending'         },
        { iconClass: 'green',  icon: 'task_alt',   value: submittedCount, valueColor: 'var(--success)',     label: 'Submitted'       },
        { iconClass: 'red',    icon: 'warning',    value: overdueCount,   valueColor: 'var(--destructive)', label: 'Overdue'         },
        { iconClass: 'blue',   icon: 'assignment', value: assignments.length, valueColor: null,             label: 'Total This Term' },
    ]

    function countFor(tab) {
        if (tab === 'All') return assignments.length
        return assignments.filter(a => normaliseStatus(a.status) === tab).length
    }

    const filtered = statusFilter === 'All'
        ? assignments
        : assignments.filter(a => normaliseStatus(a.status) === statusFilter)

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Assignments"
                        subtitle="Track all your tasks and deadlines"
                        userName={fullName}
                        userRole={userRole}
                        userInitials={initials}
                        avatarClass="student-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        {/* Stat cards */}
                        <div className="student-stats-grid">
                            {statData.map((stat, i) => <AssignmentStat key={i} {...stat} />)}
                        </div>

                        {/* Toolbar */}
                        <div className="toolbar-card">
                            {STATUS_TABS.map(tab => (
                                <button
                                    key={tab}
                                    className={`btn ${statusFilter === tab ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}
                                    onClick={() => setStatusFilter(tab)}
                                >
                                    {tab}
                                    <span className="tab-count">{loading ? '—' : countFor(tab)}</span>
                                </button>
                            ))}
                        </div>

                        {/* Online quizzes section */}
                        {quizzes.length > 0 && (
                            <div className="act-list-card" style={{ marginBottom: '1.25rem' }}>
                                <div className="act-list-header">
                                    <div className="act-list-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: '1.1rem', color: 'var(--success)' }}>quiz</span>
                                        Online Quizzes
                                    </div>
                                    <span className="act-list-count">{quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''}</span>
                                </div>
                                <div>
                                    {quizzes.map((q, i) => (
                                        <div key={q.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                            padding: '0.75rem 1rem',
                                            borderBottom: i < quizzes.length - 1 ? '1px solid var(--border)' : 'none',
                                        }}>
                                            <div style={{
                                                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: q.submitted ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                                            }}>
                                                <span className="material-symbols-rounded" style={{ fontSize: '1.2rem', color: q.submitted ? 'var(--success)' : '#6366f1' }}>
                                                    {q.submitted ? 'check_circle' : 'quiz'}
                                                </span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.1rem' }}>
                                                    {q.subject_name} · {q.question_count} question{q.question_count !== 1 ? 's' : ''}
                                                    {q.time_limit_minutes ? ` · ${q.time_limit_minutes} min` : ''}
                                                    {' · Due '}
                                                    <span style={{ color: new Date(q.due_date) < new Date() ? 'var(--destructive)' : 'inherit' }}>{q.due_date}</span>
                                                </div>
                                            </div>
                                            {q.submitted ? (
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: q.percentage >= 50 ? 'var(--success)' : '#dc2626' }}>
                                                        {q.percentage}%
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Completed</div>
                                                </div>
                                            ) : (
                                                <button className="btn btn-primary btn-sm"
                                                    style={{ flexShrink: 0 }}
                                                    onClick={() => navigate(`/student/quiz/${q.id}`)}>
                                                    <span className="material-symbols-rounded icon-sm">play_arrow</span>
                                                    Take Quiz
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Paper assignments */}
                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading assignments…</p>
                        ) : filtered.length === 0 ? (
                            <EmptyState
                                icon="assignment"
                                title={`No ${statusFilter.toLowerCase()} assignments`}
                                description="No assignments match this filter right now."
                                action={{ label: 'Show All', icon: 'refresh', onClick: () => setStatusFilter('All') }}
                            />
                        ) : (
                            <div className="act-list-card">
                                <div className="act-list-header">
                                    <div className="act-list-title">
                                        {statusFilter === 'All' ? 'All Assignments' : `${statusFilter} Assignments`}
                                    </div>
                                    <span className="act-list-count">
                                        {filtered.length} item{filtered.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div>
                                    {filtered.map((item, i) => (
                                        <div key={item.id} className={i < filtered.length - 1 ? 'border-bottom-sep' : ''}>
                                            <AssignmentCard assignment={item} onSubmit={handleSubmit} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
