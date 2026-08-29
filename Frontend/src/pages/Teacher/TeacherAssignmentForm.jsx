import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useNotifications } from '../../hooks/useNotifications'
import { FormSelect } from '../../components/ui/FormSelect'
import { QuizBuilder } from '../../components/assignments/QuizBuilder'
import { QuestionBankModal } from '../../components/assignments/QuestionBankModal'
import { PreviewModal } from '../../components/assignments/PreviewModal'
import { EMPTY_FORM, calcMaxScore } from '../../components/assignments/quizModel'
import { AssignmentRules } from '../../components/assignments/AssignmentRules'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import {
    getTeacherMyClasses, getTeacherAssignment,
    createTeacherAssignment, updateTeacherAssignment,
} from '../../api/teacher'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'

/**
 * Create or edit an assignment, on a page of its own.
 *
 * This used to be a modal. Setting an assignment is not a one-field decision:
 * an online quiz carries an unbounded list of questions, each with its own
 * options, marks, image and explanation, and a teacher writing one needs to
 * scroll it, reorder it, preview it and pull from the question bank. A dialog
 * box sized to sit inside another page could not hold that without becoming a
 * scroll box within a scroll box, and it put the work at risk of a stray click
 * on the backdrop.
 *
 * On a page the work gets the whole viewport, it survives a refresh, it can be
 * linked to and returned to, and leaving is a deliberate act - which is why
 * there is an unsaved-changes guard below rather than a dismissable overlay.
 */
