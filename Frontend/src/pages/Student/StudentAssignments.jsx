import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { EmptyState } from '../../components/ui/EmptyState'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { getStudentProfile, getStudentAssignments, submitAssignment } from '../../api/student'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { getStudentQuizzes } from '../../api/teacher'
import { formatDate, formatDateLong } from '../../utils/date'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'
import { StatCard } from '../../components/layout/StatCard'

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
    if (!dateStr) return '-'
    const today = new Date()
    const due = new Date(dateStr)
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    if (status === 'Submitted') {
        return `Submitted ${formatDate(due)}`
    }
    const diff = Math.round((due - today) / 86400000)
    if (diff < 0) return `Was due ${formatDate(due)}`
    if (diff === 0) return `Due today: ${formatDateLong(due)}`
    return `Due ${formatDateLong(due)}`
}

/* The band is a proportion of the marks available, so it needs both numbers.
   It used to take the raw score as if it were already a percentage, which put
   a perfect 18 out of 20 in the same red band as a genuine 18%. */
function gradeStyle(percent) {
    if (percent == null) return null
    if (percent >= 80) return { background: 'var(--success-light)', color: 'var(--success)' }
    if (percent >= 60) return { background: 'var(--student-light)', color: 'var(--student)' }
    return { background: 'var(--warning-light)', color: 'var(--warning)' }
}

/* A mark out of the marks available. Returns null when there is nothing to
   divide by, so a badge is never rendered from a guess. */
function gradePercent(grade, maxScore) {
    if (grade == null || !maxScore) return null
    return (grade / maxScore) * 100
}

// The Student pages named colours (blue, teal, orange, amber, purple) where
// the rest of the app names meanings. purple was never even defined in
// student.css, so that tile rendered an unstyled icon. Mapped once here:
// brand-ish hues fall back to the portal accent, the rest to their family.
const TONE = { green: 'success', red: 'red', orange: 'warning', amber: 'warning',
               yellow: 'warning', blue: '', teal: '', purple: '' }

// valueColor is dropped: the icon already carries the colour, and no other
// portal tints the number. One tile everywhere beats a Student-only variant.
function AssignmentStat({ iconClass, icon, value, label }) {
    return <StatCard icon={icon} value={value} label={label} colorClass={TONE[iconClass] ?? ''} />
}

function AssignmentCard({ assignment, onSubmit }) {
    const { t } = useTranslation()
    /* The button was labelled "Upload" and opened nothing - there was no file
       input anywhere in the student pages, and the submit call sent an empty
       body. The API has always accepted a file. */
    const fileRef = useRef(null)
    const { id, title, subject, teacher, due_date, status: rawStatus, grade, max_score: maxScore, feedback, attachment } = assignment
    const status  = normaliseStatus(rawStatus)
    const icon    = subjectIcon(subject)
    const dueText = formatDueDate(due_date, status)
    const dueColor = dueDateColor(due_date, status)
    const percent  = gradePercent(grade, maxScore)
    const gs       = gradeStyle(percent)

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
                {attachment && (
                    <a className="assignment-attachment" href={attachment}
                       target="_blank" rel="noreferrer">
                        <span className="material-symbols-rounded icon-sm">attach_file</span>
                        {t('student.assignments.worksheet')}
                    </a>
                )}
                {feedback && (
                    <div className="assignment-feedback">
                        <span className="assignment-feedback-label">
                            {t('student.assignments.teacherFeedback')}
                        </span>
                        <em>{feedback}</em>
                    </div>
                )}
            </div>
            <div className="assignment-actions">
                {(status === 'Overdue' || status === 'Pending') && (
                    <>
                        <input ref={fileRef} type="file" className="u-hidden"
                            aria-label={t('student.assignments.chooseFile')}
                            onChange={e => {
                                const file = e.target.files?.[0]
                                onSubmit(id, file)
                                // Cleared so picking the same file again still fires.
                                e.target.value = ''
                            }} />
                        <button
                            className={`btn btn-sm ${status === 'Overdue'
                                ? 'btn-outline btn-destructive-outline' : 'btn-primary'}`}
                            onClick={() => fileRef.current?.click()}>
                            <span className="material-symbols-rounded icon-sm">upload_file</span>
                            {status === 'Overdue'
                                ? t('student.assignments.submitNow')
                                : t('common.upload')}
                        </button>
                        {/* Not every assignment is a file - a hand-written
                            exercise book is handed in physically, and the
                            student still needs to say they have done it. */}
                        <button className="btn btn-sm btn-outline" onClick={() => onSubmit(id, null)}>
                            {t('student.assignments.markDone')}
                        </button>
                    </>
                )}
                {gs && (
                    <span className="badge assignment-grade-badge" style={gs}>
                        {/* The mark as the teacher entered it, over what it was
                            out of. This printed the raw score with a % sign, so
                            18 out of 20 read as "18%". */}
                        {grade != null ? `${parseFloat(grade)}/${maxScore}` : '-'}
                    </span>
                )}
            </div>
        </div>
    )
}

