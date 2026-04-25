import { useState } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, AreaChart, Area,
} from 'recharts'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { Modal } from '../../components/ui/Modal'
import { FilterBar } from '../../components/ui/FilterBar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

// ── Data ──────────────────────────────────────────────────────────────────────
const resultStats = [
    { colorClass: 'warning', icon: 'pending',      trend: 'Requires review',  value: '24',  label: 'Pending Approval' },
    { colorClass: 'success', icon: 'check_circle', trend: 'This term',        value: '156', label: 'Approved'         },
    { colorClass: 'danger',  icon: 'cancel',       trend: 'Needs correction', value: '8',   label: 'Rejected'         },
    { colorClass: 'info',    icon: 'analytics',    trend: 'Average',          value: '87%', label: 'Approval Rate'    },
]

const allResults = [
    {
        id: 1, title: 'S4A - Mathematics Mid-Term', submittedBy: 'Mr. Pacifique Rurangwa',
        date: 'Feb 8, 2026', students: 32, avg: '85%', highest: 94, lowest: 61, status: 'pending',
        maxScore: 100, examType: 'Mid-Term Exam', subject: 'Mathematics', class: 'S4A',
        questionPaper: { name: 'S4A_Mathematics_MidTerm_2026.pdf', size: '1.2 MB', pages: 4, uploadedAt: 'Feb 8, 2026 · 07:45 AM' },
        studentMarks: [
            { id:'STU-001', name:'Uwase Amina',        score:92, grade:'A' },
            { id:'STU-002', name:'Mutabazi Kevin',      score:78, grade:'B' },
            { id:'STU-003', name:'Hakizimana Grace',    score:94, grade:'A' },
            { id:'STU-004', name:'Ingabire Marie',      score:85, grade:'A' },
            { id:'STU-005', name:'Nkurunziza Peter',    score:61, grade:'D' },
            { id:'STU-006', name:'Bizimana James',      score:88, grade:'A' },
            { id:'STU-007', name:'Umutoni Diane',       score:74, grade:'B' },
            { id:'STU-008', name:'Rugamba Patrick',     score:83, grade:'A' },
        ],
    },
    {
        id: 2, title: 'S3B - English Language', submittedBy: 'Mr. Fidèle Hakizimana',
        date: 'Feb 7, 2026', students: 28, avg: '78%', highest: 88, lowest: 54, status: 'pending',
        maxScore: 100, examType: 'End-Term Exam', subject: 'English', class: 'S3B',
        questionPaper: { name: 'S3B_English_EndTerm_2026.pdf', size: '0.8 MB', pages: 3, uploadedAt: 'Feb 7, 2026 · 08:10 AM' },
        studentMarks: [
            { id:'STU-011', name:'Bizimana Norbert',    score:88, grade:'A' },
            { id:'STU-012', name:'Rugamba Patrick',     score:76, grade:'B' },
            { id:'STU-013', name:'Niyonzima Kevin',     score:54, grade:'F' },
            { id:'STU-014', name:'Kayitesi Alice',      score:82, grade:'A' },
            { id:'STU-015', name:'Tuyisenge Nina',      score:71, grade:'B' },
            { id:'STU-016', name:'Rukundo Marc',        score:68, grade:'C' },
        ],
    },
    {
        id: 3, title: 'S2A - Biology Practical', submittedBy: 'Dr. Immaculée Nsabimana',
        date: 'Feb 6, 2026', students: 30, avg: '82%', highest: 97, lowest: 58, status: 'pending',
        maxScore: 50, examType: 'Practical Exam', subject: 'Biology', class: 'S2A',
        questionPaper: { name: 'S2A_Biology_Practical_Feb2026.pdf', size: '2.1 MB', pages: 6, uploadedAt: 'Feb 6, 2026 · 06:55 AM' },
        studentMarks: [
            { id:'STU-021', name:'Mugisha Jean',        score:45, grade:'A' },
            { id:'STU-022', name:'Kayitesi Alice',      score:38, grade:'B' },
            { id:'STU-023', name:'Nzeyimana Eric',      score:48, grade:'A' },
            { id:'STU-024', name:'Akimana Claire',      score:29, grade:'D' },
            { id:'STU-025', name:'Bagirishya Henri',    score:42, grade:'B' },
        ],
    },
    { id: 4, title: 'S1B - History Essay',     submittedBy: 'Mr. Jean Ntakirutimana', date: 'Feb 4, 2026',  students: 27, avg: '74%', highest: 91, lowest: 50, status: 'approved', maxScore: 40,  examType: 'Essay',         subject: 'History',   class: 'S1B', questionPaper: { name: 'S1B_History_Essay_2026.pdf',       size: '0.5 MB', pages: 2, uploadedAt: 'Feb 4, 2026 · 09:00 AM' }, studentMarks: [] },
    { id: 5, title: 'S5A - Chemistry CAT 2',   submittedBy: 'Mr. Eric Bizimana',      date: 'Feb 3, 2026',  students: 25, avg: '79%', highest: 95, lowest: 55, status: 'approved', maxScore: 50,  examType: 'CAT',           subject: 'Chemistry', class: 'S5A', questionPaper: { name: 'S5A_Chemistry_CAT2_2026.pdf',      size: '1.0 MB', pages: 3, uploadedAt: 'Feb 3, 2026 · 07:30 AM' }, studentMarks: [] },
    { id: 6, title: 'S6B - Physics End-Term',  submittedBy: 'Ms. Sandrine Uwera',     date: 'Jan 30, 2026', students: 22, avg: '71%', highest: 89, lowest: 48, status: 'rejected', maxScore: 100, examType: 'End-Term Exam', subject: 'Physics',   class: 'S6B', questionPaper: null, studentMarks: [] },
]

