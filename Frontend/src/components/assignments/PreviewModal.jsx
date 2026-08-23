import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { calcMaxScore } from './quizModel'

/**
 * The quiz as a student will meet it, before anyone is allowed to sit it.
 *
 * Shuffling is reproduced here from a fixed seed rather than left random, so a
 * teacher checking the preview twice sees the same paper both times.
 */
// Deterministic shuffle. Math.random() during render re-ordered the questions
// on every keystroke; seeding from the assignment id keeps the order stable
// across re-renders while still differing per assignment.
function seededShuffle(items, seed) {
    let h = 2166136261
    for (const ch of String(seed)) {
        h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    }
    const next = () => {
        h = Math.imul(h ^ (h >>> 15), h | 1)
        h ^= h + Math.imul(h ^ (h >>> 7), h | 61)
        return ((h ^ (h >>> 14)) >>> 0) / 4294967296
    }
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

export function PreviewModal({ assignment, questions, onClose }) {
    const { t } = useTranslation()
    const [answers,  setAnswers]  = useState({})
    const [revealed, setRevealed] = useState(false)
    const displayQ = useMemo(
        () => (assignment.shuffle_questions
            ? seededShuffle(questions, assignment.id ?? 'preview')
            : questions),
        [assignment.shuffle_questions, assignment.id, questions],
    )

    function score() {
        return displayQ.reduce((total, q) => {
            const a = answers[q.id]
            if (a === undefined || a === '' || a === null) return total
            const pts = parseInt(q.points) || 1
            let correct = false
            if (q.type === 'mcq' || q.type === 'true_false') correct = parseInt(a) === parseInt(q.correct)
            else correct = String(a).trim().toLowerCase() === String(q.correct || '').trim().toLowerCase()
            return total + (correct ? pts : 0)
        }, 0)
    }

    return (
        <Modal title={t('teacher.assignments.previewTitle', { title: assignment.title })} icon="preview" onClose={onClose} size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint">
                        {t('teacher.assignments.previewHint')}
                    </span>
                    <button className="btn btn-outline" onClick={() => setRevealed(r => !r)}>
                        <span className="material-symbols-rounded icon-sm">{revealed ? 'visibility_off' : 'visibility'}</span>
                        {revealed ? t('teacher.assignments.hideAnswers') : t('teacher.assignments.revealAnswers')}
                    </button>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
                </div>
            }>
            {/* Quiz header */}
            <div className="preview-head">
                <div className="preview-title">{assignment.title}</div>
                {assignment.instructions && (
                    <div className="preview-instructions">{assignment.instructions}</div>
                )}
                <div className="preview-meta">
                    <span><strong>{calcMaxScore(questions)}</strong> {t('teacher.assignments.marksTotal')}</span>
                    <span><strong>{questions.length}</strong> {t('teacher.assignments.questionsWord')}</span>
                    {assignment.time_limit_minutes && <span><strong>{assignment.time_limit_minutes}</strong> {t('teacher.assignments.minLimit')}</span>}
                    {assignment.shuffle_questions && <span>{t('teacher.assignments.shuffled')}</span>}
                </div>
            </div>

            {/* Questions */}
            <div className="u-stack-1">
                {displayQ.map((q, qi) => {
                    const studentAns = answers[q.id]
                    const isCorrect = revealed && studentAns !== undefined && studentAns !== '' && (() => {
                        if (q.type === 'mcq' || q.type === 'true_false') return parseInt(studentAns) === parseInt(q.correct)
                        return String(studentAns).trim().toLowerCase() === String(q.correct || '').trim().toLowerCase()
                    })()

                    return (
                        <div key={q.id} className="preview-q"
                            style={{ '--preview-q-border': revealed && studentAns !== undefined ? (isCorrect ? 'var(--success)' : '#dc2626') : 'var(--border)' }}>
                            <div className="preview-q-head">
                                <span className="preview-q-title">{qi + 1}. {q.text || t('teacher.assignments.emptyQuestion')}</span>
                                <span className="preview-q-points">{t('teacher.assignments.pointCount', { count: q.points })}</span>
                            </div>
                            {q.image && <img src={q.image} alt="question" className="preview-q-image" />}

                            {(q.type === 'mcq') && (
                                <div className="preview-opts">
                                    {q.options.map((opt, oi) => (
                                        <label key={oi} className={`preview-opt${revealed && oi === parseInt(q.correct) ? ' correct' : ''}`}>
                                            <input type="radio" name={`prev-${q.id}`}
                                                checked={answers[q.id] === oi}
                                                onChange={() => setAnswers(a => ({ ...a, [q.id]: oi }))} />
                                            {opt || t('teacher.assignments.optionLetter', { letter: String.fromCharCode(65 + oi) })}
                                            {revealed && oi === parseInt(q.correct) && <span className="material-symbols-rounded preview-check">check</span>}
                                        </label>
                                    ))}
                                </div>
                            )}
                            {q.type === 'true_false' && (
                                <div className="preview-tf">
                                    {['True', 'False'].map((label, oi) => (
                                        <label key={oi} className={`preview-opt-tf${revealed && oi === parseInt(q.correct) ? ' correct' : ''}`}>
                                            <input type="radio" name={`prev-${q.id}`}
                                                checked={answers[q.id] === oi}
                                                onChange={() => setAnswers(a => ({ ...a, [q.id]: oi }))} />
                                            {label}
                                            {revealed && oi === parseInt(q.correct) && <span className="material-symbols-rounded preview-check">check</span>}
                                        </label>
                                    ))}
                                </div>
                            )}
                            {(q.type === 'short_answer' || q.type === 'fill_blank') && (
                                <div>
                                    <input className="form-control" placeholder={t('teacher.assignments.studentAnswerPlaceholder')}
                                        value={answers[q.id] || ''}
                                        onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
                                    {revealed && q.correct && (
                                        <div className="preview-model-answer">
                                            {t('teacher.assignments.modelAnswerLabel')} <strong>{q.correct}</strong>
                                        </div>
                                    )}
                                </div>
                            )}
                            {revealed && q.explanation && (
                                <div className="preview-explanation">
                                    {q.explanation}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            {revealed && Object.keys(answers).length > 0 && (
                <div className="preview-score">
                    {t('teacher.assignments.previewScore', { score: score(), max: calcMaxScore(questions) })}
                </div>
            )}
        </Modal>
    )
}
