import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { FilterBar } from '../../components/ui/FilterBar'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import {
    getTeacherAssignments, createTeacherAssignment,
    updateTeacherAssignment, deleteTeacherAssignment,
    closeTeacherAssignment, reopenTeacherAssignment, releaseAssignmentMarks,
    getAssignmentSubmissions, getAssignmentGradeSheet, saveAssignmentGrades,
} from '../../api/teacher'
import { formatDateTime } from '../../utils/date'
import { errorMessage } from '../../utils/errors'
import { useToast } from '../../context/ToastContext'
import { SubmissionReviewModal } from '../../components/assignments/SubmissionReviewModal'
import { AssignmentStatsModal } from '../../components/assignments/AssignmentStatsModal'
// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_TABS = [
    { key: 'all',    labelKey: 'common.all'    },
    { key: 'active', labelKey: 'common.active' },
    { key: 'draft',  labelKey: 'common.draft'  },
    { key: 'closed', labelKey: 'common.closed' },
]

// Backend status codes mapped to their label key. The status is data; the
// word shown for it is not, so it is never derived from the code itself.
const STATUS_LABEL_KEYS = {
    active: 'common.active',
    draft:  'common.draft',
    closed: 'common.closed',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function submissionPill(a, t) {
    if (a.submitted === null || a.submitted === undefined || a.mode === 'paper')
        return { label: t('teacher.assignments.notTracked'), bg: 'var(--muted)', color: 'var(--muted-foreground)' }
    if (a.status === 'draft')
        return { label: t('common.draft'), bg: 'var(--muted)', color: 'var(--muted-foreground)' }
    const label = t('teacher.assignments.submittedOf', { submitted: a.submitted, total: a.total })
    const pct = a.total ? (a.submitted / a.total) * 100 : 0
    if (pct === 100) return { label, bg: 'rgba(16,185,129,0.12)', color: 'var(--success)'     }
    if (pct >= 50)   return { label, bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)'      }
    return                  { label, bg: 'rgba(239,68,68,0.1)',   color: 'var(--destructive)' }
}

// ── Paper Grading Modal ───────────────────────────────────────────────────────

function GradeModal({ assignment, onClose }) {
    const { t } = useTranslation()
    const [sheet,   setSheet]   = useState(null)
    const [scores,  setScores]  = useState({})
    const [loading, setLoading] = useState(true)
    const [saving,  setSaving]  = useState(false)
    const [message, setMessage] = useState(null)
    /* The teacher's comment per student, saved alongside the mark. Students and
       parents both read it - before this the feedback panel showed the student
       their own submission note. */
    const [comments, setComments] = useState({})

    useEffect(() => {
        getAssignmentGradeSheet(assignment.id)
            .then(data => {
                setSheet(data)
                const init = {}
                const notes = {}
                for (const s of data.students || []) {
                    if (s.score !== null && s.score !== undefined) init[s.student_id] = String(s.score)
                    if (s.feedback) notes[s.student_id] = s.feedback
                }
                setScores(init)
                setComments(notes)
            })
            .catch(() => setMessage({ type: 'error', text: t('teacher.assignments.loadRosterFailed') }))
            .finally(() => setLoading(false))
    }, [assignment.id])

    const maxScore = sheet?.max_score || assignment.max_score

    function setScore(studentId, value) {
        setScores(prev => ({ ...prev, [studentId]: value }))
    }

    function setComment(studentId, value) {
        setComments(prev => ({ ...prev, [studentId]: value }))
    }

    async function handleSave() {
        setSaving(true); setMessage(null)
        try {
            const records = Object.entries(scores)
                .filter(([, v]) => v !== '')
                .map(([student_id, score]) => ({
                    student_id, score, feedback: comments[student_id] ?? '',
                }))
            const res = await saveAssignmentGrades(assignment.id, records)
            if (res.errors?.length) {
                setMessage({ type: 'error', text: t('teacher.assignments.gradesRejected', {
                    saved: res.saved, rejected: res.errors.length, max: maxScore }) })
            } else {
                setMessage({ type: 'success', text: t('teacher.assignments.gradesSaved', { count: res.saved }) })
            }
        } catch {
            setMessage({ type: 'error', text: t('teacher.assignments.saveScoresFailed') })
        } finally {
            setSaving(false)
        }
    }

    const gradedCount = Object.values(scores).filter(v => v !== '').length

    return (
        <Modal title={t('teacher.assignments.gradeTitle', { title: assignment.title })} icon="edit_note" onClose={onClose} size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint"
                        style={{ color: message?.type === 'error' ? '#dc2626' : message?.type === 'success' ? 'var(--success)' : undefined }}>
                        {message?.text || t('teacher.assignments.gradedSummary', {
                            graded: gradedCount, total: sheet?.students?.length ?? 0, max: maxScore })}
                    </span>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
                        <span className="material-symbols-rounded icon-sm">save</span>
                        {saving ? t('common.saving') : t('teacher.assignments.saveScores')}
                    </button>
                </div>
            }>
            {loading ? (
                <p className="u-muted">{t('teacher.assignments.loadingRoster')}</p>
            ) : !sheet?.students?.length ? (
                <p className="u-muted">{t('teacher.assignments.noStudentsIn', { class: assignment.class_name })}</p>
            ) : (
                <div className="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('common.student')}</th>
                                <th className="grade-score-col">{t('teacher.assignments.scoreOutOf', { max: maxScore })}</th>
                                <th>{t('teacher.assignments.feedbackOptional')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sheet.students.map(s => (
                                <tr key={s.student_id}>
                                    <td>
                                        <div className="cell-name">{s.full_name}</div>
                                        <div className="cell-sub">{s.student_code}</div>
                                    </td>
                                    <td>
                                        <input
                                            type="number" min="0" max={maxScore}
                                            className="form-control grade-input"
                                            aria-label={t('teacher.assignments.scoreFor', { name: s.full_name })}
                                            value={scores[s.student_id] ?? ''}
                                            onChange={e => setScore(s.student_id, e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            className="form-control"
                                            aria-label={t('teacher.assignments.feedbackFor', { name: s.full_name })}
                                            placeholder={t('teacher.assignments.feedbackPlaceholder')}
                                            value={comments[s.student_id] ?? ''}
                                            onChange={e => setComment(s.student_id, e.target.value)}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Modal>
    )
}

// ── Submissions Modal ─────────────────────────────────────────────────────────

function SubmissionsModal({ assignment, onClose, onReview }) {
    const { t } = useTranslation()
    const [subs,    setSubs]    = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getAssignmentSubmissions(assignment.id)
            .then(data => setSubs(Array.isArray(data) ? data : []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [assignment.id])

    return (
        <Modal title={t('teacher.assignments.submissionsTitle', { title: assignment.title })} icon="fact_check" onClose={onClose} size="wide"
            footer={<div className="modal-footer-row"><button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button></div>}>
            {loading ? (
                <p className="u-muted">{t('teacher.assignments.loadingSubmissions')}</p>
            ) : subs.length === 0 ? (
                <p className="u-muted">{t('teacher.assignments.noSubmissions')}</p>
            ) : (
                <div className="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('common.student')}</th>
                                <th>{t('common.score')}</th>
                                <th>{t('common.percentage')}</th>
                                <th>{t('common.submitted')}</th>
                                <th>{t('common.late')}</th>
                                <th>{t('teacher.assignments.work')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subs.map(s => (
                                <tr key={s.id}>
                                    <td>
                                        <div className="cell-name">{s.student_name}</div>
                                        <div className="cell-sub">{s.student_code}</div>
                                    </td>
                                    <td>{s.score} / {s.max_score}</td>
                                    <td>
                                        <span className={`sub-pct ${s.percentage >= 50 ? 'pass' : 'low'}`}>{s.percentage}%</span>
                                    </td>
                                    <td className="cell-date">{formatDateTime(s.submitted_at)}</td>
                                    <td>{s.is_late ? <span className="sub-late">{t('common.late')}</span> : '-'}</td>
                                    <td className="asgn-work-cell">
                                        {/* The handed-in file was on the model
                                            but never serialised, so a teacher
                                            could not open the work they were
                                            marking. */}
                                        {s.file && (
                                            <a className="btn btn-outline btn-sm" href={s.file}
                                               target="_blank" rel="noreferrer">
                                                <span className="material-symbols-rounded icon-sm">download</span>
                                                {t('common.download')}
                                            </a>
                                        )}
                                        {assignment.mode === 'online' && (
                                            <button className="btn btn-outline btn-sm"
                                                onClick={() => onReview(s.id)}>
                                                <span className="material-symbols-rounded icon-sm">rate_review</span>
                                                {t('teacher.assignments.review')}
                                            </button>
                                        )}
                                        {s.notes && (
                                            <span className="u-muted u-sm" title={s.notes}>
                                                {t('teacher.assignments.studentNote')}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Modal>
    )
}

// ── Assignment Card ───────────────────────────────────────────────────────────

function AssignmentCard({ a, onEdit, onDelete, onPublish, onDuplicate, onViewSubmissions, onGrade, onClose, onReopen, onStats, onRelease, publishing }) {
    const { t } = useTranslation()
    const pill = submissionPill(a, t)
    const statusStyle = {
        active: { bg: 'rgba(16,185,129,0.1)',  color: 'var(--success)'          },
        draft:  { bg: 'rgba(245,158,11,0.1)',  color: 'var(--warning)'          },
        closed: { bg: 'var(--muted)',           color: 'var(--muted-foreground)' },
    }[a.status] || { bg: 'var(--muted)', color: 'var(--muted-foreground)' }

    return (
        <div className="card asgn-card">
            <div className={`asgn-icon ${a.mode === 'online' ? 'online' : 'paper'}`}>
                <span className="material-symbols-rounded">{a.mode === 'online' ? 'quiz' : 'assignment'}</span>
            </div>
            <div className="asgn-body">
                <div className="asgn-header">
                    <div className="asgn-title">{a.title}</div>
                    {/* Closing stops new work coming in; it does not stop the
                        marking. Both of these were gated on 'active', so a
                        teacher who closed an assignment lost the ability to see
                        who had handed in or to enter a single mark. */}
                    {a.mode === 'online' && a.status !== 'draft' && (
                        <span className="asgn-sub-pill" style={{ background: pill.bg, color: pill.color }}>{pill.label}</span>
                    )}
                </div>
                <div className="asgn-meta">
                    <span className="asgn-meta-text">{a.subject_name} · {a.class_name}</span>
                    <span className="asgn-meta-text">{t('teacher.assignments.due', { date: a.due_date })}</span>
                    <span className="asgn-meta-text">{t('teacher.assignments.maxLabel', { score: a.max_score })}</span>
                    {a.time_limit_minutes && <span className="asgn-meta-text">{t('teacher.assignments.minutesShort', { count: a.time_limit_minutes })}</span>}
                    <span className="asgn-chip" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                        {STATUS_LABEL_KEYS[a.status] ? t(STATUS_LABEL_KEYS[a.status]) : a.status}
                    </span>
                    <span className="asgn-chip" style={{
                        background: a.mode === 'online' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                        color:      a.mode === 'online' ? 'var(--success)'        : '#6366f1',
                    }}>
                        {a.mode === 'online' ? t('teacher.assignments.online') : t('teacher.assignments.paper')}
                    </span>
                    {a.shuffle_questions && (
                        <span className="asgn-chip shuffled">
                            {t('teacher.assignments.shuffledChip')}
                        </span>
                    )}
                </div>
                <div className="asgn-actions">
                    {a.status === 'draft' && (
                        <button className="btn btn-sm btn-primary" onClick={() => onPublish(a.id)} disabled={publishing === a.id}>
                            <span className="material-symbols-rounded icon-sm">publish</span>
                            {publishing === a.id ? t('common.publishing') : t('common.publish')}
                        </button>
                    )}
                    {/* Closing stops new work coming in; it does not stop the
                        marking. Both of these were gated on 'active', so a
                        teacher who closed an assignment lost the ability to see
                        who had handed in or to enter a single mark. */}
                    {a.mode === 'online' && a.status !== 'draft' && (
                        <button className="btn btn-outline btn-sm" onClick={() => onViewSubmissions(a)} title={t('teacher.assignments.viewSubmissions')}>
                            <span className="material-symbols-rounded icon-sm">fact_check</span>
                            {t('teacher.assignments.submissions')}
                        </button>
                    )}
                    {a.mode === 'paper' && a.status !== 'draft' && (
                        <button className="btn btn-outline btn-sm" onClick={() => onGrade(a)} title={t('teacher.assignments.enterScores')}>
                            <span className="material-symbols-rounded icon-sm">edit_note</span>
                            {t('teacher.assignments.grade')}
                        </button>
                    )}
                    {a.status !== 'draft' && (
                        <button className="btn btn-outline btn-sm" onClick={() => onStats(a)}
                            title={t('teacher.assignments.statsTooltip')}>
                            <span className="material-symbols-rounded icon-sm">insights</span>
                            {t('teacher.assignments.stats')}
                        </button>
                    )}
                    {/* Only offered where marks are actually being held; on the
                        default setting there is nothing to release. */}
                    {a.status !== 'draft' && a.release_marks_immediately === false && (
                        <button className="btn btn-outline btn-sm" onClick={() => onRelease(a)}
                            title={t('teacher.assignments.releaseTooltip')}>
                            <span className="material-symbols-rounded icon-sm">send</span>
                            {t('teacher.assignments.release')}
                        </button>
                    )}
                    {a.status === 'active' && (
                        <button className="btn btn-outline btn-sm" onClick={() => onClose(a)}
                            title={t('teacher.assignments.closeTitle')}>
                            <span className="material-symbols-rounded icon-sm">lock</span>
                            {t('common.close')}
                        </button>
                    )}
                    {a.status === 'closed' && (
                        <button className="btn btn-outline btn-sm" onClick={() => onReopen(a)}
                            title={t('teacher.assignments.reopenTitle')}>
                            <span className="material-symbols-rounded icon-sm">lock_open</span>
                            {t('teacher.assignments.reopen')}
                        </button>
                    )}
                    {a.status !== 'closed' && (
                        <button className="btn btn-outline btn-sm" onClick={() => onEdit(a)} title={t('common.edit')}>
                            <span className="material-symbols-rounded icon-sm">edit</span>
                        </button>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => onDuplicate(a)} title={t('common.duplicate')}>
                        <span className="material-symbols-rounded icon-sm">content_copy</span>
                    </button>
                    <button className="btn btn-outline btn-sm btn-destructive-outline" onClick={() => onDelete(a.id)} title={t('common.delete')}>
                        <span className="material-symbols-rounded icon-sm">delete</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Class filter dropdown ─────────────────────────────────────────────────────

function ClassDropdown({ value, onChange, options }) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
        function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])
    return (
        <div ref={ref} className="class-dd-wrap">
            <button className="btn btn-outline class-dd-btn" onClick={() => setOpen(o => !o)}>
                <span className="material-symbols-rounded icon-md">class</span>
                {value === 'all' ? t('common.allClasses') : value}
                <span className="material-symbols-rounded icon-md ml-auto">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div className="class-dd-menu">
                    {[{ key: 'all', label: t('common.allClasses') }, ...options.map(o => ({ key: o, label: o }))].map(item => (
                        <button key={item.key} onClick={() => { onChange(item.key); setOpen(false) }}
                            className={`class-dd-opt${value === item.key ? ' active' : ''}`}>
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function TeacherAssignments() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const toast = useToast()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [assignments,     setAssignments]     = useState([])
    const [loading,      setLoading]      = useState(true)
    const [loadError,    setLoadError]    = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')
    const [classFilter,  setClassFilter]  = useState('all')
    const [publishing,   setPublishing]   = useState(null)
    const [viewSubs,     setViewSubs]     = useState(null)   // assignment to view submissions for
    const [grading,      setGrading]      = useState(null)   // paper assignment being graded
    const [reviewing,    setReviewing]    = useState(null)   // submission id being re-marked
    const [statsFor,     setStatsFor]     = useState(null)   // assignment whose stats are open

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || t('roles.teacher')
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    /* The class and subject lists moved out with the form: this page filters by
       the class names already on the assignments, so fetching them again here
       would be two requests nothing reads. */
    useEffect(() => {
        getTeacherAssignments()
            .then(asgList => setAssignments(Array.isArray(asgList) ? asgList : []))
            .catch(err => setLoadError(err?.message || t('common.loadFailed')))
            .finally(() => setLoading(false))
    }, [t])

    const classNames = [...new Set(assignments.map(a => a.class_name).filter(Boolean))]
    const statusTabs = STATUS_TABS.map(tab => ({
        ...tab,
        label: t(tab.labelKey),
        count: tab.key === 'all' ? undefined : assignments.filter(a => a.status === tab.key).length,
    }))

    const visible = assignments.filter(a => {
        if (statusFilter !== 'all' && a.status !== statusFilter)   return false
        if (classFilter  !== 'all' && a.class_name !== classFilter) return false
        return true
    })

    async function handlePublish(id) {
        setPublishing(id)
        try {
            const updated = await updateTeacherAssignment(id, { status: 'active' })
            setAssignments(prev => prev.map(a => a.id === id ? updated : a))
        } catch { /* leave as draft */ }
        finally { setPublishing(null) }
    }

    async function handleDelete(id) {
        try {
            await deleteTeacherAssignment(id)
            setAssignments(prev => prev.filter(a => a.id !== id))
        } catch { /* silent */ }
    }

    async function handleDuplicate(a) {
        try {
            const created = await createTeacherAssignment({
                title:              t('teacher.assignments.copyOf', { title: a.title }),
                class_obj:          a.class_id,
                subject:            a.subject_id,
                mode:               a.mode,
                status:             'draft',
                due_date:           a.due_date,
                max_score:          a.max_score,
                instructions:       a.instructions || '',
                questions:          a.questions || [],
                time_limit_minutes: a.time_limit_minutes || null,
                shuffle_questions:  a.shuffle_questions || false,
            })
            setAssignments(prev => [created, ...prev])
        } catch { /* silent */ }
    }

    async function handleClose(a) {
        try {
            const updated = await closeTeacherAssignment(a.id)
            setAssignments(prev => prev.map(x => x.id === a.id ? updated : x))
        } catch (e) {
            setLoadError(errorMessage(e, t('teacher.assignments.closeFailed')))
        }
    }

    async function handleReopen(a) {
        try {
            const updated = await reopenTeacherAssignment(a.id)
            setAssignments(prev => prev.map(x => x.id === a.id ? updated : x))
        } catch (e) {
            setLoadError(errorMessage(e, t('teacher.assignments.reopenFailed')))
        }
    }

    async function handleRelease(a) {
        try {
            const res = await releaseAssignmentMarks(a.id)
            setLoadError(null)
            // Refetch rather than patch: releasing changes every submission's
            // state, and the card shows counts derived from them.
            const refreshed = await getTeacherAssignments()
            setAssignments(Array.isArray(refreshed) ? refreshed : [])
            toast.success(t('teacher.assignments.releasedToast', { count: res?.released ?? 0 }))
        } catch (e) {
            setLoadError(errorMessage(e, t('teacher.assignments.releaseFailed')))
        }
    }

    function handleEdit(a) { navigate(`/teacher/assignments/${a.id}/edit`) }

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>

            {viewSubs && (
                <SubmissionsModal assignment={viewSubs} onClose={() => setViewSubs(null)}
                    onReview={setReviewing} />
            )}

            {reviewing && (
                <SubmissionReviewModal submissionId={reviewing}
                    onClose={() => setReviewing(null)} />
            )}

            {statsFor && (
                <AssignmentStatsModal assignment={statsFor} onClose={() => setStatsFor(null)} />
            )}

            {grading && (
                <GradeModal assignment={grading} onClose={() => setGrading(null)} />
            )}

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.assignments')}
                        subtitle={t('teacher.assignments.subtitle')}
                        userName={fullName} userRole={t('roles.teacher')}
                        userInitials={initials} avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {loadError && (
                            <div className="alert alert-danger u-mb">
                                <span className="material-symbols-rounded alert-icon">error</span>
                                {loadError}
                            </div>
                        )}

                        <div className="portal-stat-grid mb-1-5">
                            {[
                                { icon: 'assignment',   value: assignments.length,                                    label: t('teacher.assignments.statTotal'),         colorClass: ''        },
                                { icon: 'check_circle', value: assignments.filter(a => a.status === 'active').length, label: t('common.active'),                         colorClass: 'success' },
                                { icon: 'quiz',         value: assignments.filter(a => a.mode === 'online').length,   label: t('teacher.assignments.statOnlineQuizzes'), colorClass: ''        },
                                { icon: 'draft',        value: assignments.filter(a => a.status === 'draft').length,  label: t('teacher.assignments.statDrafts'),        colorClass: 'warning' },
                            ].map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="asgn-toolbar">
                            <FilterBar options={statusTabs} active={statusFilter} onChange={setStatusFilter} />
                            <div className="asgn-toolbar-right">
                                <ClassDropdown value={classFilter} onChange={setClassFilter} options={classNames} />
                                <button className="btn btn-primary whitespace-nowrap"
                                    onClick={() => navigate('/teacher/assignments/new')}>
                                    <span className="material-symbols-rounded icon-sm">add</span>
                                    {t('teacher.assignments.newAssignment')}
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <EmptyState icon="sync" title={t('teacher.assignments.loadingAssignments')} description={t('teacher.assignments.fetching')} />
                        ) : visible.length > 0 ? (
                            <div className="asgn-list-wrap">
                                <div className="asgn-list-header">
                                    <span className="asgn-list-count">{t('teacher.assignments.assignmentCount', { count: visible.length })}</span>
                                    <span className="asgn-list-filter">
                                        {classFilter !== 'all' ? classFilter : t('common.allClasses')}
                                        {' · '}
                                        {statusFilter !== 'all' ? t(STATUS_LABEL_KEYS[statusFilter]) : t('common.all')}
                                    </span>
                                </div>
                                <div className="asgn-list-body">
                                    {visible.map(a => (
                                        <div key={a.id} className="asgn-list-item">
                                            <AssignmentCard
                                                a={a}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                                onPublish={handlePublish}
                                                onDuplicate={handleDuplicate}
                                                onViewSubmissions={setViewSubs}
                                                onGrade={setGrading}
                                                onClose={handleClose}
                                                onReopen={handleReopen}
                                                onStats={setStatsFor}
                                                onRelease={handleRelease}
                                                publishing={publishing}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <EmptyState
                                icon={statusFilter === 'draft' ? 'draft' : 'assignment'}
                                title={statusFilter === 'all' && classFilter === 'all'
                                    ? t('teacher.assignments.noAssignments')
                                    : t('teacher.assignments.noMatching')}
                                description={statusFilter !== 'all' || classFilter !== 'all'
                                    ? t('teacher.assignments.tryClearing')
                                    : t('teacher.assignments.getStarted')}
                                secondAction={statusFilter !== 'all' || classFilter !== 'all' ? {
                                    label: t('common.clearFilters'), icon: 'filter_alt_off',
                                    onClick: () => { setStatusFilter('all'); setClassFilter('all') },
                                } : undefined}
                                action={statusFilter === 'all' && classFilter === 'all' ? {
                                    label: t('teacher.assignments.newAssignment'), icon: 'add',
                                    onClick: () => navigate('/teacher/assignments/new'),
                                } : undefined}
                            />
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
