import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { getQuizReview } from '../../api/teacher'

function answerLabel(q, value) {
    if (value === null || value === undefined || value === '') return '—'
    if (q.type === 'mcq') {
        const idx = parseInt(value)
        return q.options?.[idx] ?? String(value)
    }
    if (q.type === 'true_false') return parseInt(value) === 0 ? 'True' : 'False'
    return String(value)
}

function ReviewQuestion({ q, qi }) {
    const isCorrect = q.is_correct === true
    const borderColor = isCorrect ? 'var(--success)' : '#dc2626'

    return (
        <div style={{
            border: `1.5px solid ${borderColor}`,
            borderRadius: 12, padding: '1rem 1.125rem', marginBottom: '1rem',
            background: 'var(--card)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', gap: '0.5rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>
                    <span style={{ color: 'var(--muted-foreground)', marginRight: '0.4rem' }}>{qi + 1}.</span>
                    {q.text || '(empty question)'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        {q.points_earned ?? 0}/{q.points} pt{q.points !== 1 ? 's' : ''}
                    </span>
                    <span className="material-symbols-rounded" style={{ fontSize: '1.1rem', color: isCorrect ? 'var(--success)' : '#dc2626' }}>
                        {isCorrect ? 'check_circle' : 'cancel'}
                    </span>
                </div>
            </div>

            {q.image && <img src={q.image} alt="question" style={{ maxHeight: 160, borderRadius: 8, marginBottom: '0.6rem', display: 'block' }} />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.875rem' }}>
                <div>
                    <span style={{ color: 'var(--muted-foreground)' }}>Your answer: </span>
                    <span style={{ fontWeight: 600, color: isCorrect ? 'var(--success)' : '#dc2626' }}>
                        {answerLabel(q, q.your_answer)}
                    </span>
                </div>
                {!isCorrect && (
                    <div>
                        <span style={{ color: 'var(--muted-foreground)' }}>Correct answer: </span>
                        <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                            {answerLabel(q, q.correct)}
                        </span>
                    </div>
                )}
                {q.explanation && (
                    <div style={{
                        marginTop: '0.35rem', padding: '0.5rem 0.7rem', borderRadius: 8,
                        background: 'var(--muted)', fontSize: '0.82rem', color: 'var(--muted-foreground)',
                    }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '0.95rem', verticalAlign: 'middle', marginRight: '0.3rem' }}>lightbulb</span>
                        {q.explanation}
                    </div>
                )}
            </div>
        </div>
    )
}

export function StudentQuizReview() {
    const { assignmentId } = useParams()
    const navigate = useNavigate()
    const [review, setReview]   = useState(null)
    const [error, setError]     = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getQuizReview(assignmentId)
            .then(setReview)
            .catch(err => setError(err?.response?.data?.detail || 'Failed to load your submission.'))
            .finally(() => setLoading(false))
    }, [assignmentId])

    if (loading) {
        return <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading your submission…</p>
    }

    if (error) {
        return (
            <div style={{ maxWidth: 700, margin: '3rem auto', padding: '0 1rem', textAlign: 'center' }}>
                <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>
                <button className="btn btn-primary" onClick={() => navigate('/student/assignments')}>
                    Back to Assignments
                </button>
            </div>
        )
    }

    const scoreColor = review.percentage >= 50 ? 'var(--success)' : '#dc2626'

    return (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
            {/* Header */}
            <button className="btn btn-outline btn-sm" style={{ marginBottom: '1rem' }}
                onClick={() => navigate('/student/assignments')}>
                <span className="material-symbols-rounded icon-sm">arrow_back</span>
                Back to Assignments
            </button>

            <div style={{
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
                padding: '1.25rem', marginBottom: '1.5rem',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{review.title}</h1>
                        <div style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginTop: '0.3rem' }}>
                            {review.subject_name} · {review.class_name}
                            {review.is_late && <span style={{ color: '#dc2626' }}> · Submitted late</span>}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: scoreColor }}>
                            {review.score}/{review.max_score}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: scoreColor, fontWeight: 600 }}>{review.percentage}%</div>
                    </div>
                </div>
            </div>

            {/* Questions */}
            {review.questions.map((q, qi) => (
                <ReviewQuestion key={q.id || qi} q={q} qi={qi} />
            ))}
        </div>
    )
}
