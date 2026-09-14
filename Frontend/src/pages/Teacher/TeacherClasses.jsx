import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { Modal } from '../../components/ui/Modal'
import { DataTable } from '../../components/ui/DataTable'
import { SearchBar } from '../../components/ui/SearchBar'
import { TabGroup } from '../../components/ui/TabGroup'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import '../../styles/tables.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { getTeacherMyClasses, getTeacherStudents, getTeacherResultList, bulkSaveResults } from '../../api/teacher'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { sectionsFromClasses } from '../../utils/classes'

const CARD_BG = ['#eef6ff', '#edfaf4', '#f3f0ff', '#fff7ed', '#e8f8fb', '#fff0f3']

const ASSESSMENT_TYPES = [
    { value: 'quiz',         labelKey: 'teacher.classes.typeQuiz'         },
    { value: 'homework',     labelKey: 'teacher.classes.typeHomework'     },
    { value: 'project',      labelKey: 'teacher.classes.typeProject'      },
    { value: 'presentation', labelKey: 'teacher.classes.typePresentation' },
    { value: 'lab',          labelKey: 'teacher.classes.typeLab'          },
]

function getGrade(pct) {
    if (pct >= 80) return { label: 'A', color: 'var(--success)' }
    if (pct >= 70) return { label: 'B', color: '#3b82f6' }
    if (pct >= 60) return { label: 'C', color: '#f59e0b' }
    if (pct >= 50) return { label: 'D', color: '#f97316' }
    return { label: 'F', color: 'var(--destructive)' }
}

/* A room arrives either as a bare code ("12") or already named ("Room 100",
   "Lab 2"). The card used to prefix "Room" to both, so seeded data read
   "Room Room 100". Only a bare code gets the word. */
function roomLabel(t, room) {
    return /^\d/.test(String(room)) ? t('teacher.classes.room', { room }) : room
}

