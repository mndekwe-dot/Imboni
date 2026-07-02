import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { getStudentProfile, getStudentResults, getStudentAssessments } from '../../api/student'
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'

function gradeClass(grade) {
    if (!grade) return ''
    const g = grade.charAt(0)
    if (g === 'A') return 'grade-a'
    if (g === 'B') return 'grade-b'
    if (g === 'C') return 'grade-c'
    return 'grade-d'
}

function gradeBadgeStyle(grade) {
    if (!grade) return {}
    const g = grade.charAt(0)
    if (g === 'A') return { background: 'var(--success-light)', color: 'var(--success)' }
    if (g === 'B') return { background: 'var(--student-light)', color: 'var(--student)' }
    if (g === 'C') return { background: 'var(--warning-light)', color: 'var(--warning)' }
    return { background: 'var(--destructive-light)', color: 'var(--destructive)' }
}

function scoreToWidth(score) {
    return `${Math.min(Math.max(score || 0, 0), 100)}%`
}

function ResultSummaryCard({ value, label, color }) {
    return (
        <div className="result-summary-card">
            <div className="result-summary-value" style={color ? { color } : {}}>{value}</div>
            <div className="result-summary-label">{label}</div>
        </div>
    )
}

function SubjectGradeCard({ subject, grade, final_score }) {
    const gc = gradeClass(grade)
    const width = scoreToWidth(final_score)
    return (
        <div className={`subject-grade-card ${gc}`}>
            <div className="subject-grade-top">
                <span className="subject-name-label">{subject}</span>
                <span className="grade-badge">{grade || '—'}</span>
            </div>
            <div className="grade-bar-wrap">
                <div className="grade-bar" style={{ width }}></div>
            </div>
            <div className="grade-meta">
                <span>{`${final_score != null ? `${final_score}%` : '—'}`}</span>
            </div>
        </div>
    )
}

function AssessmentRow({ subject_name, title, max_score, score_obtained, percentage, grade, date }) {
    const pct = percentage != null ? `${parseFloat(percentage).toFixed(0)}%` : '—'
    const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
    return (
        <tr>
            <td><strong>{subject_name}</strong></td>
            <td>{title}</td>
            <td>{max_score != null ? parseInt(max_score) : '—'}</td>
            <td>{score_obtained != null ? parseInt(score_obtained) : '—'}</td>
            <td>{pct}</td>
            <td><span className="badge" style={gradeBadgeStyle(grade)}>{grade || '—'}</span></td>
            <td>{dateStr}</td>
        </tr>
    )
}

export function StudentResults() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [profile,     setProfile]     = useState(null)
    const [terms,       setTerms]       = useState([])
    const [assessments, setAssessments] = useState([])
    const [activeTerm,  setActiveTerm]  = useState(null)
    const [loading,     setLoading]     = useState(true)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim()
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()

    useEffect(() => {
        Promise.all([
            getStudentProfile().catch(() => null),
            getStudentResults().catch(() => []),
        ]).then(([prof, results]) => {
            setProfile(prof)
            setTerms(results || [])
            if (results?.length) setActiveTerm(results[0].term_id)

            if (prof?.student_id) {
                return getStudentAssessments(prof.student_id).catch(() => [])
            }
            return []
        }).then(ass => {
            setAssessments(ass || [])
        }).finally(() => setLoading(false))
    }, [])

    const gradeSection = profile ? `${profile.grade}${profile.section}` : ''
    const userRole     = gradeSection ? `Student · ${gradeSection}` : 'Student'

    const activeTData = terms.find(t => t.term_id === activeTerm) || terms[0]
    const subjects    = activeTData?.subjects || []

    const avgScore = activeTData?.average_score
    const numSubjects = subjects.length

    const summaryStats = [
        { value: avgScore != null ? `${avgScore}%` : '—', label: 'Average Score',   color: 'var(--student)' },
        { value: numSubjects || '—',                        label: 'Subjects Taken',  color: 'var(--accent)'  },
        { value: activeTData?.term || '—',                  label: 'Term',            color: null             },
        { value: activeTData?.year || '—',                  label: 'Year',            color: 'var(--success)' },
    ]

    const termAssessments = activeTData
        ? assessments.filter(() => true)
        : assessments

    // Term-over-term average, oldest first (terms arrive newest-first)
    const trendData = [...terms]
        .reverse()
        .filter(t => t.average_score != null)
        .map(t => ({
            label: t.year && !String(t.term).includes(String(t.year)) ? `${t.term} ${t.year}` : t.term,
            average: t.average_score,
        }))

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="My Results"
                        subtitle={gradeSection ? `Academic performance — ${gradeSection}` : 'Academic performance'}
                        userName={fullName}
                        userRole={userRole}
                        userInitials={initials}
                        avatarClass="student-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading results…</p>
                        ) : terms.length === 0 ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>No results available yet.</p>
                        ) : (
                            <>
                                {/* Term tabs */}
                                <div className="toolbar-card" style={{ width: 'fit-content' }}>
                                    {terms.map(t => (
                                        <button
                                            key={t.term_id}
                                            className={`term-tab${activeTerm === t.term_id ? ' active' : ''}`}
                                            onClick={() => setActiveTerm(t.term_id)}
                                        >
                                            {t.term}
                                        </button>
                                    ))}
                                </div>

                                {/* Summary stats */}
                                <div className="results-summary-grid">
                                    {summaryStats.map((s, i) => (
                                        <ResultSummaryCard key={i} {...s} />
                                    ))}
                                </div>

                                {/* Term-over-term trend */}
                                {trendData.length >= 2 && (
                                    <div className="card" style={{ marginBottom: '1rem' }}>
                                        <div className="card-header">
                                            <h3 className="card-title">My Average Over Time</h3>
                                        </div>
                                        <div className="card-content" style={{ height: 200 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                    <XAxis dataKey="label" tickLine={false} axisLine={false}
                                                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                                                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false}
                                                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                                        tickFormatter={v => `${v}%`} />
                                                    <Tooltip
                                                        formatter={v => [`${v}%`, 'My average']}
                                                        cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                                                    />
                                                    <Line type="monotone" dataKey="average" name="My average"
                                                        stroke="#0891b2" strokeWidth={2}
                                                        dot={{ r: 4, fill: '#0891b2', strokeWidth: 2, stroke: 'var(--card, #fff)' }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                {/* Subject grade cards */}
                                {subjects.length > 0 && (
                                    <div className="subject-grades-grid">
                                        {subjects.map((s, i) => (
                                            <SubjectGradeCard key={i} {...s} />
                                        ))}
                                    </div>
                                )}

                                {/* Detailed assessment table */}
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">Detailed Assessment Breakdown</h3>
                                        {activeTData && <span className="badge badge-student">{activeTData.term}</span>}
                                    </div>
                                    <div className="card-content">
                                        {termAssessments.length === 0 ? (
                                            <p style={{ color: 'var(--muted-foreground)' }}>No individual assessments recorded.</p>
                                        ) : (
                                            <div className="table-responsive">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>Subject</th><th>Assessment</th><th>Max</th>
                                                            <th>Score</th><th>%</th><th>Grade</th><th>Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {termAssessments.map((row, i) => (
                                                            <AssessmentRow key={i} {...row} />
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
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