const analyticsStats = [
    { colorClass: '',        icon: 'trending_up',  value: '78%',  label: 'Overall Performance',   trend: '+3% from last term' },
    { colorClass: 'success', icon: 'check_circle', value: '94%',  label: 'Attendance Rate',       trend: 'Above target'       },
    { colorClass: 'warning', icon: 'groups',       value: '1:15', label: 'Teacher-Student Ratio', trend: 'Optimal range'      },
    { colorClass: 'info',    icon: 'emoji_events', value: '342',  label: 'Top Performers',        trend: 'Above 80%'          },
]

// Analytics data per term
const ANALYTICS_DATA = {
    'Term 1': {
        gradePerf:    [{ grade:'S6',score:79 },{ grade:'S5',score:75 },{ grade:'S4',score:71 },{ grade:'S3',score:69 },{ grade:'S2',score:66 },{ grade:'S1',score:68 }],
        subjectPerf:  [{ subject:'Mathematics',score:73 },{ subject:'English',score:78 },{ subject:'Science',score:70 },{ subject:'History',score:76 },{ subject:'Geography',score:71 },{ subject:'Kinyarwanda',score:65 }],
        gradeDist:    [{ name:'A (80–100)',value:22,color:'#10b981' },{ name:'B (70–79)',value:31,color:'#003d7a' },{ name:'C (60–69)',value:26,color:'#3b82f6' },{ name:'D (50–59)',value:14,color:'#f59e0b' },{ name:'F (<50)', value:7, color:'#ef4444' }],
        attendance:   [{ month:'Jan',rate:91 },{ month:'Feb',rate:88 },{ month:'Mar',rate:90 }],
        passFail:     [{ class:'S1',pass:78,fail:22 },{ class:'S2',pass:74,fail:26 },{ class:'S3',pass:81,fail:19 },{ class:'S4',pass:83,fail:17 },{ class:'S5',pass:86,fail:14 },{ class:'S6',pass:88,fail:12 }],
        submissions:  [{ subject:'Mathematics',submitted:8,pending:2 },{ subject:'English',submitted:7,pending:3 },{ subject:'Science',submitted:9,pending:1 },{ subject:'History',submitted:6,pending:4 },{ subject:'Geography',submitted:8,pending:2 },{ subject:'Kinyarwanda',submitted:5,pending:5 }],
    },
    'Term 2': {
        gradePerf:    [{ grade:'S6',score:82 },{ grade:'S5',score:78 },{ grade:'S4',score:75 },{ grade:'S3',score:72 },{ grade:'S2',score:69 },{ grade:'S1',score:71 }],
        subjectPerf:  [{ subject:'Mathematics',score:76 },{ subject:'English',score:81 },{ subject:'Science',score:73 },{ subject:'History',score:79 },{ subject:'Geography',score:74 },{ subject:'Kinyarwanda',score:68 }],
        gradeDist:    [{ name:'A (80–100)',value:28,color:'#10b981' },{ name:'B (70–79)',value:34,color:'#003d7a' },{ name:'C (60–69)',value:23,color:'#3b82f6' },{ name:'D (50–59)',value:11,color:'#f59e0b' },{ name:'F (<50)', value:4, color:'#ef4444' }],
        attendance:   [{ month:'Apr',rate:93 },{ month:'May',rate:91 },{ month:'Jun',rate:89 },{ month:'Jul',rate:92 }],
        passFail:     [{ class:'S1',pass:82,fail:18 },{ class:'S2',pass:78,fail:22 },{ class:'S3',pass:85,fail:15 },{ class:'S4',pass:87,fail:13 },{ class:'S5',pass:89,fail:11 },{ class:'S6',pass:91,fail:9 }],
        submissions:  [{ subject:'Mathematics',submitted:10,pending:0 },{ subject:'English',submitted:9,pending:1 },{ subject:'Science',submitted:10,pending:0 },{ subject:'History',submitted:8,pending:2 },{ subject:'Geography',submitted:9,pending:1 },{ subject:'Kinyarwanda',submitted:7,pending:3 }],
    },
    'Term 3': {
        gradePerf:    [{ grade:'S6',score:85 },{ grade:'S5',score:81 },{ grade:'S4',score:78 },{ grade:'S3',score:75 },{ grade:'S2',score:72 },{ grade:'S1',score:74 }],
        subjectPerf:  [{ subject:'Mathematics',score:79 },{ subject:'English',score:84 },{ subject:'Science',score:76 },{ subject:'History',score:82 },{ subject:'Geography',score:77 },{ subject:'Kinyarwanda',score:71 }],
        gradeDist:    [{ name:'A (80–100)',value:33,color:'#10b981' },{ name:'B (70–79)',value:36,color:'#003d7a' },{ name:'C (60–69)',value:20,color:'#3b82f6' },{ name:'D (50–59)',value:8, color:'#f59e0b' },{ name:'F (<50)', value:3, color:'#ef4444' }],
        attendance:   [{ month:'Aug',rate:94 },{ month:'Sep',rate:93 },{ month:'Oct',rate:95 },{ month:'Nov',rate:92 }],
        passFail:     [{ class:'S1',pass:85,fail:15 },{ class:'S2',pass:81,fail:19 },{ class:'S3',pass:88,fail:12 },{ class:'S4',pass:90,fail:10 },{ class:'S5',pass:92,fail:8 },{ class:'S6',pass:94,fail:6 }],
        submissions:  [{ subject:'Mathematics',submitted:10,pending:0 },{ subject:'English',submitted:10,pending:0 },{ subject:'Science',submitted:10,pending:0 },{ subject:'History',submitted:9,pending:1 },{ subject:'Geography',submitted:10,pending:0 },{ subject:'Kinyarwanda',submitted:8,pending:2 }],
    },
}

