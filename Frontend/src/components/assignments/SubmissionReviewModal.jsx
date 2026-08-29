import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { getSubmissionReview, overrideSubmissionMarks } from '../../api/teacher'
import { errorMessage } from '../../utils/errors'

/**
 * One student's quiz, with the marking open to correction.
 *
 * Short-answer and fill-blank questions are auto-marked by exact string match,
 * so "8 cm" against a stored "8cm" scores zero. The code doing it always said
 * a teacher could override later; nothing implemented that, and no screen in
 * the product even showed what a student had written. A wrong auto-mark was
 * permanent and invisible.
 */
export function SubmissionReviewModal({ submissionId, onClose, onSaved }) {
    const { t } = useTranslation()
    const [data,     setData]     = useState(null)
    const [loading,  setLoading]  = useState(true)
    const [saving,   setSaving]   = useState(false)
    const [error,    setError]    = useState(null)
    /* question_id → the teacher's correction, applied on save. */
    const [overrides, setOverrides] = useState({})
    const [feedback,  setFeedback]  = useState('')

    useEffect(() => {
        let alive = true
        getSubmissionReview(submissionId)
            .then(d => {
                if (!alive) return
                setData(d)
                setFeedback(d.feedback || '')
            })
            .catch(e => alive && setError(errorMessage(e, t('teacher.assignments.loadSubmissionFailed'))))
            .finally(() => alive && setLoading(false))
        return () => { alive = false }
    }, [submissionId, t])

    /* The question text and the expected answer live on the assignment, the
       student's answer on the submission - joined here by question id. */
    const questionById = Object.fromEntries((data?.questions || []).map(q => [String(q.id), q]))

    function mark(questionId, isCorrect) {
        setOverrides(prev => ({ ...prev, [questionId]: { question_id: questionId, is_correct: isCorrect } }))
    }

    function effective(answer) {
        const override = overrides[String(answer.question_id)]
        return override ? override.is_correct : answer.is_correct
    }

    /* Recomputed live so the teacher sees the mark move as they correct it. */
    const previewScore = (data?.answers || []).reduce((total, a) => {
        const correct = effective(a)
        if (!correct) return total
        const override = overrides[String(a.question_id)]
        return total + (override ? Number(a.max_points || 0) : Number(a.points_earned || 0))
    }, 0)

    const dirty = Object.keys(overrides).length > 0 || feedback !== (data?.feedback || '')

    async function handleSave() {
        setSaving(true); setError(null)
        try {
            const updated = await overrideSubmissionMarks(submissionId, {
                answers: Object.values(overrides),
                feedback,
            })
            setData(updated)
            setOverrides({})
            onSaved?.()
        } catch (e) {
            setError(errorMessage(e, t('common.saveFailed')))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            title={t('teacher.assignments.reviewTitle', { name: data?.student_name ?? '' })}
            icon="fact_check"
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className={`modal-footer-hint${error ? ' has-error' : ''}`}>
                        {error || (data && t('teacher.assignments.scoreNow', {
                            score: dirty ? previewScore : data.score, max: data.max_score,
                        }))}
                    </span>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">save</span>
                        {saving ? t('common.saving') : t('teacher.assignments.saveMarking')}
                    </button>
                </div>
            }
        >
            {loading ? (
                <p className="u-muted">{t('common.loading')}</p>
            ) : !data ? (
                <p className="u-muted">{error}</p>
            ) : (
                <>
                    <div className="quiz-review-meta">
                        <span>{data.student_code}</span>
                        {data.is_late && (
                            <span className="badge badge-soft-warning">{t('common.late')}</span>
                        )}
                        {data.time_spent_seconds > 0 && (
                            <span className="u-muted u-sm">
                                {t('teacher.assignments.timeTaken', {
                                    minutes: Math.round(data.time_spent_seconds / 60),
                                })}
                            </span>
                        )}
                    </div>

                    {data.answers.map((a, i) => {
                        const question = questionById[String(a.question_id)] || {}
                        const correct = effective(a)
                        return (
                            <div key={a.question_id} className={`quiz-review-q${correct ? ' correct' : ' wrong'}`}>
                                <div className="quiz-review-q-head">
                                    <span className="quiz-q-num">{i + 1}</span>
                                    <span className="u-strong">{question.text || ''}</span>
                                    <span className="u-muted u-sm u-ml-auto">
                                        {correct ? a.max_points : 0}/{a.max_points}
                                    </span>
                                </div>

                                <div className="quiz-review-row">
                                    <span className="u-muted u-sm">{t('teacher.assignments.theirAnswer')}</span>
                                    <span>{formatAnswer(a.answer, question)}</span>
                                </div>
                                <div className="quiz-review-row">
                                    <span className="u-muted u-sm">{t('teacher.assignments.correctAnswer')}</span>
                                    <span>{formatAnswer(a.correct_answer, question)}</span>
                                </div>

                                {/* The whole point: a teacher can disagree with
                                    the string match and say so. */}
                                <div className="quiz-review-actions">
                                    <button type="button"
                                        className={`btn btn-sm ${correct ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => mark(String(a.question_id), true)}>
                                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">check</span>
                                        {t('teacher.assignments.markRight')}
                                    </button>
                                    <button type="button"
                                        className={`btn btn-sm ${correct ? 'btn-outline' : 'btn-primary'}`}
                                        onClick={() => mark(String(a.question_id), false)}>
                                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">close</span>
                                        {t('teacher.assignments.markWrong')}
                                    </button>
                                    {a.overridden && (
                                        <span className="badge badge-soft-info">
                                            {t('teacher.assignments.overridden')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })}

                    <div className="form-group u-mt">
                        <label className="form-label" htmlFor="review-feedback">
                            {t('teacher.assignments.feedbackOptional')}
                        </label>
                        <textarea id="review-feedback" className="form-control textarea-sm"
                            value={feedback} onChange={e => setFeedback(e.target.value)}
                            placeholder={t('teacher.assignments.feedbackPlaceholder')} />
                    </div>
                </>
            )}
        </Modal>
    )
}

/* An MCQ answer is stored as the index of the option chosen, so it has to be
   looked back up to mean anything; true/false the same. Everything else is
   already the text the student typed. */
function formatAnswer(value, question) {
    if (value === null || value === undefined || value === '') return '—'
    if (question.type === 'true_false') return Number(value) === 0 ? 'True' : 'False'
    if (question.type === 'mcq') {
        const option = (question.options || [])[Number(value)]
        return option || String(value)
    }
    return String(value)
}