export function StudentAssignments() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const navigate = useNavigate()
    const toast = useToast()
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

    async function handleSubmit(id, file) {
        try {
            /* FormData only when there is a file: an empty one still sets a
               multipart content type, which the plain JSON path handles worse. */
            let payload = {}
            if (file) {
                payload = new FormData()
                payload.append('file', file)
            }
            await submitAssignment(id, payload)
            const updated = await getStudentAssignments().catch(() => assignments)
            setAssignments(Array.isArray(updated) ? updated : assignments)
            toast.success(t('student.assignments.submittedToast'))
        } catch (e) {
            /* This used to swallow the error. Handing work in is the one action
               on this page a student needs confirmation of - failing quietly
               leaves them believing it went in. */
            toast.error(errorMessage(e, t('student.assignments.submitFailed')))
        }
    }

    const gradeSection = profile ? `${profile.grade}${profile.section}` : ''
    const userRole     = gradeSection
        ? `${t('roles.student')} · ${gradeSection}`
        : t('roles.student')

    /* The list below is headed "paper assignments" and offers a hand-in button,
       so it must hold only those. Online quizzes are in their own section above
       with the controls a quiz needs - a timer, a start button, a review link.
       Before this filter they appeared in both places, the second time with a
       hand-in button the backend rejects. */
    const paperAssignments = assignments.filter(a => a.mode !== 'online')

    const pendingCount   = paperAssignments.filter(a => normaliseStatus(a.status) === 'Pending').length
    const submittedCount = paperAssignments.filter(a => normaliseStatus(a.status) === 'Submitted').length
    const overdueCount   = paperAssignments.filter(a => normaliseStatus(a.status) === 'Overdue').length

    const statData = [
        { iconClass: 'orange', icon: 'pending',    value: pendingCount,   valueColor: 'var(--warning)',     label: 'Pending'         },
        { iconClass: 'green',  icon: 'task_alt',   value: submittedCount, valueColor: 'var(--success)',     label: 'Submitted'       },
        { iconClass: 'red',    icon: 'warning',    value: overdueCount,   valueColor: 'var(--destructive)', label: 'Overdue'         },
        /* Everything the student has been set, both modes - the tiles summarise
           the page, and the quizzes above are part of the same workload. */
        { iconClass: 'blue',   icon: 'assignment', value: assignments.length, valueColor: null,             label: 'Total This Term' },
    ]

    /* The tabs filter the list they sit above, so they count the same set. */
    function countFor(tab) {
        if (tab === 'All') return paperAssignments.length
        return paperAssignments.filter(a => normaliseStatus(a.status) === tab).length
    }

    const filtered = statusFilter === 'All'
        ? paperAssignments
        : paperAssignments.filter(a => normaliseStatus(a.status) === statusFilter)

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.assignments')}
                        subtitle={t('student.assignments.subtitle')}
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
                                    className={`btn assignment-tab-btn ${statusFilter === tab ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setStatusFilter(tab)}
                                >
                                    {tab}
                                    <span className="tab-count">{loading ? '-' : countFor(tab)}</span>
                                </button>
                            ))}
                        </div>

                        {/* Online quizzes section */}
                        {quizzes.length > 0 && (
                            <div className="act-list-card u-mb-lg">
                                <div className="act-list-header">
                                    <div className="act-list-title quiz-title-row">
                                        <span className="material-symbols-rounded quiz-title-icon">quiz</span>
                                        {t('student.assignments.onlineQuizzes')}
                                    </div>
                                    <span className="act-list-count">{quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''}</span>
                                </div>
                                <div>
                                    {quizzes.map((q, i) => (
                                        <div key={q.id} className={`quiz-row ${i < quizzes.length - 1 ? 'border-bottom-sep' : ''}`}>
                                            <div className={`quiz-icon-box ${q.submitted ? 'submitted' : 'pending'}`}>
                                                <span className="material-symbols-rounded">
                                                    {q.submitted ? 'check_circle' : 'quiz'}
                                                </span>
                                            </div>
                                            <div className="quiz-info">
                                                <div className="quiz-title">{q.title}</div>
                                                <div className="quiz-meta">
                                                    {q.subject_name} · {q.question_count} question{q.question_count !== 1 ? 's' : ''}
                                                    {q.time_limit_minutes ? ` · ${q.time_limit_minutes} min` : ''}
                                                    {' · Due '}
                                                    <span style={{ color: new Date(q.due_date) < new Date() ? 'var(--destructive)' : 'inherit' }}>{q.due_date}</span>
                                                </div>
                                            </div>
                                            {q.submitted ? (
                                                <div className="u-row u-shrink-0">
                                                    <div className="quiz-score-box">
                                                        <div className="quiz-score-value" style={{ color: q.percentage >= 50 ? 'var(--success)' : '#dc2626' }}>
                                                            {q.percentage}%
                                                        </div>
                                                        <div className="quiz-score-label">{t('common.completed')}</div>
                                                    </div>
                                                    <button className="btn btn-outline btn-sm"
                                                        onClick={() => navigate(`/student/quiz/${q.id}/review`)}>
                                                        <span className="material-symbols-rounded icon-sm">visibility</span>
                                                        {t('common.revise')}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button className="btn btn-primary btn-sm u-shrink-0"
                                                    onClick={() => navigate(`/student/quiz/${q.id}`)}>
                                                    <span className="material-symbols-rounded icon-sm">play_arrow</span>
                                                    {t('student.assignments.takeQuiz')}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Paper assignments */}
                        {loading ? (
                            <p className="u-pad u-muted">{t('student.assignments.loading')}</p>
                        ) : filtered.length === 0 ? (
                            <EmptyState
                                icon="assignment"
                                title={`No ${statusFilter.toLowerCase()} assignments`}
                                description={t('student.assignments.emptyFiltered')}
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
