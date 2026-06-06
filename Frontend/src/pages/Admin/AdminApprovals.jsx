import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import { getPendingResults, approveResult, rejectResult, bulkApproveResults } from '../../api/admin'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import '../../styles/tables.css'
import '../../styles/discipline.css'

const STATUS_TABS = ['pending', 'approved', 'rejected']

function gradeColor(grade) {
    if (!grade) return 'var(--muted-foreground)'
    const g = grade.toUpperCase()
    if (g === 'A' || g === 'A+') return '#16a34a'
    if (g === 'B')               return '#2563eb'
    if (g === 'C')               return '#ca8a04'
    return '#dc2626'
}

function RejectModal({ result, onClose, onDone }) {
    const [reason,  setReason]  = useState('')
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState('')

    const studentName = result.student_name || result.student?.name ||
        `${result.student?.first_name || ''} ${result.student?.last_name || ''}`.trim() || 'Student'
    const subject = result.subject_name || result.subject?.name || '—'

    async function handleSubmit(e) {
        e.preventDefault()
        if (!reason.trim()) { setError('Rejection reason is required.'); return }
        setLoading(true)
        try {
            await rejectResult(result.id, { rejection_reason: reason })
            onDone()
            onClose()
        } catch {
            setError('Failed to reject. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Reject Result</h2>
                    <button className="modal-close" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>
                <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
                        Rejecting <strong>{subject}</strong> result for <strong>{studentName}</strong>. Provide a reason for the teacher.
                    </p>
                    <div className="form-group form-group-0">
                        <label className="form-label">Rejection Reason *</label>
                        <textarea
                            className="form-input"
                            rows={3}
                            value={reason}
                            onChange={e => { setReason(e.target.value); setError('') }}
                            placeholder="e.g. Scores do not match the class assessment sheet…"
                            autoFocus
                        />
                    </div>
                    {error && <p style={{ color: 'var(--destructive)', fontSize: '0.82rem' }}>{error}</p>}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ background: 'var(--destructive)', borderColor: 'var(--destructive)' }}>
                            <span className="material-symbols-rounded">cancel</span>
                            {loading ? 'Rejecting…' : 'Reject Result'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function ResultRow({ result, selected, onSelect, onApprove, onReject, status }) {
    const studentName = result.student_name || result.student?.name ||
        `${result.student?.first_name || ''} ${result.student?.last_name || ''}`.trim() || '—'
    const subject     = result.subject_name || result.subject?.name || '—'
    const teacher     = result.teacher_name || result.submitted_by?.name ||
        `${result.submitted_by?.first_name || ''} ${result.submitted_by?.last_name || ''}`.trim() || '—'
    const score       = result.total_score ?? result.score ?? result.final_score ?? '—'
    const grade       = result.letter_grade || result.grade_letter || '—'
    const cls         = result.grade ? `S${result.grade}${result.section || ''}` : (result.class_name || '—')

    return (
        <tr>
            {status === 'pending' && (
                <td style={{ width: 36 }}>
                    <input type="checkbox" checked={selected} onChange={e => onSelect(result.id, e.target.checked)} style={{ cursor: 'pointer' }} />
                </td>
            )}
            <td>
                <div className="adm-name">{studentName}</div>
                <div className="adm-sub">{cls}</div>
            </td>
            <td>{subject}</td>
            <td style={{ fontWeight: 600 }}>{score}{score !== '—' ? '%' : ''}</td>
            <td>
                <span style={{ fontWeight: 700, color: gradeColor(grade) }}>{grade}</span>
            </td>
            <td style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{teacher}</td>
            <td style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                {result.submitted_at ? new Date(result.submitted_at).toLocaleDateString() : '—'}
            </td>
            {status === 'pending' && (
                <td>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button className="adm-btn" style={{ color: 'var(--success, #16a34a)' }} title="Approve" onClick={() => onApprove(result.id)}>
                            <span className="material-symbols-rounded">check_circle</span>
                        </button>
                        <button className="adm-btn" style={{ color: 'var(--destructive)' }} title="Reject" onClick={() => onReject(result)}>
                            <span className="material-symbols-rounded">cancel</span>
                        </button>
                    </div>
                </td>
            )}
            {status !== 'pending' && (
                <td>
                    <span className={`adm-badge ${status === 'approved' ? 'active' : 'inactive'}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </td>
            )}
        </tr>
    )
}

export function AdminApprovals() {
    const { config }    = useSchoolConfig()
    const [activeTab,   setActiveTab]   = useState('pending')
    const [allResults,  setAllResults]  = useState([])
    const [loading,     setLoading]     = useState(true)
    const [selected,    setSelected]    = useState(new Set())
    const [rejectItem,  setRejectItem]  = useState(null)
    const [bulkLoading, setBulkLoading] = useState(false)
    const [counts,      setCounts]      = useState({ pending: 0, approved: 0, rejected: 0 })
    const [section,     setSection]     = useState('')
    const [year,        setYear]        = useState('')
    const [classVal,    setClassVal]    = useState('')

    function load(tab, yr) {
        setLoading(true)
        setSelected(new Set())
        const gradeNum = (yr ?? year) ? (yr ?? year).replace('S', '') : undefined
        getPendingResults({ status: tab, ...(gradeNum ? { grade: gradeNum } : {}) })
            .then(data => setAllResults(Array.isArray(data) ? data : (data?.results ?? [])))
            .catch(() => setAllResults([]))
            .finally(() => setLoading(false))
    }

    function loadCounts() {
        Promise.all(
            STATUS_TABS.map(s => getPendingResults({ status: s }).catch(() => ({ count: 0 })))
        ).then(([p, a, r]) => {
            setCounts({
                pending:  p?.count ?? (Array.isArray(p) ? p.length : 0),
                approved: a?.count ?? (Array.isArray(a) ? a.length : 0),
                rejected: r?.count ?? (Array.isArray(r) ? r.length : 0),
            })
        })
    }

    useEffect(() => { load(activeTab); loadCounts() }, [])

    function switchTab(tab) {
        setActiveTab(tab)
        load(tab, year)
    }

    function handleSelect(id, checked) {
        setSelected(prev => {
            const next = new Set(prev)
            checked ? next.add(id) : next.delete(id)
            return next
        })
    }

    function handleSelectAll(checked) {
        setSelected(checked ? new Set(results.map(r => r.id)) : new Set())
    }

    async function handleApprove(id) {
        try {
            await approveResult(id, {})
            load(activeTab, year)
            loadCounts()
        } catch {}
    }

    async function handleBulkApprove() {
        if (selected.size === 0) return
        setBulkLoading(true)
        try {
            await bulkApproveResults([...selected])
            load(activeTab, year)
            loadCounts()
        } catch {} finally {
            setBulkLoading(false)
        }
    }

    function handleRejectDone() {
        load(activeTab, year)
        loadCounts()
    }

    const statCards = [
        { icon: 'pending_actions', value: counts.pending,  label: 'Pending',  trend: 'Awaiting review', colorClass: 'warning' },
        { icon: 'check_circle',    value: counts.approved, label: 'Approved', trend: 'All time',        colorClass: 'success' },
        { icon: 'cancel',          value: counts.rejected, label: 'Rejected', trend: 'All time',        colorClass: ''        },
        { icon: 'assignment',      value: counts.pending + counts.approved + counts.rejected, label: 'Total',  trend: 'All submissions', colorClass: 'info' },
    ]

    const results = classVal
        ? allResults.filter(r => (r.section || r.student?.section || '').toUpperCase() === classVal.toUpperCase())
        : allResults

    const allSelected = results.length > 0 && selected.size === results.length

    const cols = activeTab === 'pending'
        ? ['', 'Student', 'Subject', 'Score', 'Grade', 'Submitted By', 'Date', 'Actions']
        : ['Student', 'Subject', 'Score', 'Grade', 'Submitted By', 'Date', 'Status']

    return (
        <>
            {rejectItem && (
                <RejectModal
                    result={rejectItem}
                    onClose={() => setRejectItem(null)}
                    onDone={handleRejectDone}
                />
            )}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Result Approvals"
                        subtitle="Review and approve exam results submitted by teachers"
                        {...adminUser}
                    />
                    <DashboardContent>

                        <div className="portal-stat-grid">
                            {statCards.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        {/* Status tabs */}
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                {STATUS_TABS.map(tab => (
                                    <button
                                        key={tab}
                                        className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => switchTab(tab)}
                                    >
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        {tab === 'pending' && counts.pending > 0 && (
                                            <span style={{ marginLeft: '0.35rem', background: '#f59e0b', color: '#fff', borderRadius: '999px', padding: '0 0.4rem', fontSize: '0.68rem', fontWeight: 700 }}>
                                                {counts.pending}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {activeTab === 'pending' && selected.size > 0 && (
                                <button className="btn btn-primary btn-sm" onClick={handleBulkApprove} disabled={bulkLoading}>
                                    <span className="material-symbols-rounded">done_all</span>
                                    {bulkLoading ? 'Approving…' : `Approve Selected (${selected.size})`}
                                </button>
                            )}
                        </div>

                        {/* Class picker */}
                        <ClassPicker
                            sections={config}
                            section={section}
                            onSectionChange={s => { setSection(s); setYear(''); setClassVal(''); load(activeTab, '') }}
                            year={year}
                            onYearChange={y => { setYear(y); setClassVal(''); load(activeTab, y) }}
                            classVal={classVal}
                            onClassChange={setClassVal}
                        />

                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">
                                    {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Results
                                </h2>
                                {!loading && <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{results.length} record{results.length !== 1 ? 's' : ''}</span>}
                            </div>
                            <div className="card-content" style={{ padding: 0 }}>
                                {loading ? (
                                    <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading…</p>
                                ) : results.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted-foreground)' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>
                                            {activeTab === 'pending' ? 'pending_actions' : activeTab === 'approved' ? 'check_circle' : 'cancel'}
                                        </span>
                                        No {activeTab} results.
                                    </div>
                                ) : (
                                    <div className="adm-table-wrap">
                                        <table className="adm-table">
                                            <thead>
                                                <tr>
                                                    {activeTab === 'pending' && (
                                                        <th style={{ width: 36 }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={allSelected}
                                                                onChange={e => handleSelectAll(e.target.checked)}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        </th>
                                                    )}
                                                    {cols.filter(c => c !== '').map(col => <th key={col}>{col}</th>)}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {results.map(r => (
                                                    <ResultRow
                                                        key={r.id}
                                                        result={r}
                                                        status={activeTab}
                                                        selected={selected.has(r.id)}
                                                        onSelect={handleSelect}
                                                        onApprove={handleApprove}
                                                        onReject={setRejectItem}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
