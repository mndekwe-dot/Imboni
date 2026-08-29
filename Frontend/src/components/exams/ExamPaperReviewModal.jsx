import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { sectionMarks } from './examModel'
import { approveDosExamPaper, rejectDosExamPaper } from '../../api/dos'
import { errorMessage } from '../../utils/errors'

/**
 * The paper as the DOS reads it, with the decision attached.
 *
 * Showing the questions here rather than sending the DOS to a PDF is the
 * difference between vetting and rubber-stamping: the point of the step is
 * that someone reads the paper, so the paper is what the screen shows.
 *
 * Answers are visible because the DOS is checking the marking too — a question
 * whose stored answer is wrong is exactly what this step exists to catch.
 */
export function ExamPaperReviewModal({ paper, onClose, onDecided }) {
    const { t } = useTranslation()
    const [reason,  setReason]  = useState('')
    const [busy,    setBusy]    = useState(false)
    const [error,   setError]   = useState(null)
    const [sendingBack, setSendingBack] = useState(false)

    const decidable = paper.status === 'submitted'

    async function approve() {
        setBusy(true); setError(null)
        try {
            await approveDosExamPaper(paper.id)
            onDecided?.()
        } catch (e) {
            setError(errorMessage(e, t('dos.examPapers.approveFailed')))
        } finally {
            setBusy(false)
        }
    }

    async function reject() {
        if (!reason.trim()) { setError(t('dos.examPapers.reasonRequired')); return }
        setBusy(true); setError(null)
        try {
            await rejectDosExamPaper(paper.id, reason.trim())
            onDecided?.()
        } catch (e) {
            setError(errorMessage(e, t('dos.examPapers.rejectFailed')))
        } finally {
            setBusy(false)
        }
    }

    let number = 0

    return (
        <Modal
            title={paper.title}
            icon="rate_review"
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className={`modal-footer-hint${error ? ' has-error' : ''}`}>
                        {error || t('dos.examPapers.outOf', { marks: paper.total_marks })}
                    </span>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
                    {decidable && !sendingBack && (
                        <>
                            <button className="btn btn-outline" disabled={busy}
                                onClick={() => setSendingBack(true)}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">undo</span>
                                {t('dos.examPapers.sendBack')}
                            </button>
                            <button className="btn btn-primary" disabled={busy} onClick={approve}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">task_alt</span>
                                {busy ? t('common.saving') : t('dos.examPapers.approve')}
                            </button>
                        </>
                    )}
                    {decidable && sendingBack && (
                        <button className="btn btn-primary" disabled={busy} onClick={reject}>
                            {busy ? t('common.saving') : t('dos.examPapers.confirmSendBack')}
                        </button>
                    )}
                </div>
            }
        >
            <div className="quiz-review-meta">
                <span>{paper.subject_name}</span>
                <span>{paper.class_name}</span>
                <span className="u-muted u-sm">
                    {t('dos.examPapers.durationMinutes', { minutes: paper.duration_minutes })}
                </span>
                <span className="u-muted u-sm">{t('dos.examPapers.setBy')}: {paper.teacher_name}</span>
            </div>

            {paper.instructions && (
                <div className="alert alert-info u-mb">{paper.instructions}</div>
            )}

            {(paper.sections || []).map((section, si) => (
                <div key={si} className="u-mb">
                    <div className="section-label-sm">
                        {section.title || t('teacher.exams.sectionN', { n: si + 1 })}
                        {' — '}
                        {t('teacher.exams.sectionMarks', { marks: sectionMarks(section) })}
                    </div>
                    {section.choose_count > 0 && (
                        <p className="u-sm u-muted">
                            {t('teacher.exams.chooseHint', {
                                choose: section.choose_count,
                                of: (section.questions || []).length,
                            })}
                        </p>
                    )}
                    {section.instructions && (
                        <p className="u-sm u-muted">{section.instructions}</p>
                    )}

                    {(section.questions || []).map(q => {
                        number += 1
                        return (
                            <div key={q.id ?? number} className="quiz-review-q">
                                <div className="quiz-review-q-head">
                                    <span className="quiz-q-num">{number}</span>
                                    <span className="u-strong">{q.text}</span>
                                    <span className="u-muted u-sm u-ml-auto">
                                        {t('dos.examPapers.qMarks', { marks: q.points ?? 0 })}
                                    </span>
                                </div>
                                {(q.options || []).length > 0 && (
                                    <div className="q-options">
                                        {q.options.map((opt, oi) => (
                                            <div key={oi} className="quiz-review-row">
                                                <span className="u-muted u-sm">
                                                    {String.fromCharCode(65 + oi)})
                                                </span>
                                                <span>{opt}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ))}

            {sendingBack && (
                <div className="form-group u-mt">
                    <label className="form-label" htmlFor="reject-reason">
                        {t('dos.examPapers.reasonLabel')}
                    </label>
                    <textarea id="reject-reason" className="form-control textarea-sm"
                        value={reason} onChange={e => setReason(e.target.value)}
                        placeholder={t('dos.examPapers.reasonPlaceholder')} />
                    {/* Required on the server too — a refusal with no reason
                        makes the teacher guess, and they will guess wrong. */}
                    <p className="u-sm u-muted">{t('dos.examPapers.reasonHint')}</p>
                </div>
            )}
        </Modal>
    )
}
