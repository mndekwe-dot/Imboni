import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSection } from '../../components/ui/ListSection'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { getStudentProfile, getStudentAssignments, submitAssignment } from '../../api/student'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate, formatDateLong } from '../../utils/date'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'
import { StatCard } from '../../components/layout/StatCard'

const STATUS_TABS = ['All', 'Pending', 'Submitted', 'Overdue']

/* `late` is work handed in after the due date - handed in all the same. It
   was grouped with `overdue`, so a late hand-in stayed on the Overdue tab with
   its buttons still showing, and "Mark as done" looked like it did nothing. */
function normaliseStatus(status) {
    if (status === 'graded' || status === 'submitted' || status === 'late') return 'Submitted'
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

function formatDueDate(dateStr, status, submittedAt, t) {
    if (status === 'Submitted') {
        /* The day it came in. This printed the due date under "Submitted". */
        return submittedAt
            ? t('student.assignments.handedInOn', { date: formatDate(submittedAt) })
            : t('student.assignments.handedIn')
    }
    if (!dateStr) return '-'
    const today = new Date()
    const due = new Date(dateStr)
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
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

/**
 * One piece of work, with the one action it needs:
 *   online              Start (Review once it has been sat)
 *   paper, upload       Upload & submit - a file is required
 *   paper, in person    Mark as handed in - the work is on the teacher's desk
 * Offering both paper buttons on every card let an upload task be "done" with
 * nothing attached.
 */
function AssignmentCard({ assignment, onSubmit, onOpenQuiz }) {
    const { t } = useTranslation()
    const fileRef = useRef(null)
    const {
        id, title, subject, teacher, due_date, status: rawStatus, grade, max_score: maxScore,
        feedback, attachment, mode, submission_method: method, allow_backtracking: canGoBack,
        submitted_at: submittedAt, is_late: isLate, closed, accept_late_submissions: acceptsLate,
        question_count: questionCount, time_limit_minutes: timeLimit,
    } = assignment
    const status   = normaliseStatus(rawStatus)
    const online   = mode === 'online'
    const icon     = online ? 'quiz' : subjectIcon(subject)
    const dueText  = formatDueDate(due_date, status, submittedAt, t)
    const dueColor = dueDateColor(due_date, status)
    const percent  = gradePercent(grade, maxScore)
    const gs       = gradeStyle(percent)

    const cardClass = status === 'Submitted' ? 'submitted' : status === 'Overdue' ? 'overdue' : 'pending'
    const tagClass  = `tag-${cardClass}`
    const dueIcon   = status === 'Submitted' ? 'check_circle' : 'event'

    /* The backend refuses work on a closed assignment, and late work when the
       teacher turned it off - so no button that can only fail. */
    const open = status !== 'Submitted' && !closed && !(status === 'Overdue' && acceptsLate === false)
    const actionClass = `btn btn-sm ${status === 'Overdue' ? 'btn-outline btn-destructive-outline' : 'btn-primary'}`

    const kind = online
        ? t('student.assignments.kind.online')
        : method === 'upload' ? t('student.assignments.kind.upload') : t('student.assignments.kind.inPerson')

    return (
        <div className={`assignment-card ${cardClass}`}>
            <div className="assignment-icon"><span className="material-symbols-rounded" aria-hidden="true">{icon}</span></div>
            <div className="assignment-body">
                <div className="assignment-title">{title}</div>
                <div className="assignment-subject">
                    {subject}{teacher ? ` · ${teacher}` : ''}
                    {online && questionCount > 0 ? ` · ${t('student.assignments.questionCount', { count: questionCount })}` : ''}
                    {online && timeLimit ? ` · ${t('student.assignments.minutes', { count: timeLimit })}` : ''}
                </div>
                <div className="assignment-meta">
                    <span className="assignment-due" style={{ color: dueColor }}>
                        <span className="material-symbols-rounded" aria-hidden="true">{dueIcon}</span>
                        {dueText}
                    </span>
                    <span className={`assignment-status-tag ${tagClass}`}>{t(`student.assignments.status.${cardClass}`)}</span>
                    {isLate && <span className="assignment-status-tag tag-late">{t('student.assignments.lateTag')}</span>}
                    <span className="assignment-kind">{kind}</span>
                    {online && canGoBack === false && (
                        <span className="assignment-kind">{t('student.assignments.noGoingBack')}</span>
                    )}
                </div>
                {attachment && (
                    <a className="assignment-attachment" href={attachment}
                       target="_blank" rel="noreferrer">
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">attach_file</span>
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
                {open && online && (
                    <button className={actionClass} onClick={() => onOpenQuiz(id)}>
                        <span className="material-symbols-rounded" aria-hidden="true">play_arrow</span>
                        {t('student.assignments.start')}
                    </button>
                )}
                {open && !online && method === 'upload' && (
                    <>
                        <input ref={fileRef} type="file" className="u-hidden"
                            aria-label={t('student.assignments.chooseFile')}
                            onChange={e => {
                                const file = e.target.files?.[0]
                                if (file) onSubmit(id, file)
                                // Cleared so picking the same file again still fires.
                                e.target.value = ''
                            }} />
                        <button className={actionClass} onClick={() => fileRef.current?.click()}>
                            <span className="material-symbols-rounded" aria-hidden="true">upload_file</span>
                            {t('student.assignments.uploadSubmit')}
                        </button>
                    </>
                )}
                {open && !online && method !== 'upload' && (
                    <button className={actionClass} onClick={() => onSubmit(id, null)}>
                        <span className="material-symbols-rounded" aria-hidden="true">task_alt</span>
                        {t('student.assignments.markDone')}
                    </button>
                )}
                {!open && status !== 'Submitted' && (
                    <span className="assignment-note">{t('student.assignments.closedNote')}</span>
                )}
                {status === 'Submitted' && online && (
                    <button className="btn btn-sm btn-outline" onClick={() => onOpenQuiz(id, true)}>
                        <span className="material-symbols-rounded" aria-hidden="true">visibility</span>
                        {t('common.revise')}
                    </button>
                )}
                {gs ? (
                    <span className="badge assignment-grade-badge" style={gs}>
                        {/* The mark as the teacher entered it, over what it was
                            out of. This printed the raw score with a % sign, so
                            18 out of 20 read as "18%". */}
                        {`${parseFloat(grade)}/${maxScore}`}
                    </span>
                ) : status === 'Submitted' ? (
                    <span className="assignment-note">{t('student.assignments.awaitingMark')}</span>
                ) : null}
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
            getStudentAssignments().catch(e => {
                toast.error(errorMessage(e, t('common.loadFailed')))
                return []
            }),
        ]).then(([prof, ass]) => {
            setProfile(prof)
            setAssignments(Array.isArray(ass) ? ass : [])
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

    /* Paper and online work in one list: the tabs mean the same thing for both
       (still to do, handed in, overdue), and each card carries its own action.
       Quizzes used to sit in a separate section with a different layout,
       counted in the tiles but missing from every tab. */
    const pendingCount   = assignments.filter(a => normaliseStatus(a.status) === 'Pending').length
    const submittedCount = assignments.filter(a => normaliseStatus(a.status) === 'Submitted').length
    const overdueCount   = assignments.filter(a => normaliseStatus(a.status) === 'Overdue').length

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
        if (tab === 'All') return assignments.length
        return assignments.filter(a => normaliseStatus(a.status) === tab).length
    }

    const filtered = statusFilter === 'All'
        ? assignments
        : assignments.filter(a => normaliseStatus(a.status) === statusFilter)

    function openQuiz(id, review = false) {
        navigate(review ? `/student/quiz/${id}/review` : `/student/quiz/${id}`)
    }

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

                        {/* Assignments: paper and online */}
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
                            <ListSection
                                icon="assignment"
                                title={statusFilter === 'All' ? 'All Assignments' : `${statusFilter} Assignments`}
                                count={`${filtered.length} item${filtered.length !== 1 ? 's' : ''}`}
                                pad={false}
                            >
                                <div>
                                    {filtered.map((item, i) => (
                                        <div key={item.id} className={i < filtered.length - 1 ? 'border-bottom-sep' : ''}>
                                            <AssignmentCard assignment={item} onSubmit={handleSubmit} onOpenQuiz={openQuiz} />
                                        </div>
                                    ))}
                                </div>
                            </ListSection>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