const STATUS_TABS = [
    { key: 'all',      label: 'All'      },
    { key: 'pending',  label: 'Pending'  },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
]

const STATUS_STYLE = {
    pending:  { bg: 'rgba(245,158,11,0.12)',  color: 'var(--warning)',     label: 'Pending'  },
    approved: { bg: 'rgba(16,185,129,0.12)',  color: 'var(--success)',     label: 'Approved' },
    rejected: { bg: 'rgba(239,68,68,0.12)',   color: 'var(--destructive)', label: 'Rejected' },
}

// ── Result Card ───────────────────────────────────────────────────────────────
function ResultCard({ result, onReview, onView, onApprove, onReject }) {
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
                    { label: 'Average',  value: result.avg      },
                    { label: 'Highest',  value: result.highest  },
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
    return { A:'#10b981', B:'#003d7a', C:'#3b82f6', D:'#f59e0b', F:'#ef4444' }[g] ?? 'var(--muted-foreground)'
}

// ── Review Modal ──────────────────────────────────────────────────────────────
function ReviewModal({ result, onClose, onApprove, onReject }) {
    const [tab,     setTab]     = useState('overview')
    const [comment, setComment] = useState('')

    const TABS = [
        { key: 'overview',  icon: 'info',        label: 'Overview'        },
        { key: 'questions', icon: 'quiz',         label: 'Question Paper'  },
        { key: 'marks',     icon: 'assignment',   label: 'Student Marks'   },
    ]

    return (
        <Modal title="Review Submission" icon="rate_review" onClose={onClose} size="wide"
            footer={
                <div className="modal-confirm-actions flex-wrap-gap-3" style={{ width: '100%' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-outline btn-destructive-outline"
                        onClick={() => { onReject(result.id); onClose() }}>
                        <span className="material-symbols-rounded icon-sm">cancel</span> Reject
                    </button>
                    <button className="btn btn-primary" onClick={() => { onApprove(result.id); onClose() }}>
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
                            { label:'Students', value: result.students },
                            { label:'Average',  value: result.avg      },
                            { label:'Highest',  value: result.highest  },
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
                            { label:'Total Students', value: result.students, color:'var(--primary)'     },
                            { label:'Class Average',  value: result.avg,      color:'var(--success)'     },
                            { label:'Highest Score',  value: result.highest,  color:'var(--success)'     },
                            { label:'Lowest Score',   value: result.lowest,   color:'var(--destructive)' },
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
                            <button className="btn btn-primary btn-sm" style={{ marginTop:'0.25rem' }}>
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
                                    {['#','Student ID','Name','Score','Grade'].map(h => (
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
                                            <span style={{ fontWeight:700, fontSize:'0.82rem', padding:'2px 10px', borderRadius:20, background:`${gradeColor(s.grade)}18`, color:gradeColor(s.grade) }}>{s.grade}</span>
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
    const passCount   = Math.round(result.students * 0.88)
    const failCount   = result.students - passCount
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
                    { label: 'Total Students', value: result.students, color: 'var(--primary)'     },
                    { label: 'Class Average',  value: result.avg,      color: 'var(--success)'     },
                    { label: 'Highest Score',  value: result.highest,  color: 'var(--success)'     },
                    { label: 'Lowest Score',   value: result.lowest,   color: 'var(--destructive)' },
                    { label: 'Passed',         value: passCount,       color: 'var(--success)'     },
                    { label: 'Failed',         value: failCount,       color: 'var(--destructive)' },
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
    const [activeTab,   setActiveTab]   = useState('approval')
    const [statusFilter,setStatusFilter]= useState('all')
    const [search,      setSearch]      = useState('')
    const [results,     setResults]     = useState(allResults)
    const [reviewing,   setReviewing]   = useState(null)
    const [viewing,     setViewing]     = useState(null)
    const [activeTerm,  setActiveTerm]  = useState('Term 2')

    function handleApprove(id) {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r))
    }
    function handleReject(id) {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r))
    }

    const statusTabsWithCount = STATUS_TABS.map(t => ({
        ...t,
        count: t.key === 'all' ? undefined : results.filter(r => r.status === t.key).length,
    }))

    const visible = results.filter(r => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false
        if (search && !`${r.title} ${r.submittedBy}`.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Results" subtitle="Approval queue and school performance analytics — Term 2, 2026" {...dosUser} />

                    <DashboardContent>

                        {/* Main tab switcher */}
                        <div className="flex-wrap-gap-3">
                            {[
                                { key: 'approval',   icon: 'pending',   label: 'Approval Queue', badge: results.filter(r => r.status === 'pending').length },
                                { key: 'analytics',  icon: 'bar_chart', label: 'Analytics'       },
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
                            const d = ANALYTICS_DATA[activeTerm]
                            const tooltipStyle = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.82rem' }
                            return (
                                <>
                                    <div className="portal-stat-grid">
                                        {analyticsStats.map((s, i) => <StatCard key={i} {...s} />)}
                                    </div>

                                    {/* Term selector */}
                                    <div className="flex-row-gap-sm" style={{ flexWrap: 'wrap' }}>
                                        <span className="settings-info-text fw-600">Viewing:</span>
                                        {['Term 1', 'Term 2', 'Term 3'].map(t => (
                                            <button key={t}
                                                className={`btn btn-sm ${activeTerm === t ? 'btn-primary' : 'btn-outline'}`}
                                                onClick={() => setActiveTerm(t)}
                                            >{t}</button>
                                        ))}
                                    </div>

                                    {/* Row 1: Grade dist donut + Attendance area */}
                                    <div className="analytics-chart-grid">

                                        {/* Grade Distribution Donut */}
                                        <div className="card">
                                            <div className="card-header">
                                                <h3 className="card-title">Grade Distribution</h3>
                                                <span className="settings-info-text">{activeTerm}</span>
                                            </div>
                                            <div className="card-content">
                                                <ResponsiveContainer width="100%" height={240}>
                                                    <PieChart>
                                                        <Pie data={d.gradeDist} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                                                            dataKey="value" paddingAngle={3}
                                                        >
                                                            {d.gradeDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
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
                                                <span className="settings-info-text">{activeTerm}</span>
                                            </div>
                                            <div className="card-content">
                                                <ResponsiveContainer width="100%" height={240}>
                                                    <AreaChart data={d.attendance} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="attGrad2" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
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
                                            <span className="settings-info-text">{activeTerm} · % of students</span>
                                        </div>
                                        <div className="card-content">
                                            <ResponsiveContainer width="100%" height={220}>
                                                <BarChart data={d.passFail} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                    <XAxis dataKey="class" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                                                    <Tooltip formatter={(v, n) => [`${v}%`, n]} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: '0.78rem' }} />
                                                    <Bar dataKey="pass" name="Passed" stackId="a" fill="#10b981" radius={[0,0,0,0]} maxBarSize={40} />
                                                    <Bar dataKey="fail" name="Failed" stackId="a" fill="#ef4444" radius={[4,4,0,0]} maxBarSize={40} />
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
                                                        <Bar dataKey="submitted" name="Submitted" stackId="b" fill="#003d7a" radius={[0,0,0,0]} maxBarSize={18} />
                                                        <Bar dataKey="pending"   name="Pending"   stackId="b" fill="#f59e0b" radius={[0,4,4,0]} maxBarSize={18} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Performance by Grade */}
                                        <div className="card">
                                            <div className="card-header">
                                                <h3 className="card-title">Performance by Grade</h3>
                                                <span className="settings-info-text">{activeTerm}</span>
                                            </div>
                                            <div className="card-content">
                                                <ResponsiveContainer width="100%" height={240}>
                                                    <BarChart data={d.gradePerf} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 4 }}>
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                                                        <XAxis type="number" domain={[50, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                                                        <YAxis type="category" dataKey="grade" tick={{ fontSize: 12, fontWeight: 600, fill: 'var(--foreground)' }} axisLine={false} tickLine={false} width={28} />
                                                        <Tooltip formatter={v => [`${v}%`, 'Average']} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                                        <Bar dataKey="score" radius={[0,6,6,0]} maxBarSize={20}>
                                                            {d.gradePerf.map((e, i) => <Cell key={i} fill={e.score >= 80 ? '#10b981' : e.score >= 70 ? '#003d7a' : '#f59e0b'} />)}
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
                                            <span className="settings-info-text">{activeTerm}</span>
                                        </div>
                                        <div className="card-content">
                                            <ResponsiveContainer width="100%" height={240}>
                                                <BarChart data={d.subjectPerf} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                                                    <XAxis type="number" domain={[50, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                                                    <YAxis type="category" dataKey="subject" tick={{ fontSize: 11, fontWeight: 600, fill: 'var(--foreground)' }} axisLine={false} tickLine={false} width={78} />
                                                    <Tooltip formatter={v => [`${v}%`, 'Average']} contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                                    <Bar dataKey="score" radius={[0,6,6,0]} maxBarSize={20}>
                                                        {d.subjectPerf.map((e, i) => <Cell key={i} fill={e.score >= 78 ? '#10b981' : '#f59e0b'} />)}
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
