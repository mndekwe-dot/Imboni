import { useState, useEffect } from 'react'
import { getDosResults, approveResult, rejectResult, getDosAnalytics } from '../../api/dos'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, AreaChart, Area,
} from 'recharts'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { StatCard } from '../../components/layout/StatCard'
import { Modal } from '../../components/ui/Modal'
import { FilterBar } from '../../components/ui/FilterBar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

const STATUS_MAP = { submitted: 'pending', approved: 'approved', rejected: 'rejected' }

function groupResults(raw) {
    const map = {}

    raw.forEach(r => {
        //Build the class name from grade and section: Grade=4 , section=A => "S1A"
        const cls = `S${r.grade}${r.section}`
        //Translate backend status to display status
        const status = STATUS_MAP[r.status] || r.status
        // Unique key per card: same class + subject +status = same card
        const key = `${cls}-${r.subject}-${status}`

        //if This is the first student we see for this group , create the card
        if (!map[key]) {
            map[key] = {
                key,          // used later to identify which card to update
                ids: [],  // collect all result IDs in this group (needed for bulk approve/reject)
                title: `${cls} - ${r.subject}`,
                submittedBy: r.teacher || '—',
                date: r.submitted_at
                    ? new Date(r.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—',
                subject: r.subject,
                class: cls,
                status,
                scores: [],  // collect all final scores to compute avg/highest/lowest
                studentMarks: [],  // rows shown in the Student Marks tab of the modal
                examType: 'Assessment',
                maxScore: 100,
                questionPaper: null,
            }
        }

        // Add this student's data to the existing group
        map[key].ids.push(r.id)
        if (r.final_score != null) map[key].scores.push(parseFloat(r.final_score))
        map[key].studentMarks.push({
            id:    r.student_id_code,
            name:  r.student,
            score: r.exam_score,
            grade: r.grade_letter,
        })
    })

    // convert the map object into an array and compute final stats per card
    return Object.values(map).map(g => ({
        ...g,
        students: g.studentMarks.length,
        //Average: sum all scores ÷ count, rounded to nearest whole number
        avg:     g.scores.length ? `${Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length)}%` : '—',
        highest: g.scores.length ? Math.max(...g.scores) : '—',
        lowest:  g.scores.length ? Math.min(...g.scores) : '—',
    }))
}


const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
]

const STATUS_STYLE = {
    pending: { bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)', label: 'Pending' },
    approved: { bg: 'rgba(16,185,129,0.12)', color: 'var(--success)', label: 'Approved' },
    rejected: { bg: 'rgba(239,68,68,0.12)', color: 'var(--destructive)', label: 'Rejected' },
}

