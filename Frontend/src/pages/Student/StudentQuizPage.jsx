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
        <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.4rem 0.75rem', borderRadius: 8,
            background: isWarning ? 'rgba(239,68,68,0.1)' : 'var(--muted)',
            color: isWarning ? '#dc2626' : 'var(--foreground)',
            fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '1rem',
            animation: isWarning && left <= 10 ? 'pulse 1s infinite' : 'none',
        }}>
            <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>timer</span>
            {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
        </div>
    )
}

// ── Question renderer ─────────────────────────────────────────────────────────

function QuestionCard({ q, qi, total, answer, onChange, submitted, result }) {
    const isGraded     = submitted && result !== undefined
    const isCorrect    = isGraded && result?.is_correct
    const borderColor  = !isGraded ? 'var(--border)' : isCorrect ? 'var(--success)' : '#dc2626'

    return (
        <div style={{
            border: `1.5px solid ${borderColor}`,
            borderRadius: 12, padding: '1rem 1.125rem', marginBottom: '1rem',
            background: 'var(--card)',
        }}>
            {/* Question header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', gap: '0.5rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>
                    <span style={{ color: 'var(--muted-foreground)', marginRight: '0.4rem' }}>{qi + 1}.</span>
                    {q.type === 'fill_blank'
                        ? q.text.replace('____', '________')
                        : q.text || '(empty question)'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                    {isGraded && (
                        <span className="material-symbols-rounded" style={{ fontSize: '1.1rem', color: isCorrect ? 'var(--success)' : '#dc2626' }}>
                            {isCorrect ? 'check_circle' : 'cancel'}
                        </span>
                    )}
                </div>
            </div>

            {/* Image */}
            {q.image && <img src={q.image} alt="question" style={{ maxHeight: 160, borderRadius: 8, marginBottom: '0.6rem', display: 'block' }} />}

            {/* Answer area */}
            {q.type === 'mcq' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {(q.options || []).map((opt, oi) => {
                        const isSelected = answer === oi
                        const isCorrectOpt = isGraded && result?.correct_answer === oi
                        return (
                            <label key={oi} style={{
                                display: 'flex', alignItems: 'center', gap: '0.6rem',
                                padding: '0.5rem 0.75rem', borderRadius: 8, cursor: submitted ? 'default' : 'pointer',
                                border: `1px solid ${isCorrectOpt && isGraded ? 'var(--success)' : isSelected ? 'var(--primary)' : 'var(--border)'}`,
                                background: isCorrectOpt && isGraded ? 'rgba(16,185,129,0.08)' : isSelected ? 'var(--primary-light, #e8f2ff)' : 'transparent',
                                fontWeight: isCorrectOpt && isGraded ? 600 : 400,
                            }}>
                                <input type="radio" name={`q-${q.id}`} disabled={submitted}
                                    checked={isSelected} onChange={() => !submitted && onChange(oi)}
                                    style={{ accentColor: 'var(--primary)', cursor: submitted ? 'default' : 'pointer' }} />
                                {opt}
                                {isCorrectOpt && isGraded && (
                                    <span className="material-symbols-rounded" style={{ fontSize: '0.9rem', color: 'var(--success)', marginLeft: 'auto' }}>check</span>
                                )}
                            </label>
                        )
                    })}
                </div>
            )}

            {q.type === 'true_false' && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {['True', 'False'].map((label, oi) => {
                        const isSelected = answer === oi
                        const isCorrectOpt = isGraded && result?.correct_answer === oi
                        return (
                            <label key={oi} style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.5rem 1rem', borderRadius: 8, cursor: submitted ? 'default' : 'pointer',
                                border: `1px solid ${isCorrectOpt && isGraded ? 'var(--success)' : isSelected ? 'var(--primary)' : 'var(--border)'}`,
                                background: isCorrectOpt && isGraded ? 'rgba(16,185,129,0.08)' : isSelected ? 'var(--primary-light, #e8f2ff)' : 'transparent',
                                fontWeight: isCorrectOpt && isGraded ? 600 : 400,
                            }}>
                                <input type="radio" name={`q-${q.id}`} disabled={submitted}
                                    checked={isSelected} onChange={() => !submitted && onChange(oi)}
                                    style={{ accentColor: 'var(--primary)', cursor: submitted ? 'default' : 'pointer' }} />
                                {label}
                                {isCorrectOpt && isGraded && (
                                    <span className="material-symbols-rounded" style={{ fontSize: '0.9rem', color: 'var(--success)', marginLeft: 'auto' }}>check</span>
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
                        <div style={{ fontSize: '0.78rem', marginTop: '0.35rem', color: isCorrect ? 'var(--success)' : '#dc2626' }}>
                            {isCorrect ? 'Correct!' : `Model answer: ${result.correct_answer}`}
                        </div>
                    )}
                </div>
            )}

            {/* Explanation (shown after submission) */}
            {isGraded && q.explanation && (
                <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--muted-foreground)', background: 'var(--muted)', padding: '0.4rem 0.6rem', borderRadius: 6 }}>
                    <span style={{ fontWeight: 600 }}>Explanation: </span>{q.explanation}
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
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1rem' }}>
            <div className="card" style={{ padding: '1.75rem', marginBottom: '1rem', textAlign: 'center' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: gradeColor, display: 'block', marginBottom: '0.5rem' }}>
                    {percentage >= 50 ? 'emoji_events' : 'sentiment_dissatisfied'}
                </span>
                <div style={{ fontSize: '3rem', fontWeight: 800, color: gradeColor, lineHeight: 1 }}>{grade}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>{score} / {max_score}</div>
                <div style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{percentage}%</div>
                {isLate && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#dc2626', background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '0.25rem 0.75rem', display: 'inline-block' }}>
                        Submitted late
                    </div>
                )}
                <div style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                    {quiz.title} · {quiz.subject_name}
                </div>
            </div>

            <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Question Review</div>

            {quiz.questions.map((q, qi) => {
                const ans = answers?.find(a => String(a.question_id) === String(q.id))
                return (
                    <QuestionCard key={q.id} q={q} qi={qi} total={quiz.questions.length}
                        answer={ans?.answer} submitted={true} result={ans}
                        onChange={() => {}} />
                )
            })}

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={onBack}>
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', color: 'var(--muted-foreground)', animation: 'spin 1s linear infinite' }}>progress_activity</span>
                <p style={{ color: 'var(--muted-foreground)' }}>Loading quiz…</p>
            </div>
        )
    }

    if (loadError) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', color: '#dc2626' }}>error</span>
                <p style={{ fontWeight: 600 }}>{loadError}</p>
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
        <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
            {/* Header */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 100,
                background: 'var(--card)', borderBottom: '1px solid var(--border)',
                padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
            }}>
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/student/assignments')}
                    disabled={submitting}>
                    <span className="material-symbols-rounded icon-sm">arrow_back</span>
                    Exit
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quiz.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{quiz.subject_name} · {quiz.class_name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                        {answeredCount}/{quiz.question_count} answered
                    </span>
                    {quiz.time_limit_minutes && (
                        <Timer seconds={quiz.time_limit_minutes * 60} onExpire={handleTimerExpire} />
                    )}
                </div>
            </div>

            {/* Body */}
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem' }}>
                {timedOut && (
                    <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.4rem' }}>timer_off</span>
                        Time is up! Your answers have been submitted automatically.
                    </div>
                )}

                {/* Instructions */}
                {quiz.instructions && (
                    <div style={{ background: 'var(--muted)', borderRadius: 10, padding: '0.875rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--muted-foreground)', whiteSpace: 'pre-wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>Instructions: </span>
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
                    <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.4rem' }}>error</span>
                        {submitError}
                    </div>
                )}

                {/* Submit button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    {answeredCount < quiz.question_count && (
                        <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', alignSelf: 'center' }}>
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
