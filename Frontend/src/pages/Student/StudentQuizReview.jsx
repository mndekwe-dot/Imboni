import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { getQuizReview } from '../../api/teacher'

function answerLabel(q, value) {
    if (value === null || value === undefined || value === '') return '-'
    if (q.type === 'mcq') {
        const idx = parseInt(value)
        return q.options?.[idx] ?? String(value)
    }
    if (q.type === 'true_false') return parseInt(value) === 0 ? 'True' : 'False'
    return String(value)
}

function ReviewQuestion({ q, qi }) {
    const isCorrect = q.is_correct === true

    return (
        <div className={`sqz-qcard ${isCorrect ? 'correct' : 'incorrect'}`}>
            <div className="sqz-q-head">
                <div className="sqz-q-text">
                    <span className="sqz-q-num">{qi + 1}.</span>
                    {q.text || '(empty question)'}
                </div>
                <div className="sqz-q-meta">
                    <span className="sqz-q-points">
                        {q.points_earned ?? 0}/{q.points} pt{q.points !== 1 ? 's' : ''}
                    </span>
                    <span className="material-symbols-rounded sqz-q-mark" style={{ color: isCorrect ? 'var(--success)' : '#dc2626' }}>
                        {isCorrect ? 'check_circle' : 'cancel'}
                    </span>
                </div>
            </div>

            {q.image && <img src={q.image} alt="question" className="sqz-q-image" />}

            <div className="sqz-ans-list">
                <div>
                    <span className="u-muted">Your answer: </span>
                    <span className="u-strong" style={{ color: isCorrect ? 'var(--success)' : '#dc2626' }}>
                        {answerLabel(q, q.your_answer)}
                    </span>
                </div>
                {!isCorrect && (
                    <div>
                        <span className="u-muted">Correct answer: </span>
                        <span className="sqz-ans-correct">
                            {answerLabel(q, q.correct)}
                        </span>
                    </div>
                )}
                {q.explanation && (
                    <div className="sqz-review-expl">
                        <span className="material-symbols-rounded sqz-expl-icon">lightbulb</span>
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
        return <p className="u-pad u-muted">Loading your submission…</p>
    }

    if (error) {
        return (
            <div className="sqz-error-wrap">
                <p className="sqz-review-err">{error}</p>
                <button className="btn btn-primary" onClick={() => navigate('/student/assignments')}>
                    Back to Assignments
                </button>
            </div>
        )
    }

    const scoreColor = review.percentage >= 50 ? 'var(--success)' : '#dc2626'

    return (
        <div className="sqz-review-page">
            {/* Header */}
            <button className="btn btn-outline btn-sm u-mb"
                onClick={() => navigate('/student/assignments')}>
                <span className="material-symbols-rounded icon-sm">arrow_back</span>
                Back to Assignments
            </button>

            <div className="sqz-review-card">
                <div className="sqz-review-hdr">
                    <div>
                        <h1 className="sqz-review-title">{review.title}</h1>
                        <div className="sqz-review-sub">
                            {review.subject_name} · {review.class_name}
                            {review.is_late && <span className="sqz-late-inline"> · Submitted late</span>}
                        </div>
                    </div>
                    <div className="u-text-right">
                        <div className="sqz-review-score" style={{ color: scoreColor }}>
                            {review.score}/{review.max_score}
                        </div>
                        <div className="sqz-review-pct" style={{ color: scoreColor }}>{review.percentage}%</div>
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
