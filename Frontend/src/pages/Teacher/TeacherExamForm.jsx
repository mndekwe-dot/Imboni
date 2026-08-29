import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useNotifications } from '../../hooks/useNotifications'
import { FormSelect } from '../../components/ui/FormSelect'
import { SectionEditor } from '../../components/exams/SectionEditor'
import {
    EMPTY_EXAM, newSection, totalMarks, questionCount, whyNotSubmittable, TYPE_KEY,
} from '../../components/exams/examModel'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import {
    getTeacherMyClasses, getTeacherExamPaper,
    createTeacherExamPaper, updateTeacherExamPaper, submitTeacherExamPaper,
} from '../../api/teacher'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'

const EXAM_TYPES = ['midterm', 'final', 'quiz', 'mock', 'other']

/**
 * Write an exam paper, on a page of its own.
 *
 * A paper is longer than an assignment and organised differently: sections,
 * each with its own instruction and its own "answer any three of six" rule.
 * The running total in the action bar is the number that matters while
 * writing, so it stays on screen rather than being something to scroll for.
 *
 * Once the paper is handed up it becomes read-only here, because the DOS is
 * reading it — approving one version while the author edits another is how a
 * school ends up printing a paper nobody approved.
 */
export function TeacherExamForm() {
    const { t } = useTranslation()
    const { id } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const isEdit = Boolean(id)

    const [form,     setForm]     = useState({ ...EMPTY_EXAM })
    const [sections, setSections] = useState([])
    const [status,   setStatus]   = useState('draft')
    const [rejection, setRejection] = useState('')
    const [classSubjectMap, setClassSubjectMap] = useState([])
    const [loading,   setLoading]   = useState(true)
    const [loadError, setLoadError] = useState(null)
    const [saving,    setSaving]    = useState(false)
    const [saveError, setSaveError] = useState(null)
    const [pristine,  setPristine]  = useState(null)

    const readOnly = status === 'submitted' || status === 'approved'

    useEffect(() => {
        let alive = true
        async function load() {
            try {
                const classes = await getTeacherMyClasses()
                if (!alive) return
                setClassSubjectMap(Array.isArray(classes) ? classes : classes?.results ?? [])

                if (isEdit) {
                    const paper = await getTeacherExamPaper(id)
                    if (!alive) return
                    const loaded = {
                        title: paper.title ?? '',
                        subject: String(paper.subject ?? ''),
                        class_obj: String(paper.class_obj ?? ''),
                        exam_type: paper.exam_type ?? 'final',
                        duration_minutes: String(paper.duration_minutes ?? '120'),
                        instructions: paper.instructions ?? '',
                    }
                    setForm(loaded)
                    setSections(paper.sections ?? [])
                    setStatus(paper.status ?? 'draft')
                    setRejection(paper.rejection_reason ?? '')
                    setPristine(JSON.stringify({ loaded, sections: paper.sections ?? [] }))
                } else {
                    setSections([newSection(0)])
                    setPristine(JSON.stringify({ loaded: EMPTY_EXAM, sections: [] }))
                }
            } catch (e) {
                if (alive) setLoadError(errorMessage(e, t('teacher.exams.loadFailed')))
            } finally {
                if (alive) setLoading(false)
            }
        }
        load()
        return () => { alive = false }
    }, [id, isEdit, t])

    const marks = useMemo(() => totalMarks(sections), [sections])
    const count = useMemo(() => questionCount(sections), [sections])

    const dirty = pristine !== null &&
        JSON.stringify({ loaded: form, sections }) !== pristine

    /* The app mounts a plain BrowserRouter, so useBlocker is unavailable —
       this covers a closed tab or a reload, and leave() covers our own buttons.
       In-app navigation from the sidebar is not intercepted. */
    useEffect(() => {
        if (!dirty || readOnly) return undefined
        function warn(e) { e.preventDefault(); e.returnValue = '' }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [dirty, readOnly])

    function leave() {
        if (dirty && !readOnly && !window.confirm(t('teacher.exams.leaveWarning'))) return
        navigate('/teacher/exams')
    }

    function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

    function setSection(index, updated) {
        setSections(s => s.map((sec, i) => (i === index ? updated : sec)))
    }

    function moveSection(index, delta) {
        setSections(s => {
            const next = [...s]
            const [moved] = next.splice(index, 1)
            next.splice(index + delta, 0, moved)
            return next
        })
    }

    /* my-classes returns one row per class-subject pair a teacher teaches, not
       classes with subjects nested inside them, so the class list has to be
       de-duplicated and the subject list filtered by the class chosen. */
    const classOptions = useMemo(() => {
        const seen = new Set()
        return classSubjectMap
            .filter(c => !seen.has(c.class_id) && seen.add(c.class_id))
            .map(c => ({ value: String(c.class_id), label: c.class_name }))
    }, [classSubjectMap])

    const subjectOptions = useMemo(() => (
        form.class_obj
            ? classSubjectMap
                .filter(cs => String(cs.class_id) === String(form.class_obj))
                .map(cs => ({ value: String(cs.subject_id), label: cs.subject_name }))
            : []
    ), [classSubjectMap, form.class_obj])

    function body() {
        return {
            title: form.title.trim(),
            subject: form.subject || null,
            class_obj: form.class_obj || null,
            exam_type: form.exam_type,
            duration_minutes: parseInt(form.duration_minutes) || 0,
            instructions: form.instructions,
            sections,
        }
    }

    async function save({ thenSubmit = false } = {}) {
        setSaving(true); setSaveError(null)
        try {
            const saved = isEdit
                ? await updateTeacherExamPaper(id, body())
                : await createTeacherExamPaper(body())

            if (thenSubmit) {
                await submitTeacherExamPaper(saved.id)
                toast.success(t('teacher.exams.submitted'))
            } else {
                toast.success(t('common.saved'))
            }
            navigate('/teacher/exams')
        } catch (e) {
            setSaveError(errorMessage(e, t('common.saveFailed')))
        } finally {
            setSaving(false)
        }
    }

    /* Checked before saving, so the teacher is told here rather than by the
       DOS opening an unusable paper. */
    const blocker = whyNotSubmittable(form, sections)

    return (
        <div className="dashboard-page" data-portal="teacher">
            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={isEdit ? t('teacher.exams.editTitle') : t('teacher.exams.newTitle')}
                        subtitle={t('teacher.exams.formSubtitle')}
                        userRole={t('roles.teacher')}
                        avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {loading ? (
                            <p className="u-muted">{t('common.loading')}</p>
                        ) : loadError ? (
                            <p className="form-error">{loadError}</p>
                        ) : (
                            <>
                                {readOnly && (
                                    <div className="alert alert-info u-mb">
                                        {status === 'approved'
                                            ? t('teacher.exams.approvedLocked')
                                            : t('teacher.exams.submittedLocked')}
                                    </div>
                                )}
                                {status === 'rejected' && rejection && (
                                    <div className="alert alert-warning u-mb">
                                        <strong>{t('teacher.exams.sentBack')}</strong> {rejection}
                                    </div>
                                )}

                                <fieldset disabled={readOnly} className="u-fieldset-plain">
                                    <div className="card u-mb">
                                        <div className="card-header">
                                            <h2 className="card-title">{t('teacher.exams.details')}</h2>
                                        </div>
                                        <div className="card-content">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="exam-title">
                                                    {t('teacher.exams.paperTitle')}
                                                </label>
                                                <input id="exam-title" className="form-control"
                                                    value={form.title}
                                                    onChange={e => set('title', e.target.value)}
                                                    placeholder={t('teacher.exams.paperTitleHint')} />
                                            </div>

                                            <div className="resp-grid-2 grid-gap-sm">
                                                <div className="form-group">
                                                    <label className="form-label">{t('teacher.exams.className')}</label>
                                                    <FormSelect value={form.class_obj}
                                                        onChange={v => { set('class_obj', v); set('subject', '') }}
                                                        options={classOptions}
                                                        placeholder={t('teacher.exams.pickClass')} />
                                                </div>

                                                <div className="form-group">
                                                    <label className="form-label">{t('teacher.exams.subject')}</label>
                                                    <FormSelect value={form.subject}
                                                        onChange={v => set('subject', v)}
                                                        disabled={!form.class_obj || subjectOptions.length === 0}
                                                        options={subjectOptions}
                                                        placeholder={t('teacher.exams.pickSubject')} />
                                                </div>

                                                <div className="form-group">
                                                    <label className="form-label">{t('teacher.exams.examType')}</label>
                                                    <FormSelect value={form.exam_type}
                                                        onChange={v => set('exam_type', v)}
                                                        options={EXAM_TYPES.map(v => ({ value: v, label: t(TYPE_KEY[v]) }))} />
                                                </div>

                                                <div className="form-group">
                                                    <label className="form-label" htmlFor="exam-duration">
                                                        {t('teacher.exams.duration')}
                                                    </label>
                                                    <input id="exam-duration" type="number" min="1"
                                                        className="form-control"
                                                        value={form.duration_minutes}
                                                        onChange={e => set('duration_minutes', e.target.value)} />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label" htmlFor="exam-instructions">
                                                    {t('teacher.exams.instructions')}
                                                </label>
                                                <textarea id="exam-instructions" className="form-control"
                                                    value={form.instructions}
                                                    onChange={e => set('instructions', e.target.value)}
                                                    placeholder={t('teacher.exams.instructionsHint')} />
                                            </div>
                                        </div>
                                    </div>

                                    {sections.map((section, i) => (
                                        <SectionEditor
                                            key={section.id ?? i}
                                            section={section} index={i}
                                            onChange={updated => setSection(i, updated)}
                                            onRemove={() => setSections(s => s.filter((_, x) => x !== i))}
                                            onMoveUp={() => moveSection(i, -1)}
                                            onMoveDown={() => moveSection(i, 1)}
                                            isFirst={i === 0}
                                            isLast={i === sections.length - 1}
                                        />
                                    ))}

                                    <button type="button" className="btn btn-outline u-mb"
                                        onClick={() => setSections(s => [...s, newSection(s.length)])}>
                                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">playlist_add</span>
                                        {t('teacher.exams.addSection')}
                                    </button>
                                </fieldset>
                            </>
                        )}
                    </DashboardContent>

                    {!loading && !loadError && (
                        <div className="form-actions-bar">
                            <span className={`modal-footer-hint${saveError ? ' has-error' : ''}`}>
                                {saveError || t('teacher.exams.runningTotal', { marks, count })}
                            </span>
                            <button className="btn btn-outline" onClick={leave}>
                                {t('common.cancel')}
                            </button>
                            {!readOnly && (
                                <>
                                    <button className="btn btn-outline" disabled={saving}
                                        onClick={() => save()}>
                                        {saving ? t('common.saving') : t('teacher.exams.saveDraft')}
                                    </button>
                                    <button className="btn btn-primary"
                                        disabled={saving || Boolean(blocker)}
                                        title={blocker ? t(blocker) : undefined}
                                        onClick={() => save({ thenSubmit: true })}>
                                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">send</span>
                                        {t('teacher.exams.submitForApproval')}
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