// ── Class Card ────────────────────────────────────────────────────────────────
function ClassCard({ cls, colorIndex, onOpenStudents, onEnterResults }) {
    const { t } = useTranslation()
    const bg = CARD_BG[colorIndex % CARD_BG.length]
    return (
        <div className="class-detail-card" style={{ background: bg }}>
            <div className="class-header">
                <div className="class-title-section">
                    <h3>{cls.class_name}</h3>
                    <span className="class-subject">{cls.subject_name}</span>
                </div>
            </div>

            <div className="class-stats">
                <div className="stat-item">
                    <div className="stat-value">{cls.student_count}</div>
                    <div className="stat-label">{t('teacher.classes.students')}</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{cls.avg_score != null ? `${cls.avg_score}%` : '-'}</div>
                    <div className="stat-label">{t('common.avgScore')}</div>
                </div>
            </div>

            {(cls.schedule_days || cls.room_number) && (
                <div className="class-schedule">
                    {cls.schedule_days && (
                        <div className="class-schedule-item">
                            <span className="material-symbols-rounded icon-schedule" aria-hidden="true">schedule</span>
                            <span>{cls.schedule_days}{cls.schedule_time ? ` · ${cls.schedule_time.slice(0, 5)}` : ''}</span>
                        </div>
                    )}
                    {cls.room_number && (
                        <div className="class-schedule-item">
                            <span className="material-symbols-rounded icon-schedule" aria-hidden="true">room</span>
                            <span>{roomLabel(t, cls.room_number)}</span>
                        </div>
                    )}
                </div>
            )}

            <div className="class-actions">
                <button className="btn btn-primary btn-sm" onClick={() => onOpenStudents(cls)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">group</span>
                    {t('teacher.classes.viewStudents')}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => onEnterResults(cls)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">edit_note</span>
                    {t('teacher.classes.enterResults')}
                </button>
            </div>
        </div>
    )
}

// ── Students tab ─────────────────────────────────────────────────────────────
/* Performance and attendance bands. Returned as translation keys, not labels,
   so the badge follows the interface language. */
function performanceBadge(pct) {
    if (pct == null) return { key: null,                             cls: 'badge-soft-warning' }
    if (pct >= 75)   return { key: 'teacher.students.perfExcellent', cls: 'badge-soft-success' }
    if (pct >= 50)   return { key: 'teacher.students.perfGood',      cls: 'badge-soft-info'    }
    return                  { key: 'teacher.students.perfFair',      cls: 'badge-soft-warning' }
}

function attendanceBadgeClass(pct) {
    if (pct == null) return 'badge-soft-warning'
    if (pct >= 85)   return 'badge-soft-success'
    if (pct >= 70)   return 'badge-soft-warning'
    return 'badge-soft-error'
}

const PERF_FILTERS = [
    { value: 'all',    labelKey: 'teacher.students.perfAll'    },
    { value: 'high',   labelKey: 'teacher.students.perfHigh'   },
    { value: 'medium', labelKey: 'teacher.students.perfMedium' },
    { value: 'low',    labelKey: 'teacher.students.perfLow'    },
]

function matchesPerformance(rate, filter) {
    if (filter === 'all') return true
    if (rate == null)     return false
    if (filter === 'high')   return rate >= 75
    if (filter === 'medium') return rate >= 50 && rate < 75
    return rate < 50
}

function StudentRow({ student, onView }) {
    const { t } = useTranslation()
    const perf = performanceBadge(student.performance_rate)
    return (
        <tr>
            <td>
                <div className="student-info-cell">
                    <div className="student-avatar">{student.initials}</div>
                    <div>
                        <div className="student-name">{student.full_name}</div>
                        <div className="student-id-text">{student.student_code}</div>
                    </div>
                </div>
            </td>
            <td>{student.class_name}</td>
            <td>
                <span className={`badge ${attendanceBadgeClass(student.attendance_rate)}`}>
                    {student.attendance_rate != null ? `${student.attendance_rate}%` : '-'}
                </span>
            </td>
            <td>
                <span className={`badge ${perf.cls}`}>
                    {perf.key ? t(perf.key) : '-'}
                    {student.performance_rate != null ? ` (${student.performance_rate}%)` : ''}
                </span>
            </td>
            <td>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => onView(student)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">visibility</span>
                    {t('common.view')}
                </button>
            </td>
        </tr>
    )
}

/* The student's profile, plus the one thing the old per-class pop-up did that
   the table cannot: go straight to entering their marks. A teacher can teach
   a class more than one subject, so each subject gets its own button. */
function StudentProfile({ student, subjects, onClose, onEnterResults }) {
    const { t } = useTranslation()
    const perf = performanceBadge(student.performance_rate)
    return (
        <Modal title={t('teacher.students.profileTitle')} icon="person" onClose={onClose}>
            <div className="student-profile-header">
                <div className="student-avatar student-profile-avatar">{student.initials}</div>
                <div>
                    <div className="student-profile-name">{student.full_name}</div>
                    <div className="student-profile-code">{student.student_code}</div>
                </div>
            </div>
            <div className="resp-grid-2 u-gap-sm">
                <div>
                    <div className="detail-label">{t('common.class')}</div>
                    <div className="detail-value">{student.class_name}</div>
                </div>
                <div>
                    <div className="detail-label">{t('teacher.students.colAttendance')}</div>
                    <span className={`badge ${attendanceBadgeClass(student.attendance_rate)}`}>
                        {student.attendance_rate != null ? `${student.attendance_rate}%` : '-'}
                    </span>
                </div>
                <div>
                    <div className="detail-label">{t('teacher.students.colPerformance')}</div>
                    <span className={`badge ${perf.cls}`}>
                        {student.performance_rate != null ? `${student.performance_rate}%` : '-'}
                    </span>
                </div>
            </div>
            {subjects.length > 0 && (
                <div className="u-mt">
                    <div className="detail-label">{t('teacher.students.subjectsYouTeach')}</div>
                    <div className="u-row-sm u-wrap">
                        {subjects.map(cls => (
                            <button key={cls.subject_id} type="button" className="btn btn-primary btn-sm"
                                onClick={() => onEnterResults(cls)}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">edit_note</span>
                                {t('teacher.classes.enterResultsSubject', { subject: cls.subject_name })}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </Modal>
    )
}

// ── Results Modal (assessment picker → score table) ───────────────────────────
function ResultsModal({ cls, onClose }) {
    const { t } = useTranslation()
    const [step,       setStep]       = useState('pick')  // 'pick' | 'view' | 'new'
    const [titles,     setTitles]     = useState([])
    const [students,   setStudents]   = useState([])
    const [rows,       setRows]       = useState([])
    const [loadingInit, setLoadingInit] = useState(true)
    const [loadingRows, setLoadingRows] = useState(false)
    const [saving,     setSaving]     = useState(false)
    const [error,      setError]      = useState(null)
    const [savedMsg,   setSavedMsg]   = useState(false)

    const [selectedTitle, setSelectedTitle] = useState(null)
    const [scores,        setScores]        = useState({})
    const [newForm, setNewForm] = useState({
        assessment_title: '',
        assessment_type:  'quiz',
        date: new Date().toISOString().split('T')[0],
        max_score: '',
    })

    useEffect(() => {
        Promise.all([
            getTeacherResultList({ class_id: cls.class_id }).catch(() => ({ assessment_titles: [], results: [] })),
            getTeacherStudents({ class_id: cls.class_id }).catch(() => []),
        ]).then(([res, stu]) => {
            setTitles(res.assessment_titles || [])
            setStudents(Array.isArray(stu) ? stu : [])
        }).finally(() => setLoadingInit(false))
    }, [cls.class_id])

    function openExisting(title) {
        setSelectedTitle(title)
        setLoadingRows(true)
        setError(null)
        getTeacherResultList({ class_id: cls.class_id, assessment_title: title })
            .then(res => {
                const results = res.results || []
                const scoreMap = {}
                results.forEach(r => { scoreMap[r.student_id] = String(r.score_obtained) })
                setScores(scoreMap)
                setRows(results)
            })
            .catch(() => setError(t('teacher.classes.loadResultsFailed')))
            .finally(() => setLoadingRows(false))
        setStep('view')
    }

    function openNew() {
        setScores({})
        setRows([])
        setStep('new')
    }

    async function handleSaveNew() {
        if (!newForm.assessment_title || !newForm.max_score || !newForm.date) return
        const entries = students
            .filter(s => scores[s.student_id] !== undefined && scores[s.student_id] !== '')
            .map(s => ({ student_id: s.student_id, score_obtained: parseFloat(scores[s.student_id]) || 0 }))
        if (entries.length === 0) { setError(t('teacher.classes.enterScoreRequired')); return }
        setSaving(true)
        setError(null)
        try {
            await bulkSaveResults({
                class_id:         cls.class_id,
                subject_id:       cls.subject_id,
                assessment_title: newForm.assessment_title,
                assessment_type:  newForm.assessment_type,
                date:             newForm.date,
                max_score:        parseFloat(newForm.max_score),
                entries,
            })
            setSavedMsg(true)
            setTimeout(() => setSavedMsg(false), 3000)
            setTitles(prev => prev.includes(newForm.assessment_title) ? prev : [...prev, newForm.assessment_title])
        } catch {
            setError(t('teacher.classes.saveResultsFailed'))
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveExisting() {
        if (!selectedTitle) return
        const max = rows[0]?.max_score ?? 100
        const entries = students
            .filter(s => scores[s.student_id] !== undefined && scores[s.student_id] !== '')
            .map(s => ({ student_id: s.student_id, score_obtained: parseFloat(scores[s.student_id]) || 0 }))
        if (entries.length === 0) { setError(t('teacher.classes.noScoresToSave')); return }
        setSaving(true)
        setError(null)
        try {
            await bulkSaveResults({
                class_id:         cls.class_id,
                subject_id:       cls.subject_id,
                assessment_title: selectedTitle,
                assessment_type:  'quiz',
                date:             rows[0]?.date || new Date().toISOString().split('T')[0],
                max_score:        max,
                entries,
            })
            setSavedMsg(true)
            setTimeout(() => setSavedMsg(false), 3000)
        } catch {
            setError(t('teacher.classes.saveResultsFailed'))
        } finally {
            setSaving(false)
        }
    }

    // ── Step: Pick assessment ─────────────────────────────────────────────────
    if (step === 'pick') return (
        <Modal title={t('teacher.classes.enterResultsFor', { class: cls.class_name })} icon="edit_note" onClose={onClose} size="wide">
            <p className="modal-desc">{t('teacher.classes.pickIntro')} <strong>{cls.class_name}</strong>.</p>
            {loadingInit ? (
                <p className="u-muted">{t('common.loading')}</p>
            ) : (
                <div className="asgn-pick-list">
                    <button className="asgn-pick-btn" onClick={openNew}>
                        <div>
                            <div className="asgn-pick-title">{t('teacher.classes.newAssessment')}</div>
                            <div className="asgn-pick-meta">{t('teacher.classes.createNewMeta')}</div>
                        </div>
                        <span className="material-symbols-rounded asgn-pick-chevron" aria-hidden="true">chevron_right</span>
                    </button>
                    {titles.map(title => (
                        <button key={title} className="asgn-pick-btn" onClick={() => openExisting(title)}>
                            <div>
                                <div className="asgn-pick-title">{title}</div>
                                <div className="asgn-pick-meta">{t('teacher.classes.viewExistingMeta')}</div>
                            </div>
                            <span className="material-symbols-rounded asgn-pick-chevron" aria-hidden="true">chevron_right</span>
                        </button>
                    ))}
                    {titles.length === 0 && (
                        <p className="tc-note-pad">{t('teacher.classes.noAssessments')}</p>
                    )}
                </div>
            )}
        </Modal>
    )

    // ── Step: View / Edit existing assessment ─────────────────────────────────
    if (step === 'view') {
        const max = rows[0]?.max_score ?? 100
        return (
            <Modal
                title={selectedTitle}
                icon="edit_note"
                onClose={onClose}
                size="wide"
                footer={
                    <div className="modal-footer-row">
                        <button className="btn btn-outline btn-sm mr-auto" onClick={() => setStep('pick')}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">arrow_back</span>
                            {t('common.back')}
                        </button>
                        {error && <span className="results-warning">{error}</span>}
                        {savedMsg && <span className="tc-saved">{t('common.savedBang')}</span>}
                        <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
                        <button className="btn btn-primary" onClick={handleSaveExisting} disabled={saving}>
                            {saving ? t('common.saving') : t('common.saveChanges')}
                        </button>
                    </div>
                }
            >
                <div className="results-info-bar">
                    <div className="results-info-text">
                        <strong>{cls.class_name}</strong> · {cls.subject_name} · {t('teacher.classes.maxLabel')}<strong>{max}</strong>
                    </div>
                </div>
                {loadingRows ? (
                    <p className="u-muted">{t('teacher.classes.loadingScores')}</p>
                ) : (
                    <div className="score-table-body">
                        <div className="score-table-head score-grid-2">
                            <span>{t('common.student')}</span>
                            <span className="center">{t('teacher.classes.scoreOutOf', { max })}</span>
                        </div>
                        {students.map(student => {
                            const scoreVal = scores[student.student_id] ?? ''
                            const pct = scoreVal !== '' ? (parseFloat(scoreVal) / max) * 100 : null
                            const grade = pct != null ? getGrade(pct) : null
                            return (
                                <div key={student.student_id} className="score-row score-grid-2">
                                    <div className="score-student-cell">
                                        <div className="student-avatar score-avatar">{student.initials}</div>
                                        <div className="score-student-info">
                                            <div className="score-student-name">{student.full_name}</div>
                                            <div className="score-student-code">{student.student_code}</div>
                                        </div>
                                    </div>
                                    <div className="score-input-cell u-row-sm">
                                        <input
                                            type="number" min="0" max={max} placeholder="-"
                                            className="score-input"
                                            value={scoreVal}
                                            onChange={e => setScores(prev => ({ ...prev, [student.student_id]: e.target.value }))}
                                        />
                                        {grade && (
                                            <span className="grade-badge tc-grade-badge" style={{ color: grade.color, background: `${grade.color}18` }}>
                                                {grade.label}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Modal>
        )
    }

    // ── Step: New assessment ──────────────────────────────────────────────────
    return (
        <Modal
            title={t('teacher.classes.newAssessment')}
            icon="add"
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-footer-row">
                    <button className="btn btn-outline btn-sm mr-auto" onClick={() => setStep('pick')}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">arrow_back</span>
                        {t('common.back')}
                    </button>
                    {error && <span className="results-warning">{error}</span>}
                    {savedMsg && <span className="tc-saved">{t('common.savedBang')}</span>}
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSaveNew}
                        disabled={saving || !newForm.assessment_title || !newForm.max_score}
                    >
                        {saving ? t('common.saving') : t('teacher.classes.saveResults')}
                    </button>
                </div>
            }
        >
            <div className="resp-grid-2 u-gap-sm u-mb-lg">
                <div className="form-group col-full">
                    <label className="form-label">{t('teacher.classes.assessmentTitleRequired')}</label>
                    <input
                        className="form-control"
                        placeholder={t('teacher.classes.assessmentNamePlaceholder')}
                        value={newForm.assessment_title}
                        onChange={e => setNewForm(p => ({ ...p, assessment_title: e.target.value }))}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('teacher.classes.typeRequired')}</label>
                    <select className="form-control" value={newForm.assessment_type} onChange={e => setNewForm(p => ({ ...p, assessment_type: e.target.value }))}>
                        {ASSESSMENT_TYPES.map(at => <option key={at.value} value={at.value}>{t(at.labelKey)}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">{t('teacher.classes.dateRequired')}</label>
                    <input className="form-control" type="date" value={newForm.date} onChange={e => setNewForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('teacher.classes.maxScoreRequired')}</label>
                    <input className="form-control" type="number" min="1" placeholder={t('teacher.classes.egHundred')} value={newForm.max_score} onChange={e => setNewForm(p => ({ ...p, max_score: e.target.value }))} />
                </div>
            </div>

            <div className="section-label-sm">{t('teacher.classes.enterScoresFor', { class: cls.class_name })}</div>
            <div className="score-table-body">
                <div className="score-table-head score-grid-2">
                    <span>{t('common.student')}</span>
                    <span className="center">{t('teacher.classes.scoreOutOf', { max: newForm.max_score || '?' })}</span>
                </div>
                {students.map(student => {
                    const scoreVal = scores[student.student_id] ?? ''
                    const max = parseFloat(newForm.max_score) || 100
                    const pct = scoreVal !== '' ? (parseFloat(scoreVal) / max) * 100 : null
                    const grade = pct != null ? getGrade(pct) : null
                    return (
                        <div key={student.student_id} className="score-row score-grid-2">
                            <div className="score-student-cell">
                                <div className="student-avatar score-avatar">{student.initials}</div>
                                <div className="score-student-info">
                                    <div className="score-student-name">{student.full_name}</div>
                                    <div className="score-student-code">{student.student_code}</div>
                                </div>
                            </div>
                            <div className="score-input-cell u-row-sm">
                                <input
                                    type="number" min="0" max={newForm.max_score || undefined} placeholder="-"
                                    className="score-input"
                                    value={scoreVal}
                                    onChange={e => setScores(prev => ({ ...prev, [student.student_id]: e.target.value }))}
                                />
                                {grade && (
                                    <span className="grade-badge tc-grade-badge" style={{ color: grade.color, background: `${grade.color}18` }}>
                                        {grade.label}
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}
                {students.length === 0 && (
                    <p className="tc-note-pad">{t('teacher.classes.noStudentsInClass')}</p>
                )}
            </div>
        </Modal>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
/**
 * Classes & Students — what used to be two pages.
 *
 * "My Classes" and "Students" shared their filter, their data and most of
 * their purpose, and the classes page already opened its own cut-down student
 * list in a pop-up. Here the class picker filters both tabs at once, "View
 * students" on a card switches to the Students tab with that class selected,
 * and the student profile leads to results entry. /teacher/students redirects
 * to ?tab=students, so old links and bookmarks still land on the list.
 *
 * Students load once and filter in the browser. The old page refetched on
 * every class change, but the endpoint's `class_id` only narrows the list:
 * attendance and performance are per student for the term, not per class, so
 * the numbers are the same either way.
 */
export function TeacherClasses() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [searchParams, setSearchParams] = useSearchParams()
    const tab = searchParams.get('tab') === 'students' ? 'students' : 'classes'
    const setTab = key => setSearchParams(key === 'students' ? { tab: 'students' } : {}, { replace: true })

    const [classes,         setClasses]         = useState([])
    const [students,        setStudents]        = useState([])
    const [loadingClasses,  setLoadingClasses]  = useState(true)
    const [loadingStudents, setLoadingStudents] = useState(true)
    const [classesError,    setClassesError]    = useState(null)
    const [studentsError,   setStudentsError]   = useState(null)

    const { config } = useSchoolConfig()
    // Rebuilt when either the classes or the school's configuration arrives —
    // the config loads asynchronously, so deriving this once inside the fetch
    // would group years before the section names were known.
    const sections = useMemo(() => sectionsFromClasses(classes, config), [classes, config])

    const [section,  setSection]  = useState('')
    const [year,     setYear]     = useState('')
    const [classVal, setClassVal] = useState('')
    const [search,     setSearch]     = useState('')
    const [perfFilter, setPerfFilter] = useState('all')

    const [resultsClass, setResultsClass] = useState(null)
    const [profile,      setProfile]      = useState(null)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || t('roles.teacher')
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    useEffect(() => {
        getTeacherMyClasses()
            .then(data => setClasses(Array.isArray(data) ? data : []))
            .catch(err => setClassesError(err?.message || t('teacher.students.loadClassesFailed')))
            .finally(() => setLoadingClasses(false))
        getTeacherStudents()
            .then(data => setStudents(Array.isArray(data) ? data : []))
            .catch(err => setStudentsError(err?.message || t('teacher.students.loadStudentsFailed')))
            .finally(() => setLoadingStudents(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /* Which section a year belongs to comes from the school's configuration.
       Both old pages guessed with parseInt(cls.grade) <= 3, which is NaN for a
       year code like "S1" — so choosing a section emptied the page. */
    const sectionOfYear = useMemo(() => {
        const map = new Map()
        for (const sec of sections) for (const y of sec.years) map.set(y.name, sec.name)
        return map
    }, [sections])

    const classByName = useMemo(() => new Map(classes.map(c => [c.class_name, c])), [classes])

    function inPickedClasses(grade, stream) {
        if (section  && sectionOfYear.get(grade) !== section) return false
        if (year     && grade  !== year)     return false
        if (classVal && stream !== classVal) return false
        return true
    }

    const visibleClasses = classes.filter(c => inPickedClasses(c.grade, c.section))

    const q = search.trim().toLowerCase()
    const visibleStudents = students.filter(s => {
        const cls = classByName.get(s.class_name)
        if ((section || year || classVal) && (!cls || !inPickedClasses(cls.grade, cls.section))) return false
        if (q && !s.full_name.toLowerCase().includes(q) && !s.student_code.toLowerCase().includes(q)) return false
        return matchesPerformance(s.performance_rate, perfFilter)
    })

    function showStudentsOf(cls) {
        setSection(sectionOfYear.get(cls.grade) ?? '')
        setYear(cls.grade)
        setClassVal(cls.section)
        setSearch('')
        setTab('students')
    }

    const filtersActive = Boolean(section || year || classVal || q || perfFilter !== 'all')
    function clearFilters() {
        setSection(''); setYear(''); setClassVal(''); setSearch(''); setPerfFilter('all')
    }

    const tabs = [
        { key: 'classes',  label: t('teacher.classes.tabClasses'),  icon: 'book',   count: visibleClasses.length  },
        { key: 'students', label: t('teacher.classes.tabStudents'), icon: 'people', count: visibleStudents.length },
    ]

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>

            {resultsClass && (
                <ResultsModal cls={resultsClass} onClose={() => setResultsClass(null)} />
            )}

            {profile && (
                <StudentProfile
                    student={profile}
                    subjects={classes.filter(c => c.class_name === profile.class_name)}
                    onClose={() => setProfile(null)}
                    onEnterResults={cls => { setProfile(null); setResultsClass(cls) }}
                />
            )}

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('teacher.classes.title')}
                        subtitle={t('teacher.classes.subtitle')}
                        userName={fullName}
                        userRole={t('roles.teacher')}
                        userInitials={initials}
                        avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {/* One filter for both tabs. */}
                        <ClassPicker
                            sections={sections}
                            section={section}   onSectionChange={v => { setSection(v); setYear(''); setClassVal('') }}
                            year={year}         onYearChange={v => { setYear(v); setClassVal('') }}
                            classVal={classVal} onClassChange={setClassVal}
                        />

                        <TabGroup tabs={tabs} value={tab} onChange={setTab} label={t('teacher.classes.title')} />

                        {tab === 'classes' ? (
                            <div className="classes-wrap" role="tabpanel" id="panel-classes" aria-labelledby="tab-classes">
                                <div className="classes-wrap-header">
                                    <div className="classes-wrap-title">{t('teacher.classes.myClasses')}</div>
                                    <span className="classes-wrap-count">
                                        {t('teacher.classes.classCount', { count: visibleClasses.length })}
                                    </span>
                                </div>
                                <div className="classes-wrap-body">
                                    {loadingClasses ? (
                                        <p className="tc-load-pad">{t('common.loadingClasses')}</p>
                                    ) : classesError ? (
                                        <div className="tc-load-err">
                                            <span className="material-symbols-rounded tc-load-err-icon" aria-hidden="true">error</span>
                                            {classesError}
                                        </div>
                                    ) : visibleClasses.length === 0 ? (
                                        <div className="classes-wrap-empty">{t('teacher.classes.noMatching')}</div>
                                    ) : (
                                        <div className="classes-grid">
                                            {visibleClasses.map((cls, i) => (
                                                <ClassCard
                                                    key={`${cls.class_id}-${cls.subject_id}`}
                                                    cls={cls}
                                                    colorIndex={i}
                                                    onOpenStudents={showStudentsOf}
                                                    onEnterResults={setResultsClass}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div role="tabpanel" id="panel-students" aria-labelledby="tab-students">
                                {studentsError && (
                                    <div className="alert alert-danger u-mb" role="alert">
                                        <span className="material-symbols-rounded alert-icon" aria-hidden="true">error</span>
                                        {studentsError}
                                    </div>
                                )}

                                <div className="search-filter-bar mb-5">
                                    <SearchBar
                                        value={search}
                                        onChange={setSearch}
                                        placeholder={t('teacher.classes.searchStudents')}
                                        label={t('teacher.classes.searchStudents')}
                                    />
                                    <div className="filter-group">
                                        <select className="input input-auto" value={perfFilter}
                                            aria-label={t('teacher.students.perfFilterLabel')}
                                            onChange={e => setPerfFilter(e.target.value)}>
                                            {PERF_FILTERS.map(f => <option key={f.value} value={f.value}>{t(f.labelKey)}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <DataTable
                                    title={t('teacher.students.dataTableTitle')}
                                    icon="people"
                                    data={visibleStudents}
                                    columns={[
                                        t('common.student'), t('common.class'),
                                        t('teacher.students.colAttendance'), t('teacher.students.colPerformance'),
                                        t('common.actions'),
                                    ]}
                                    renderRow={s => <StudentRow key={s.student_id} student={s} onView={setProfile} />}
                                    emptyIcon="people"
                                    emptyTitle={loadingStudents ? t('common.loadingStudents') : t('teacher.classes.noStudents')}
                                    emptyDesc={t('teacher.students.noMatch')}
                                    onClearFilters={filtersActive ? clearFilters : undefined}
                                />
                            </div>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
