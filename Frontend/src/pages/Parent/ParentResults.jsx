import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'
import {
    getMyChildren, getChildAssessments, getChildSummative, getChildReviews,
} from '../../api/parent'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function gradeBadge(g) {
    if (g === 'A') return 'badge-success'
    if (g === 'B') return 'badge-primary'
    return 'badge-warning'
}

function gradeClass(g) {
    if (g === 'A') return 'a'
    if (g === 'B') return 'b'
    return 'c'
}

function scoreLabel(obtained, max) {
    if (obtained == null) return '—'
    return max ? `${Math.round(obtained)}/${Math.round(max)}` : `${Math.round(obtained)}`
}

function AssessmentRow({ title, assessment_type, date, score_display, grade, subject_name }) {
    const typeLabel = (assessment_type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const dateStr   = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
    return (
        <tr>
            <td>{subject_name}</td>
            <td>{typeLabel}</td>
            <td>{score_display}</td>
            <td><span className={`badge ${gradeBadge(grade)}`}>{grade}</span></td>
            <td>{dateStr}</td>
        </tr>
    )
}

function SummativeRow({ subject_name, class_test_marks, exam_score, final_score, grade }) {
    return (
        <tr>
            <td><strong>{subject_name}</strong></td>
            <td>{scoreLabel(class_test_marks)}</td>
            <td>{scoreLabel(exam_score)}</td>
            <td><strong>{scoreLabel(final_score)}</strong></td>
            <td><span className={`grade-badge ${gradeClass(grade)}`}>{grade}</span></td>
        </tr>
    )
}

function ReviewBubble({ teacher_name, teacher_role, teacher_comment, updated_at }) {
    const ini    = initials(teacher_name)
    const timeAgo = updated_at
        ? new Date(updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : ''
    return (
        <div className="review-bubble">
            <div className="review-header">
                <div className="avatar avatar-sm" style={{ background: 'var(--primary)' }}>{ini}</div>
                <div>
                    <p className="text-sm"><strong>{teacher_name}</strong></p>
                    <p className="text-xs text-muted">{teacher_role}{timeAgo ? ` · ${timeAgo}` : ''}</p>
                </div>
            </div>
            <p className="review-text text-sm">"{teacher_comment}"</p>
        </div>
    )
}

function AssessmentItem({ title, assessment_type, score_display, grade }) {
    const typeLabel = (assessment_type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const cls = grade === 'A' ? 'text-success' : grade === 'B' ? 'text-primary' : 'text-warning'
    return (
        <div className="assessment-item">
            <div className="assessment-icon quiz">
                <span className="material-symbols-rounded">quiz</span>
            </div>
            <div className="assessment-info">
                <p><strong>{title}</strong></p>
                <p className="text-xs text-muted">{typeLabel}</p>
            </div>
            <div className={`assessment-score ${cls}`}>{score_display}</div>
        </div>
    )
}

export function ParentResults() {
    const [children,    setChildren]    = useState([])
    const [activeIdx,   setActiveIdx]   = useState(0)
    const [loading,     setLoading]     = useState(true)
    const [assessments, setAssessments] = useState([])
    const [summative,   setSummative]   = useState([])
    const [reviews,     setReviews]     = useState([])
    const [loadingData, setLoadingData] = useState(false)

    useEffect(() => {
        getMyChildren()
            .then(setChildren)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (!children.length) return
        const child = children[activeIdx]
        if (!child) return
        setLoadingData(true)
        setAssessments([])
        setSummative([])
        setReviews([])
        Promise.all([
            getChildAssessments(child.id).catch(() => []),
            getChildSummative(child.id).catch(() => []),
            getChildReviews(child.id).catch(() => []),
        ]).then(([a, s, r]) => {
            setAssessments(a)
            setSummative(s)
            setReviews(r)
        }).finally(() => setLoadingData(false))
    }, [children, activeIdx])

    const child = children[activeIdx]

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}>
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Academic Results</h1>
                            <p>Performance tracking and term reports</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">{parentUser.userName}</span>
                                    <span className="header-user-role">{parentUser.userRole}</span>
                                </div>
                                <div className={`header-user-av ${parentUser.avatarClass}`}>{parentUser.userInitials}</div>
                            </div>
                        </div>
                    </header>

                    {!loading && children.length > 0 && (
                        <div className="child-switcher-bar">
                            <span className="child-switcher-label">Viewing:</span>
                            {children.map((c, i) => (
                                <button key={c.id}
                                    className={`child-tab${i === activeIdx ? ' active' : ''}`}
                                    onClick={() => setActiveIdx(i)}>
                                    <div className="child-tab-avatar amina">{initials(c.student_name)}</div>
                                    <div className="child-tab-info">
                                        <span className="child-tab-name">{c.student_name}</span>
                                        <span className="child-tab-grade">{c.grade}{c.section}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    <DashboardContent>
                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading…</p>
                        ) : !child ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>No children linked.</p>
                        ) : (
                            <>
                                {/* Recent Assessments table */}
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">Recent Results — {child.student_name}</h3>
                                    </div>
                                    <div className="card-content">
                                        {loadingData ? (
                                            <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
                                        ) : assessments.length === 0 ? (
                                            <p style={{ color: 'var(--muted-foreground)' }}>No assessments recorded yet.</p>
                                        ) : (
                                            <div className="table-responsive">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>Subject</th>
                                                            <th>Type</th>
                                                            <th>Score</th>
                                                            <th>Grade</th>
                                                            <th>Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {assessments.map((a, i) => (
                                                            <AssessmentRow key={a.id || i} {...a} />
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Summative Performance */}
                                {summative.length > 0 && (
                                    <div className="card mt-1-5">
                                        <div className="card-header">
                                            <h3 className="card-title">Summative Performance</h3>
                                        </div>
                                        <div className="card-content">
                                            <div className="table-responsive">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>Subject</th>
                                                            <th>Class Test</th>
                                                            <th>Exam</th>
                                                            <th>Final</th>
                                                            <th>Grade</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {summative.map((r, i) => (
                                                            <SummativeRow key={r.id || i} {...r} />
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Assessments & Teacher Reviews */}
                                <div className="grid-2 mt-1-5">
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Recent Assessments &amp; Projects</h3>
                                            <span className="badge badge-secondary">This Term</span>
                                        </div>
                                        <div className="card-content">
                                            {assessments.length === 0 ? (
                                                <p style={{ color: 'var(--muted-foreground)' }}>No assessments yet.</p>
                                            ) : (
                                                <div className="assessment-list">
                                                    {assessments.slice(0, 4).map((a, i) => (
                                                        <AssessmentItem key={a.id || i} {...a} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Teacher Reviews</h3>
                                        </div>
                                        <div className="card-content">
                                            {reviews.length === 0 ? (
                                                <p style={{ color: 'var(--muted-foreground)' }}>No reviews yet.</p>
                                            ) : (
                                                <div className="review-timeline">
                                                    {reviews.map((r, i) => (
                                                        <ReviewBubble key={r.id || i} {...r} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