export function TeacherAssignmentForm() {
    const { t } = useTranslation()
    const { id } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const isEdit = Boolean(id)

    const [form,      setForm]      = useState({ ...EMPTY_FORM })
    const [questions, setQuestions] = useState([])
    const [classSubjectMap, setClassSubjectMap] = useState([])
    const [loading,   setLoading]   = useState(true)
    const [loadError, setLoadError] = useState(null)
    const [saving,    setSaving]    = useState(false)
    const [saveError, setSaveError] = useState(null)
    const [showBank,    setShowBank]    = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    /* Compared against the live form to tell an edited assignment from one that
       was merely opened — see the navigation guard below. */
    const [pristine,  setPristine]  = useState(null)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || t('roles.teacher')
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    useEffect(() => {
        let alive = true
        const wanted = [getTeacherMyClasses()]
        if (isEdit) wanted.push(getTeacherAssignment(id))

        Promise.all(wanted)
            .then(([classList, assignment]) => {
                if (!alive) return
                setClassSubjectMap(Array.isArray(classList) ? classList : [])

                const next = assignment
                    ? {
                        title:              assignment.title,
                        class_obj:          String(assignment.class_id),
                        subject:            String(assignment.subject_id),
                        due_date:           assignment.due_date,
                        max_score:          String(assignment.max_score),
                        instructions:       assignment.instructions || '',
                        status:             assignment.status,
                        mode:               assignment.mode,
                        time_limit_minutes: assignment.time_limit_minutes ? String(assignment.time_limit_minutes) : '',
                        shuffle_questions:  assignment.shuffle_questions || false,
                        accept_late_submissions: assignment.accept_late_submissions ?? true,
                        max_attempts:       String(assignment.max_attempts ?? 1),
                        release_marks_immediately: assignment.release_marks_immediately ?? true,
                        // The URL of the worksheet already uploaded, if any.
                        // Replaced only when a new File is picked.
                        attachment:         assignment.attachment || null,
                    }
                    : { ...EMPTY_FORM }
                const nextQuestions = assignment?.questions?.length ? assignment.questions : []

                setForm(next)
                setQuestions(nextQuestions)
                setPristine(JSON.stringify({ form: next, questions: nextQuestions }))
            })
            .catch(e => alive && setLoadError(errorMessage(e, t('common.loadFailed'))))
            .finally(() => alive && setLoading(false))

        return () => { alive = false }
    }, [id, isEdit, t])

    const dirty = pristine !== null && pristine !== JSON.stringify({ form, questions })

    /* Leaving with unsaved questions loses real work - a long quiz is half an
       hour of typing - so a refresh, a tab close or a click on Back stops to
       ask first.

       React Router's useBlocker would also cover a click on the sidebar, but
       it needs a data router and this app mounts a plain <BrowserRouter>, where
       it throws. So the guard covers the two exits this page owns; navigating
       away through the sidebar still leaves without warning. */
    useEffect(() => {
        if (!dirty) return
        function warn(e) { e.preventDefault(); e.returnValue = '' }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [dirty])

    function leave() {
        if (dirty && !window.confirm(t('teacher.assignments.discardChanges'))) return
        navigate('/teacher/assignments')
    }

    function handle(e) {
        const { name, value, type, checked } = e.target
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }

    /* A subject only exists within a class this teacher teaches, so changing
       the class drops a subject that no longer applies rather than submitting
       a pair the backend will reject. */
    function handleClassChange(v) {
        setForm(prev => {
            const valid = classSubjectMap
                .filter(cs => String(cs.class_id) === String(v))
                .map(cs => String(cs.subject_id))
            return {
                ...prev,
                class_obj: v,
                subject: valid.includes(String(prev.subject)) ? prev.subject : '',
            }
        })
    }

    const classOptions = useMemo(() => {
        const seen = new Set()
        return classSubjectMap
            .filter(c => !seen.has(c.class_id) && seen.add(c.class_id))
            .map(c => ({ value: String(c.class_id), label: c.class_name }))
    }, [classSubjectMap])

    const subjectOptions = form.class_obj
        ? classSubjectMap
            .filter(cs => String(cs.class_id) === String(form.class_obj))
            .map(cs => ({ value: String(cs.subject_id), label: cs.subject_name }))
        : []

    const isValid = form.title && form.class_obj && form.subject && form.due_date &&
        (form.mode === 'paper' ? !!form.max_score : questions.length > 0)

    async function handleSave(statusOverride) {
        const status = statusOverride || form.status
        if (!isValid) return
        setSaving(true); setSaveError(null)

        const payload = {
            title:              form.title,
            class_obj:          form.class_obj,
            subject:            form.subject,
            due_date:           form.due_date,
            max_score:          form.mode === 'online' ? calcMaxScore(questions) : parseInt(form.max_score),
            instructions:       form.instructions,
            status,
            mode:               form.mode,
            questions:          form.mode === 'online' ? questions : [],
            time_limit_minutes: form.time_limit_minutes ? parseInt(form.time_limit_minutes) : null,
            shuffle_questions:  form.mode === 'online' ? form.shuffle_questions : false,
            accept_late_submissions: form.accept_late_submissions,
            release_marks_immediately: form.release_marks_immediately,
            // Attempts only mean anything for a quiz; a paper is handed in once.
            max_attempts:       form.mode === 'online' ? (parseInt(form.max_attempts) || 1) : 1,
            // A File replaces the worksheet, null clears it, and a string is
            // the URL of the one already there - which must not be re-sent.
            attachment:         form.attachment instanceof File ? form.attachment
                                : form.attachment === null ? null : undefined,
        }

        try {
            if (isEdit) await updateTeacherAssignment(id, payload)
            else        await createTeacherAssignment(payload)
            /* Cleared before navigating so the guard above does not challenge
               the redirect we are about to make ourselves. */
            setPristine(JSON.stringify({ form: { ...form, status }, questions }))
            toast.success(status === 'active'
                ? t('teacher.assignments.publishedToast')
                : t('teacher.assignments.savedDraftToast'))
            navigate('/teacher/assignments')
        } catch (e) {
            const message = errorMessage(e, t('common.saveFailed'))
            setSaveError(message)
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>

            {showBank && (
                <QuestionBankModal
                    onClose={() => setShowBank(false)}
                    onImport={qs => setQuestions(prev => [...prev, ...qs])}
                />
            )}
            {showPreview && form.mode === 'online' && (
                <PreviewModal
                    assignment={form}
                    questions={questions}
                    onClose={() => setShowPreview(false)}
                />
            )}

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={isEdit
                            ? t('teacher.assignments.editAssignment')
                            : t('teacher.assignments.newAssignment')}
                        subtitle={t('teacher.assignments.formSubtitle')}
                        userName={fullName} userRole={t('roles.teacher')}
                        userInitials={initials} avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <button type="button" className="btn btn-outline btn-sm u-mb u-self-start"
                            onClick={leave}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">arrow_back</span>
                            {t('teacher.assignments.backToList')}
                        </button>

                        {loadError && (
                            <div className="alert alert-danger u-mb">
                                <span className="material-symbols-rounded alert-icon" aria-hidden="true">error</span>
                                {loadError}
                            </div>
                        )}

                        {loading ? (
                            <p className="u-pad u-muted">{t('common.loading')}</p>
                        ) : (
                            <>
                                {/* Paper or online. Chosen first because it decides
                                    which of the fields below even apply. */}
                                <div className="card u-mb">
                                    <div className="card-content">
                                        <div className="section-label-sm">{t('teacher.assignments.modeLabel')}</div>
                                        <div className="resp-grid-2 grid-gap-sm">
                                            {[
                                                { key: 'paper',  icon: 'assignment', label: t('teacher.assignments.modePaper'),  sub: t('teacher.assignments.modePaperSub')  },
                                                { key: 'online', icon: 'quiz',       label: t('teacher.assignments.modeOnline'), sub: t('teacher.assignments.modeOnlineSub') },
                                            ].map(m => (
                                                <button key={m.key} type="button"
                                                    onClick={() => setForm(p => ({ ...p, mode: m.key }))}
                                                    aria-pressed={form.mode === m.key}
                                                    className={`mode-toggle-btn${form.mode === m.key ? ' active' : ''}`}>
                                                    <div className="mode-toggle-btn-header">
                                                        <span className="material-symbols-rounded mode-toggle-btn-icon" aria-hidden="true">{m.icon}</span>
                                                        <span className="mode-toggle-btn-label">{m.label}</span>
                                                    </div>
                                                    <div className="mode-toggle-btn-sub">{m.sub}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="card u-mb">
                                    <div className="card-header">
                                        <h2 className="card-title">{t('teacher.assignments.detailsLabel')}</h2>
                                    </div>
                                    <div className="card-content">
                                        <div className="resp-grid-2 grid-gap-sm">
                                            <div className="form-group col-full">
                                                <label className="form-label" htmlFor="asgn-title">{t('common.titleRequired')}</label>
                                                <input id="asgn-title" className="form-control" name="title"
                                                    value={form.title} onChange={handle}
                                                    placeholder={form.mode === 'online'
                                                        ? t('teacher.assignments.egQuizTitle')
                                                        : t('teacher.assignments.egPaperTitle')} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">{t('common.classRequired')}</label>
                                                <FormSelect value={form.class_obj} onChange={handleClassChange}
                                                    placeholder={t('teacher.assignments.selectClass')}
                                                    options={classOptions} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">{t('common.subjectRequired')}</label>
                                                <FormSelect value={form.subject}
                                                    onChange={v => setForm(p => ({ ...p, subject: v }))}
                                                    placeholder={form.class_obj
                                                        ? t('teacher.assignments.selectSubject')
                                                        : t('teacher.assignments.selectClassFirst')}
                                                    disabled={!form.class_obj || subjectOptions.length === 0}
                                                    options={subjectOptions} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="asgn-due">{t('teacher.assignments.dueDateRequired')}</label>
                                                <input id="asgn-due" className="form-control input-icon-field" type="date"
                                                    name="due_date" value={form.due_date} onChange={handle} />
                                            </div>
                                            {form.mode === 'paper' && (
                                                <div className="form-group">
                                                    <label className="form-label" htmlFor="asgn-max">{t('teacher.assignments.maxScoreRequired')}</label>
                                                    <input id="asgn-max" className="form-control" type="number" min="1"
                                                        name="max_score" value={form.max_score} onChange={handle}
                                                        placeholder={t('teacher.assignments.egThirty')} />
                                                </div>
                                            )}
                                            {form.mode === 'online' && (
                                                <>
                                                    <div className="form-group">
                                                        <label className="form-label" htmlFor="asgn-limit">
                                                            {t('teacher.assignments.timeLimit')}{' '}
                                                            <span className="label-muted">{t('teacher.assignments.minutesOptional')}</span>
                                                        </label>
                                                        <input id="asgn-limit" className="form-control" type="number" min="1"
                                                            name="time_limit_minutes" value={form.time_limit_minutes}
                                                            onChange={handle} placeholder={t('teacher.assignments.egTimeLimit')} />
                                                    </div>
                                                    <div className="form-group shuffle-row col-full">
                                                        <input type="checkbox" id="shuffle" name="shuffle_questions"
                                                            checked={form.shuffle_questions} onChange={handle}
                                                            className="checkbox-sm" />
                                                        <label htmlFor="shuffle" className="u-pointer u-sm">
                                                            {t('teacher.assignments.shuffleLabel')}
                                                        </label>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label" htmlFor="asgn-instructions">{t('teacher.assignments.instructions')}</label>
                                            <textarea id="asgn-instructions" className="form-control textarea-sm"
                                                name="instructions" value={form.instructions} onChange={handle}
                                                placeholder={t('teacher.assignments.describePlaceholder')} />
                                        </div>
                                    </div>
                                </div>

                                <AssignmentRules
                                    form={form}
                                    onChange={patch => setForm(p => ({ ...p, ...patch }))}
                                />

                                {form.mode === 'online' && (
                                    <div className="card u-mb">
                                        <div className="card-header">
                                            <h2 className="card-title">{t('teacher.assignments.quizQuestions')}</h2>
                                        </div>
                                        <div className="card-content">
                                            <QuizBuilder
                                                questions={questions}
                                                onChange={setQuestions}
                                                onOpenBank={() => setShowBank(true)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* The action bar sticks to the bottom: on a long quiz the
                                    save button would otherwise be several screens below
                                    the question being typed. */}
                                <div className="form-actions-bar">
                                    <span className={`modal-footer-hint${saveError ? ' has-error' : ''}`}>
                                        {saveError
                                            || (!isValid && t('teacher.assignments.fillRequired'))
                                            || (dirty ? t('teacher.assignments.unsavedChanges') : '')}
                                    </span>
                                    {form.mode === 'online' && questions.length > 0 && (
                                        <button className="btn btn-outline" type="button" onClick={() => setShowPreview(true)}>
                                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">preview</span>
                                            {t('teacher.assignments.preview')}
                                        </button>
                                    )}
                                    <button className="btn btn-outline" type="button" disabled={saving}
                                        onClick={() => handleSave('draft')}>
                                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">save</span>
                                        {t('teacher.assignments.saveAsDraft')}
                                    </button>
                                    <button className="btn btn-primary" type="button" disabled={!isValid || saving}
                                        onClick={() => handleSave('active')}>
                                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">publish</span>
                                        {saving ? t('common.saving') : t('common.publish')}
                                    </button>
                                </div>
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
