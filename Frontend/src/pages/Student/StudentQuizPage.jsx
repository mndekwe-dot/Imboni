import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { getQuizForStudent, submitQuizAnswers } from '../../api/teacher'

// ── Timer ─────────────────────────────────────────────────────────────────────

function Timer({ seconds, onExpire }) {
    const [left, setLeft] = useState(seconds)
    const expired = useRef(false)

    useEffect(() => {
        if (left <= 0) {
            if (!expired.current) { expired.current = true; onExpire() }
            return
        }
        const t = setTimeout(() => setLeft(l => l - 1), 1000)
        return () => clearTimeout(t)
    }, [left, onExpire])

    const m = Math.floor(left / 60)
    const s = left % 60
    const isWarning = left <= 60

    return (
        <div className={`sqz-timer${isWarning ? ' warn' : ''}${isWarning && left <= 10 ? ' pulse' : ''}`}>
            <span className="material-symbols-rounded sqz-timer-icon">timer</span>
            {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
        </div>
    )
}

// ── Question renderer ─────────────────────────────────────────────────────────

function QuestionCard({ q, qi, total, answer, onChange, submitted, result }) {
    const isGraded     = submitted && result !== undefined
    const isCorrect    = isGraded && result?.is_correct
    const gradedMod    = !isGraded ? '' : isCorrect ? ' correct' : ' incorrect'

    return (
        <div className={`sqz-qcard${gradedMod}`}>
            {/* Question header */}
            <div className="sqz-q-head">
                <div className="sqz-q-text">
                    <span className="sqz-q-num">{qi + 1}.</span>
                    {q.type === 'fill_blank'
                        ? q.text.replace('____', '________')
                        : q.text || '(empty question)'}
                </div>
                <div className="sqz-q-meta">
                    <span className="sqz-q-points">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                    {isGraded && (
                        <span className="material-symbols-rounded sqz-q-mark" style={{ color: isCorrect ? 'var(--success)' : '#dc2626' }}>
                            {isCorrect ? 'check_circle' : 'cancel'}
                        </span>
                    )}
                </div>
            </div>

            {/* Image */}
            {q.image && <img src={q.image} alt="question" className="sqz-q-image" />}

            {/* Answer area */}
            {q.type === 'mcq' && (
                <div className="sqz-mcq">
                    {(q.options || []).map((opt, oi) => {
                        const isSelected = answer === oi
                        const isCorrectOpt = isGraded && result?.correct_answer === oi
                        const optMod = `${isSelected ? ' selected' : ''}${isCorrectOpt && isGraded ? ' correct' : ''}${submitted ? ' locked' : ''}`
                        return (
                            <label key={oi} className={`sqz-opt${optMod}`}>
                                <input type="radio" name={`q-${q.id}`} disabled={submitted}
                                    checked={isSelected} onChange={() => !submitted && onChange(oi)}
                                    className={`sqz-radio${submitted ? ' locked' : ''}`} />
                                {opt}
                                {isCorrectOpt && isGraded && (
                                    <span className="material-symbols-rounded sqz-opt-check">check</span>
                                )}
                            </label>
                        )
                    })}
                </div>
            )}

            {q.type === 'true_false' && (
                <div className="sqz-tf">
                    {['True', 'False'].map((label, oi) => {
                        const isSelected = answer === oi
                        const isCorrectOpt = isGraded && result?.correct_answer === oi
                        const optMod = `${isSelected ? ' selected' : ''}${isCorrectOpt && isGraded ? ' correct' : ''}${submitted ? ' locked' : ''}`
                        return (
                            <label key={oi} className={`sqz-opt tf${optMod}`}>
                                <input type="radio" name={`q-${q.id}`} disabled={submitted}
                                    checked={isSelected} onChange={() => !submitted && onChange(oi)}
                                    className={`sqz-radio${submitted ? ' locked' : ''}`} />
                                {label}
                                {isCorrectOpt && isGraded && (
                                    <span className="material-symbols-rounded sqz-opt-check">check</span>
                                )}
                            </label>
                        )
                    })}
                </div>
            )}

            {(q.type === 'short_answer' || q.type === 'fill_blank') && (
                <div>
                    <input
                        className="form-control"
                        placeholder={q.type === 'fill_blank' ? 'Fill in the blank…' : 'Type your answer…'}
                        value={answer || ''}
                        disabled={submitted}
                        onChange={e => !submitted && onChange(e.target.value)}
                    />
                    {isGraded && result?.correct_answer && (
                        <div className="sqz-sa-feedback" style={{ color: isCorrect ? 'var(--success)' : '#dc2626' }}>
                            {isCorrect ? 'Correct!' : `Model answer: ${result.correct_answer}`}
                        </div>
                    )}
                </div>
            )}

            {/* Explanation (shown after submission) */}
            {isGraded && q.explanation && (
                <div className="sqz-expl">
                    <span className="sqz-expl-label">Explanation: </span>{q.explanation}
                </div>
            )}
        </div>
    )
}

// ── Results Panel ─────────────────────────────────────────────────────────────

function ResultsPanel({ results, quiz, isLate, onBack }) {
    const { score, max_score, percentage, answers } = results
    const grade = percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F'
    const gradeColor = { A: 'var(--success)', B: '#22c55e', C: '#f59e0b', D: '#f97316', F: '#dc2626' }[grade]

    return (
        <div className="sqz-results">
            <div className="card sqz-result-card">
                <span className="material-symbols-rounded sqz-result-icon" style={{ color: gradeColor }}>
                    {percentage >= 50 ? 'emoji_events' : 'sentiment_dissatisfied'}
                </span>
                <div className="sqz-result-grade" style={{ color: gradeColor }}>{grade}</div>
                <div className="sqz-result-score">{score} / {max_score}</div>
                <div className="sqz-result-pct">{percentage}%</div>
                {isLate && (
                    <div className="sqz-late-badge">
                        Submitted late
                    </div>
                )}
                <div className="sqz-result-sub">
                    {quiz.title} · {quiz.subject_name}
                </div>
            </div>

            <div className="sqz-review-title">Question Review</div>

            {quiz.questions.map((q, qi) => {
                const ans = answers?.find(a => String(a.question_id) === String(q.id))
                return (
                    <QuestionCard key={q.id} q={q} qi={qi} total={quiz.questions.length}
                        answer={ans?.answer} submitted={true} result={ans}
                        onChange={() => {}} />
                )
            })}

            <button className="btn btn-primary sqz-back-btn" onClick={onBack}>
                <span className="material-symbols-rounded icon-sm">arrow_back</span>
                Back to Assignments
            </button>
        </div>
    )
}

// ── Main Quiz Page ────────────────────────────────────────────────────────────

export function StudentQuizPage() {
    const { assignmentId } = useParams()
    const navigate = useNavigate()

    const [quiz,       setQuiz]       = useState(null)
    const [answers,    setAnswers]    = useState({})   // question_id → answer value
    const [loading,    setLoading]    = useState(true)
    const [loadError,  setLoadError]  = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState(null)
    const [results,    setResults]    = useState(null)
    const [startTime,  setStartTime]  = useState(null)
    const [timedOut,   setTimedOut]   = useState(false)

    useEffect(() => {
        getQuizForStudent(assignmentId)
            .then(data => {
                setQuiz(data)
                setStartTime(Date.now())
            })
            .catch(err => setLoadError(err?.response?.status === 404
                ? 'Quiz not found or not yet published.'
                : err?.message || 'Failed to load quiz.'))
            .finally(() => setLoading(false))
    }, [assignmentId])

    const handleSubmit = useCallback(async (auto = false) => {
        if (submitting || results) return
        setSubmitting(true); setSubmitError(null); setTimedOut(auto)
        const timeSpent = startTime ? Math.round((Date.now() - startTime) / 1000) : 0
        const answersPayload = Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer }))
        try {
            const res = await submitQuizAnswers(assignmentId, {
                answers: answersPayload,
                time_spent_seconds: timeSpent,
            })
            // Merge question data into results for the review panel
            setResults({ ...res, answers: res.answers })
        } catch (e) {
            setSubmitError(e?.response?.data?.detail || e?.message || 'Failed to submit. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }, [answers, assignmentId, startTime, submitting, results])

    const handleTimerExpire = useCallback(() => handleSubmit(true), [handleSubmit])

    function setAnswer(qid, value) {
        setAnswers(prev => ({ ...prev, [qid]: value }))
    }

    const answeredCount = quiz ? quiz.questions.filter(q => {
        const a = answers[q.id]
        return a !== undefined && a !== '' && a !== null
    }).length : 0

    // ── Loading ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="sqz-center">
                <span className="material-symbols-rounded sqz-spinner">progress_activity</span>
                <p className="u-muted">Loading quiz…</p>
            </div>
        )
    }

    if (loadError) {
        return (
            <div className="sqz-center pad">
                <span className="material-symbols-rounded sqz-error-icon">error</span>
                <p className="sqz-error-title">{loadError}</p>
                <button className="btn btn-outline" onClick={() => navigate('/student/assignments')}>
                    <span className="material-symbols-rounded icon-sm">arrow_back</span>
                    Back to Assignments
                </button>
            </div>
        )
    }

    // ── Results view ───────────────────────────────────────────────────────────
    if (results) {
        return <ResultsPanel results={results} quiz={quiz} isLate={results.is_late} onBack={() => navigate('/student/assignments')} />
    }

    // ── Quiz taking view ───────────────────────────────────────────────────────
    return (
        <div className="sqz-page">
            {/* Header */}
            <div className="sqz-header">
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/student/assignments')}
                    disabled={submitting}>
                    <span className="material-symbols-rounded icon-sm">arrow_back</span>
                    Exit
                </button>
                <div className="sqz-header-titlewrap">
                    <div className="sqz-header-title">{quiz.title}</div>
                    <div className="sqz-header-sub">{quiz.subject_name} · {quiz.class_name}</div>
                </div>
                <div className="sqz-header-right">
                    <span className="sqz-answered">
                        {answeredCount}/{quiz.question_count} answered
                    </span>
                    {quiz.time_limit_minutes && (
                        <Timer seconds={quiz.time_limit_minutes * 60} onExpire={handleTimerExpire} />
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="sqz-body">
                {timedOut && (
                    <div className="alert alert-danger u-mb">
                        <span className="material-symbols-rounded sqz-alert-icon">timer_off</span>
                        Time is up! Your answers have been submitted automatically.
                    </div>
                )}

                {/* Instructions */}
                {quiz.instructions && (
                    <div className="sqz-instructions">
                        <span className="sqz-instructions-label">Instructions: </span>
                        {quiz.instructions}
                    </div>
                )}

                {/* Questions */}
                {quiz.questions.map((q, qi) => (
                    <QuestionCard key={q.id} q={q} qi={qi} total={quiz.question_count}
                        answer={answers[q.id]}
                        onChange={val => setAnswer(q.id, val)}
                        submitted={false}
                        result={undefined}
                    />
                ))}

                {/* Submit error */}
                {submitError && (
                    <div className="alert alert-danger u-mb">
                        <span className="material-symbols-rounded sqz-alert-icon">error</span>
                        {submitError}
                    </div>
                )}

                {/* Submit button */}
                <div className="sqz-submit-row">
                    {answeredCount < quiz.question_count && (
                        <span className="sqz-unanswered">
                            {quiz.question_count - answeredCount} question{quiz.question_count - answeredCount !== 1 ? 's' : ''} unanswered
                        </span>
                    )}
                    <button className="btn btn-primary" onClick={() => handleSubmit(false)} disabled={submitting}>
                        <span className="material-symbols-rounded icon-sm">{submitting ? 'progress_activity' : 'send'}</span>
                        {submitting ? 'Submitting…' : 'Submit Quiz'}
                    </button>
                </div>
            </div>
        </div>
    )
}