// ── Result Card ───────────────────────────────────────────────────────────────
function ResultCard({ result, onReview, onView }) {
    const s = STATUS_STYLE[result.status]
    return (
        <div className="card dos-result-card">

            {/* Header row */}
            <div className="dos-result-header">
                <div className="dos-result-info">
                    <div className="dos-result-title">{result.title}</div>
                    <div className="dos-result-meta">
                        Submitted by {result.submittedBy} &bull; {result.date}
                    </div>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {s.label}
                </span>
            </div>

            {/* Stats row */}
            <div className="dos-mini-stats">
                {[
                    { label: 'Students', value: result.students },
                    { label: 'Average', value: result.avg },
                    { label: 'Highest', value: result.highest },
                ].map(s => (
                    <div key={s.label} className="dos-mini-stat">
                        <div className="dos-mini-stat-value">{s.value}</div>
                        <div className="dos-mini-stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="dos-result-actions">
                {result.status === 'pending' && (
                    <>
                        <button className="btn btn-primary btn-sm" onClick={() => onReview(result)}>
                            <span className="material-symbols-rounded icon-sm">rate_review</span> Review
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => onView(result)}>View Details</button>
                    </>
                )}
                {result.status === 'approved' && (
                    <button className="btn btn-outline btn-sm" onClick={() => onView(result)}>
                        <span className="material-symbols-rounded icon-sm">visibility</span> View Details
                    </button>
                )}
                {result.status === 'rejected' && (
                    <>
                        <button className="btn btn-outline btn-sm btn-destructive-outline" onClick={() => onView(result)}>
                            <span className="material-symbols-rounded icon-sm">info</span> View Feedback
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => onReview(result)}>Re-review</button>
                    </>
                )}
            </div>
        </div>
    )
}

// ── Grade helper ──────────────────────────────────────────────────────────────
function gradeColor(g) {
    return { A: '#10b981', B: '#003d7a', C: '#3b82f6', D: '#f59e0b', F: '#ef4444' }[g] ?? 'var(--muted-foreground)'
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ result, onClose, onApprove, onReject }) {
    const [tab, setTab] = useState('overview')
    const [comment, setComment] = useState('')

    const TABS = [
        { key: 'overview', icon: 'info', label: 'Overview' },
        { key: 'questions', icon: 'quiz', label: 'Question Paper' },
        { key: 'marks', icon: 'assignment', label: 'Student Marks' },
    ]

    return (
        <Modal title="Review Submission" icon="rate_review" onClose={onClose} size="wide"
            footer={
                <div className="modal-confirm-actions flex-wrap-gap-3" style={{ width: '100%' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-outline btn-destructive-outline"
                        onClick={() => { onReject(result); onClose() }}>
                        <span className="material-symbols-rounded icon-sm">cancel</span> Reject
                    </button>
                    <button className="btn btn-primary" onClick={() => { onApprove(result); onClose() }}>
                        <span className="material-symbols-rounded icon-sm">check_circle</span> Approve
                    </button>
                </div>
            }
        >
            {/* Header info strip */}
            <div className="dos-review-block">
                <div className="dos-review-block-header">
                    <div>
                        <div className="dos-review-block-title">{result.title}</div>
                        <div className="dos-review-block-meta">
                            {result.examType} &bull; {result.subject} &bull; Max: {result.maxScore} marks
                        </div>
                        <div className="dos-review-block-meta">
                            Submitted by {result.submittedBy} &bull; {result.date}
                        </div>
                    </div>
                    <div className="dos-review-stats">
                        {[
                            { label: 'Students', value: result.students },
                            { label: 'Average', value: result.avg },
                            { label: 'Highest', value: result.highest },
                        ].map(s => (
                            <div key={s.label} className="dos-review-stat">
                                <div className="dos-review-stat-value">{s.value}</div>
                                <div className="dos-review-stat-label">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="dos-modal-tabs">
                {TABS.map(t => (
                    <button key={t.key}
                        className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setTab(t.key)}
                    >
                        <span className="material-symbols-rounded icon-sm">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Overview tab ── */}
            {tab === 'overview' && (
                <div className="settings-form">
                    <div className="dos-overview-stats">
                        {[
                            { label: 'Total Students', value: result.students, color: 'var(--primary)' },
                            { label: 'Class Average', value: result.avg, color: 'var(--success)' },
                            { label: 'Highest Score', value: result.highest, color: 'var(--success)' },
                            { label: 'Lowest Score', value: result.lowest, color: 'var(--destructive)' },
                        ].map(s => (
                            <div key={s.label} className="dos-overview-stat">
                                <div className="dos-overview-stat-value" style={{ color: s.color }}>{s.value}</div>
                                <div className="dos-overview-stat-label">{s.label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="form-group">
                        <label className="form-label">Review Comment (optional)</label>
                        <textarea className="form-control" rows={3}
                            placeholder="Add a note for the teacher — required if rejecting..."
                            value={comment} onChange={e => setComment(e.target.value)}
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                </div>
            )}

            {/* ── Question Paper tab ── */}
            {tab === 'questions' && (
                !result.questionPaper ? (
                    <div className="qp-empty">
                        <span className="material-symbols-rounded qp-empty-icon">description</span>
                        No question paper was attached for this submission.
                    </div>
                ) : (
                    <div className="settings-form">
                        <div className="qp-file-card">
                            <div className="qp-file-icon">
                                <span className="material-symbols-rounded">picture_as_pdf</span>
                            </div>
                            <div className="qp-file-body">
                                <div className="qp-file-name">{result.questionPaper.name}</div>
                                <div className="qp-file-meta">
                                    {result.questionPaper.pages} pages &bull; {result.questionPaper.size} &bull; Uploaded {result.questionPaper.uploadedAt}
                                </div>
                            </div>
                            <button className="btn btn-outline btn-sm">
                                <span className="material-symbols-rounded icon-sm">download</span> Download
                            </button>
                        </div>
                        <div className="qp-preview">
                            <span className="material-symbols-rounded qp-preview-icon">picture_as_pdf</span>
                            <div className="qp-preview-title">{result.questionPaper.name}</div>
                            <div className="qp-preview-meta">{result.questionPaper.pages} pages · {result.questionPaper.size}</div>
                            <button className="btn btn-primary btn-sm" style={{ marginTop: '0.25rem' }}>
                                <span className="material-symbols-rounded icon-sm">open_in_new</span> Open Document
                            </button>
                        </div>
                    </div>
                )
            )}

            {/* ── Student Marks tab ── */}
            {tab === 'marks' && (
                result.studentMarks.length === 0 ? (
                    <div className="qp-empty">
                        <span className="material-symbols-rounded qp-empty-icon" style={{ opacity: 0.5 }}>people</span>
                        No student marks available for this submission.
                    </div>
                ) : (
                    <div className="marks-wrap">
                        <table className="marks-table">
                            <thead>
                                <tr>
                                    {['#', 'Student ID', 'Name', 'Score', 'Grade'].map(h => (
                                        <th key={h}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {result.studentMarks.map((s, i) => (
                                    <tr key={s.id}>
                                        <td className="marks-td-num">{i + 1}</td>
                                        <td className="marks-td-id">{s.id}</td>
                                        <td className="marks-td-name">{s.name}</td>
                                        <td className="marks-td-score">{s.score}/{result.maxScore}</td>
                                        <td>
                                            <span style={{ fontWeight: 700, fontSize: '0.82rem', padding: '2px 10px', borderRadius: 20, background: `${gradeColor(s.grade)}18`, color: gradeColor(s.grade) }}>{s.grade}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="marks-footer">
                            {result.studentMarks.length} of {result.students} students shown
                        </div>
                    </div>
                )
            )}
        </Modal>
    )
}

// ── View Details Modal ────────────────────────────────────────────────────────
function ViewModal({ result, onClose }) {
    const s = STATUS_STYLE[result.status]
    const passCount = Math.round(result.students * 0.88)
    const failCount = result.students - passCount
    return (
        <Modal title="Result Details" icon="assessment" onClose={onClose}
            footer={<button className="btn btn-outline" onClick={onClose}>Close</button>}
        >
            <div className="dos-review-block-header mb-5">
                <div>
                    <div className="dos-review-block-title">{result.title}</div>
                    <div className="dos-review-block-meta">{result.submittedBy} &bull; {result.date}</div>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, flexShrink: 0 }}>{s.label}</span>
            </div>

            <div className="view-stat-grid">
                {[
                    { label: 'Total Students', value: result.students, color: 'var(--primary)' },
                    { label: 'Class Average', value: result.avg, color: 'var(--success)' },
                    { label: 'Highest Score', value: result.highest, color: 'var(--success)' },
                    { label: 'Lowest Score', value: result.lowest, color: 'var(--destructive)' },
                    { label: 'Passed', value: passCount, color: 'var(--success)' },
                    { label: 'Failed', value: failCount, color: 'var(--destructive)' },
                ].map(item => (
                    <div key={item.label} className="view-stat-cell">
                        <span className="view-stat-label">{item.label}</span>
                        <span className="view-stat-value" style={{ color: item.color }}>{item.value}</span>
                    </div>
                ))}
            </div>

            <div className="text-xs-muted" style={{ textAlign: 'center' }}>
                Pass rate: {Math.round((passCount / result.students) * 100)}% &bull; {result.title}
            </div>
        </Modal>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function DosResults() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    // UI tab: 'approval' shows the result cards, 'analytics' shows charts
    const [activeTab, setActiveTab] = useState('approval')
    // Filter buttons: 'all', 'pending', 'approved', 'rejected'
    const [statusFilter, setStatusFilter] = useState('all')
    const [search, setSearch] = useState('')
    // cards = the grouped, transformed result cards shown in the UI
    const [cards, setCards] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    // reviewing = the card currently open in the Review modal
    const [reviewing, setReviewing] = useState(null)
    const [viewing, setViewing] = useState(null)

    // Analytics tab state
    const [analyticsData,    setAnalyticsData]    = useState(null)
    const [analyticsLoading, setAnalyticsLoading] = useState(false)
    const [activeTermId,     setActiveTermId]      = useState(null)

    // Fetch analytics when tab is opened or term changes
    useEffect(() => {
        if (activeTab !== 'analytics') return
        setAnalyticsLoading(true)
        const params = activeTermId ? { term_id: activeTermId } : {}
        getDosAnalytics(params)
            .then(data => {
                setAnalyticsData(data)
                if (!activeTermId && data.current_term_id) setActiveTermId(data.current_term_id)
            })
            .catch(() => {})
            .finally(() => setAnalyticsLoading(false))
    }, [activeTab, activeTermId])

    // Fetch all results from the API when the page loads
    useEffect(() => {
        getDosResults()
            .then(data => {
                // The client interceptor unwraps .data already.
                // Handle both paginated { results: [] } and plain array responses.
                const raw = Array.isArray(data) ? data : (data.results ?? [])
                // Group individual student rows into class+subject cards
                setCards(groupResults(raw))
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    // Derive stat card numbers live from the cards array.
    // This means they update automatically when you approve/reject without refetching.
    const resultStats = [
        {
            colorClass: 'warning', icon: 'pending', trend: 'Requires review',
            value: cards.filter(c => c.status === 'pending').length, label: 'Pending Approval'
        },
        {
            colorClass: 'success', icon: 'check_circle', trend: 'This term',
            value: cards.filter(c => c.status === 'approved').length, label: 'Approved'
        },
        {
            colorClass: 'danger', icon: 'cancel', trend: 'Needs correction',
            value: cards.filter(c => c.status === 'rejected').length, label: 'Rejected'
        },
        {
            colorClass: 'info', icon: 'analytics', trend: 'Average',
            // Approval rate = approved cards ÷ total cards × 100
            value: cards.length
                ? `${Math.round(cards.filter(c => c.status === 'approved').length / cards.length * 100)}%`
                : '0%',
            label: 'Approval Rate'
        },
    ]

    // Approve all individual student results inside this card.
    // A card groups many students, so we call approveResult() for each ID.
    // Promise.all runs all the API calls at the same time (parallel), not one by one.
    async function handleApprove(card) {
        try {
            await Promise.all(card.ids.map(id => approveResult(id)))
            // Update the card's status in local state so UI reflects change immediately
            // without needing to refetch from the API
            setCards(prev => prev.map(c => c.key === card.key ? { ...c, status: 'approved' } : c))
        } catch (err) { console.error(err) }
    }

    // Same pattern as approve — reject all results in this card group
    async function handleReject(card) {
        try {
            await Promise.all(card.ids.map(id => rejectResult(id, '')))
            setCards(prev => prev.map(c => c.key === card.key ? { ...c, status: 'rejected' } : c))
        } catch (err) { console.error(err) }
    }

    // Add a count badge to each filter tab (e.g. "Pending 3")
    const statusTabsWithCount = STATUS_TABS.map(t => ({
        ...t,
        count: t.key === 'all' ? undefined : cards.filter(c => c.status === t.key).length,
    }))

    // Apply the active status filter and search box to reduce the visible cards
    const visible = cards.filter(c => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false
        if (search && !`${c.title} ${c.submittedBy}`.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>
    if (error) return <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Results" subtitle="Approval queue and school performance analytics" {...dosUser} notifications={liveNotifications} onNotificationRead={markRead} />

                    <DashboardContent>

                        {/* Main tab switcher */}
                        <div className="flex-wrap-gap-3">
                            {[
                                { key: 'approval', icon: 'pending', label: 'Approval Queue', badge: cards.filter(c => c.status === 'pending').length },
                                { key: 'analytics', icon: 'bar_chart', label: 'Analytics' },
                            ].map(t => (
                                <button key={t.key}
                                    className={`btn btn-sm ${activeTab === t.key ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setActiveTab(t.key)}
                                >
                                    <span className="material-symbols-rounded icon-sm">{t.icon}</span>
                                    {t.label}
                                    {t.badge > 0 && (
                                        <span style={{ marginLeft: '0.3rem', background: 'rgba(255,255,255,0.25)', borderRadius: 999, padding: '0 6px', fontSize: '0.72rem', fontWeight: 700 }}>
                                            {t.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* ── APPROVAL TAB ── */}
                        {activeTab === 'approval' && (
                            <>
                                <div className="portal-stat-grid">
                                    {resultStats.map((s, i) => <StatCard key={i} {...s} />)}
                                </div>

                                {/* Toolbar */}
                                <div className="toolbar-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                    <div className="toolbar-search">
                                        <span className="material-symbols-rounded">search</span>
                                        <input
                                            placeholder="Search by teacher, subject, or class..."
                                            value={search} onChange={e => setSearch(e.target.value)}
                                        />
                                        {search && (
                                            <button className="toolbar-search-clear" onClick={() => setSearch('')}>
                                                <span className="material-symbols-rounded">close</span>
                                            </button>
                                        )}
                                    </div>
                                    <FilterBar options={statusTabsWithCount} active={statusFilter} onChange={setStatusFilter} />
                                </div>

                                {/* Result cards */}
                                {visible.length === 0 ? (
                                    <div className="qp-empty">
                                        <span className="material-symbols-rounded qp-empty-icon" style={{ opacity: 0.5 }}>search_off</span>
                                        No results match your filters.
                                    </div>
                                ) : (
                                    <div className="settings-form">
                                        {visible.map(r => (
                                            <ResultCard key={r.id} result={r}
                                                onReview={setReviewing}
                                                onView={setViewing}
                                                onApprove={handleApprove}
                                                onReject={handleReject}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── ANALYTICS TAB ── */}
                        {activeTab === 'analytics' && (() => {
                            if (analyticsLoading || !analyticsData) {
                                return <p style={{ padding: '1.5rem', color: 'var(--muted-foreground)' }}>Loading analytics…</p>
                            }
                            const d = analyticsData
                            const tooltipStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.82rem' }
                            const analyticsStats = [
                                { colorClass: '',        icon: 'trending_up',  value: `${d.stats.overall_avg}%`,     label: 'Overall Performance',   trend: 'Current term avg',   trendClass: d.stats.overall_avg >= 70 ? 'positive' : 'negative' },
                                { colorClass: 'success', icon: 'check_circle', value: `${d.stats.attendance_rate}%`, label: 'Attendance Rate',        trend: d.stats.attendance_rate >= 90 ? 'Above target' : 'Below target', trendClass: d.stats.attendance_rate >= 90 ? 'positive' : 'negative' },
                                { colorClass: 'warning', icon: 'groups',       value: d.stats.ratio,                 label: 'Teacher-Student Ratio',  trend: 'Current enrolment',  trendClass: '' },
                                { colorClass: 'info',    icon: 'emoji_events', value: d.stats.top_performers,        label: 'Top Performers',         trend: 'Score ≥ 80%',        trendClass: 'positive' },
                            ]
                            return (
                                <>
                                    <div className="portal-stat-grid">
                                        {analyticsStats.map((s, i) => <StatCard key={i} {...s} />)}
                                    </div>

                                    {/* Term selector from API */}
                                    <div className="flex-row-gap-sm" style={{ flexWrap: 'wrap' }}>
                                        <span className="settings-info-text fw-600">Viewing:</span>
                                        {(d.terms || []).map(t => (
                                            <button key={t.id}
                                                className={`btn btn-sm ${activeTermId === t.id ? 'btn-primary' : 'btn-outline'}`}
                                                onClick={() => setActiveTermId(t.id)}
                                            >{t.name}</button>
                                        ))}
                                    </div>

                                    {/* Row 1: Grade dist donut + Attendance area */}
                                    <div className="analytics-chart-grid">

                                        {/* Grade Distribution Donut */}
                                        <div className="card">
                                            <div className="card-header">
                                                <h3 className="card-title">Grade Distribution</h3>
                                                <span className="settings-info-text">{(d.terms || []).find(t => t.id === activeTermId)?.name || ''}</span>
                                            </div>
                                            <div className="card-content">
                                                <ResponsiveContainer width="100%" height={240}>
                                                    <PieChart>
                                                        <Pie data={d.grade_distribution} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                                                            dataKey="value" paddingAngle={3}
                                                        >
                                                            {(d.grade_distribution || []).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                                        </Pie>
                                                        <Tooltip formatter={(v, n) => [`${v}%`, n]} contentStyle={tooltipStyle} />
                                                        <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: '0.75rem' }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Monthly Attendance AreaChart */}
                                        <div className="card">
                                            <div className="card-header">
                                                <h3 className="card-title">Attendance Trend</h3>
                                                <span className="settings-info-text">{(d.terms || []).find(t => t.id === activeTermId)?.name || ''}</span>
                                            </div>
                                            <div className="card-content">
                                                <ResponsiveContainer width="100%" height={240}>
                                                    <AreaChart data={d.attendance_monthly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="attGrad2" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                                                        <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                                                        <Tooltip formatter={v => [`${v}%`, 'Attendance']} contentStyle={tooltipStyle} cursor={{ stroke: 'var(--border)' }} />
                                                        <Area type="monotone" dataKey="rate" name="Attendance" stroke="#10b981" strokeWidth={2} fill="url(#attGrad2)" dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 5 }} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 2: Pass/Fail by Class stacked bar */}
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Pass / Fail Rate by Class</h3>
                                            <span className="settings-info-text">{(d.terms || []).find(t => t.id === activeTermId)?.name || ''} · % of students</span>
                                        </div>
                                        <div className="card-content">
                                            <ResponsiveContainer width="100%" height={220}>
                                                <BarChart data={d.pass_fail} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                    <XAxis dataKey="class" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                                                    <Tooltip formatter={(v, n) => [`${v}%`, n]} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: '0.78rem' }} />
                                                    <Bar dataKey="pass" name="Passed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={40} />
                                                    <Bar dataKey="fail" name="Failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Row 3: Subject submission status + Grade/Subject perf side by side */}
                                    <div className="analytics-chart-grid">

                                        {/* Teacher Submission Status */}
                                        <div className="card">
                                            <div className="card-header">
                                                <h3 className="card-title">Result Submissions</h3>
                                                <span className="settings-info-text">By subject</span>
                                            </div>
                                            <div className="card-content">
                                                <ResponsiveContainer width="100%" height={240}>
                                                    <BarChart data={d.submissions} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }} barCategoryGap="25%">
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                                                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                        <YAxis type="category" dataKey="subject" tick={{ fontSize: 10, fill: 'var(--foreground)' }} axisLine={false} tickLine={false} width={78} />
                                                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                                        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: '0.78rem' }} />
                                                        <Bar dataKey="submitted" name="Submitted" stackId="b" fill="#003d7a" radius={[0, 0, 0, 0]} maxBarSize={18} />
                                                        <Bar dataKey="pending" name="Pending" stackId="b" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={18} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Performance by Grade */}
                                        <div className="card">
                                            <div className="card-header">
                                                <h3 className="card-title">Performance by Grade</h3>
                                                <span className="settings-info-text">{(d.terms || []).find(t => t.id === activeTermId)?.name || ''}</span>
                                            </div>
                                            <div className="card-content">
                                                <ResponsiveContainer width="100%" height={240}>
                                                    <BarChart data={d.grade_performance} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                                                        <XAxis type="number" domain={[50, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                                                        <YAxis type="category" dataKey="grade" tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--foreground)' }} axisLine={false} tickLine={false} width={28} />
                                                        <Tooltip formatter={v => [`${v}%`, 'Average']} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                                        <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={20}>
                                                            {(d.grade_performance || []).map((e, i) => <Cell key={i} fill={e.score >= 80 ? '#10b981' : e.score >= 70 ? '#003d7a' : '#f59e0b'} />)}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 4: Subject Performance (full width) */}
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Subject Performance</h3>
                                            <span className="settings-info-text">{(d.terms || []).find(t => t.id === activeTermId)?.name || ''}</span>
                                        </div>
                                        <div className="card-content">
                                            <ResponsiveContainer width="100%" height={240}>
                                                <BarChart data={d.subject_averages} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                                                    <XAxis type="number" domain={[50, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                                                    <YAxis type="category" dataKey="subject" tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--foreground)' }} axisLine={false} tickLine={false} width={78} />
                                                    <Tooltip formatter={v => [`${v}%`, 'Average']} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                                    <Bar dataKey="avg_score" radius={[0, 6, 6, 0]} maxBarSize={20}>
                                                        {(d.subject_averages || []).map((e, i) => <Cell key={i} fill={e.avg_score >= 78 ? '#10b981' : '#f59e0b'} />)}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </>
                            )
                        })()}

                    </DashboardContent>
                </main>
            </div>

            {/* Modals */}
            {reviewing && (
                <ReviewModal
                    result={reviewing}
                    onClose={() => setReviewing(null)}
                    onApprove={handleApprove}
                    onReject={handleReject}
                />
            )}
            {viewing && (
                <ViewModal result={viewing} onClose={() => setViewing(null)} />
            )}
        </>
    )
}
