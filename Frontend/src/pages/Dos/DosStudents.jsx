import { useState, useEffect } from 'react'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { dosUser } from './dosNav'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { yearsFromConfig } from '../../utils/classes'
import { Sidebar } from '../../components/layout/Sidebar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { DataTable } from '../../components/ui/DataTable'
import { StatCard } from '../../components/layout/StatCard'
import { Modal } from '../../components/ui/Modal'
import { getDosStudents, getDosStudentStats, inviteDosStudent, bulkInviteDosStudents } from '../../api/dos'
import { getInvitations, resendInvitation, cancelInvitation } from '../../api/auth'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import '../../styles/tables.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#003d7a','#10b981','#f59e0b','#6366f1','#ef4444','#0891b2','#7c3aed','#be185d']
function avatarColor(name) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] }
function initials(name) { return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() }
function daysAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return '1 day ago'
    return `${diff} days ago`
}

const gradeMap = { '1':'S1','2':'S2','3':'S3','4':'S4','5':'S5','6':'S6' }
const standMap = (p) => p >= 80 ? ['dos-stand-excellent','Excellent'] : p >= 60 ? ['dos-stand-good','Good'] : ['dos-stand-concern','Concern']

function apiToStudent(s) {
    const [standClass, standing] = standMap(s.avg_performance ?? 0)
    return {
        initials:    s.initials,
        name:        s.full_name,
        adm:         s.student_code,
        year:        gradeMap[s.grade] || s.grade,
        classLetter: s.section,
        house:       '—',
        t1:          '—',
        t2:          '—',
        curr:        s.avg_performance != null ? `${s.avg_performance}%` : 'N/A',
        standClass,
        standing,
    }
}

// ── Student Row ───────────────────────────────────────────────────────────────
function StudentRow({ initials, name, adm, house, t1, t2, curr, standClass, standing }) {
    return (
        <tr>
            <td><div className="tm-teacher-cell"><div className="tm-av">{initials}</div><span>{name}</span></div></td>
            <td>{adm}</td><td>{house}</td><td>{t1}</td><td>{t2}</td><td>{curr}</td>
            <td><span className={standClass}>{standing}</span></td>
            <td><button className="tm-btn">View</button></td>
        </tr>
    )
}

// ── CSV helpers ───────────────────────────────────────────────────────────────
function parseCSV(text) {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    return lines.slice(1).map((line, i) => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row = {}
        headers.forEach((h, j) => { row[h] = values[j] || '' })
        row._rowNum = i + 2
        return row
    })
}

function downloadTemplate() {
    const header  = 'student_first_name,student_last_name,student_email,year,stream,parent_first_name,parent_last_name,parent_email,parent_phone'
    const example = 'Amina,Uwase,amina@example.com,S1,A,Chantal,Uwase,chantal@example.com,+250700000001'
    const blob = new Blob([header + '\n' + example], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'student_invite_template.csv'; a.click()
    URL.revokeObjectURL(url)
}

// ── Invite Student Modal ──────────────────────────────────────────────────────
function InviteStudentModal({ onClose, onInvite, onBulkInvite, admitYears, admitStreams }) {
    const [tab,     setTab]     = useState('single')   // 'single' | 'bulk'

    // single tab
    const [student, setStudent] = useState({
        first_name: '', last_name: '', email: '',
        year: admitYears[0] || '', stream: admitStreams[0] || ''
    })
    const [parent,  setParent]  = useState({ first_name: '', last_name: '', email: '', phone_number: '' })
    const [sending, setSending] = useState(false)
    const [sent,    setSent]    = useState(false)
    const [error,   setError]   = useState('')

    // bulk tab
    const [file,        setFile]        = useState(null)
    const [preview,     setPreview]     = useState([])
    const [bulkSending, setBulkSending] = useState(false)
    const [bulkResult,  setBulkResult]  = useState(null)  // {created, failed, errors}

    const studentValid = student.first_name.trim() && student.last_name.trim() && student.email.trim() && student.year && student.stream
    const parentValid  = parent.first_name.trim() && parent.last_name.trim() && (parent.email.trim() || parent.phone_number.trim())
    const isValid      = studentValid && parentValid

    async function handleSingleSend() {
        setSending(true); setError('')
        try {
            await onInvite({ student, parent })
            setSent(true)
        } catch (err) {
            setError(err.message || 'Failed to send invitations')
        } finally { setSending(false) }
    }

    function handleFileChange(e) {
        const f = e.target.files[0]
        if (!f) return
        setFile(f)
        setBulkResult(null)
        const reader = new FileReader()
        reader.onload = (ev) => setPreview(parseCSV(ev.target.result).slice(0, 5))
        reader.readAsText(f)
    }

    async function handleBulkSend() {
        if (!file) return
        setBulkSending(true)
        try {
            const result = await onBulkInvite(file)
            setBulkResult(result)
        } catch (err) {
            setBulkResult({ created: 0, failed: 0, errors: [{ row: '?', error: err.message || 'Upload failed' }] })
        } finally { setBulkSending(false) }
    }

    if (sent) return (
        <Modal title="Invitations Sent" icon="mark_email_read" onClose={onClose}
            footer={<div className="modal-confirm-actions" style={{ width: '100%' }}><button className="btn btn-primary" onClick={onClose}>Done</button></div>}>
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '3.5rem', color: 'var(--success)' }}>check_circle</span>
                <p style={{ marginTop: '1rem', fontWeight: 600, fontSize: '1.05rem' }}>Invitations sent successfully</p>
                <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    {student.first_name} will receive a link to create their student account.<br />
                    {parent.first_name} will receive a link to set up their parent account.
                </p>
            </div>
        </Modal>
    )

    const tabStyle = (t) => ({
        padding: '0.5rem 1.25rem', border: 'none', background: 'none', cursor: 'pointer',
        fontWeight: 600, fontSize: '0.875rem', borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
        color: tab === t ? 'var(--primary)' : 'var(--muted)',
    })

    return (
        <Modal title="Invite Student" icon="person_add" onClose={onClose} size="wide"
            footer={
                <div className="modal-confirm-actions" style={{ width: '100%' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    {tab === 'single'
                        ? <button className="btn btn-primary" disabled={!isValid || sending} onClick={handleSingleSend}>
                            <span className="material-symbols-rounded icon-sm">send</span>
                            {sending ? 'Sending...' : 'Send Invitations'}
                          </button>
                        : <button className="btn btn-primary" disabled={!file || bulkSending || !!bulkResult} onClick={handleBulkSend}>
                            <span className="material-symbols-rounded icon-sm">upload_file</span>
                            {bulkSending ? 'Sending...' : 'Send All Invitations'}
                          </button>
                    }
                </div>
            }
        >
            {/* Tab switcher */}
            <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:'1.25rem', gap:'0.25rem' }}>
                <button style={tabStyle('single')} onClick={() => setTab('single')}>Single Student</button>
                <button style={tabStyle('bulk')}   onClick={() => setTab('bulk')}>Bulk Upload (CSV)</button>
            </div>

            {/* ── Single tab ── */}
            {tab === 'single' && <>
                <div style={{ display:'flex', alignItems:'flex-start', gap:'0.75rem', padding:'0.75rem 1rem', background:'var(--muted)', borderRadius:'0.5rem', marginBottom:'1.25rem' }}>
                    <span className="material-symbols-rounded" style={{ color:'var(--primary)', fontSize:'1.25rem', flexShrink:0 }}>info</span>
                    <p style={{ fontSize:'0.875rem', color:'var(--muted-foreground)', margin:0 }}>
                        Two invitation emails will be sent — one for the student to create their account, and one for the parent/guardian.
                    </p>
                </div>

                <p className="teacher-modal-section-label">Student Details</p>
                <div className="settings-form">
                    <div className="resp-grid-2" style={{ gap:'0.75rem' }}>
                        <div className="form-group">
                            <label className="form-label">First Name *</label>
                            <input className="form-control" placeholder="e.g. Amina" autoFocus
                                value={student.first_name} onChange={e => setStudent(p => ({ ...p, first_name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Last Name *</label>
                            <input className="form-control" placeholder="e.g. Uwase"
                                value={student.last_name} onChange={e => setStudent(p => ({ ...p, last_name: e.target.value }))} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email Address *</label>
                        <input className="form-control" type="email" placeholder="student@example.com"
                            value={student.email} onChange={e => setStudent(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div className="resp-grid-2" style={{ gap:'0.75rem' }}>
                        <div className="form-group">
                            <label className="form-label">Year *</label>
                            <select className="form-control" value={student.year} onChange={e => setStudent(p => ({ ...p, year: e.target.value }))}>
                                {admitYears.map(y => <option key={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Stream *</label>
                            <select className="form-control" value={student.stream} onChange={e => setStudent(p => ({ ...p, stream: e.target.value }))}>
                                {admitStreams.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <hr style={{ margin:'1.25rem 0', borderColor:'var(--border)' }} />

                <p className="teacher-modal-section-label">Parent / Guardian Details</p>
                <div className="settings-form">
                    <div className="resp-grid-2" style={{ gap:'0.75rem' }}>
                        <div className="form-group">
                            <label className="form-label">First Name *</label>
                            <input className="form-control" placeholder="e.g. Chantal"
                                value={parent.first_name} onChange={e => setParent(p => ({ ...p, first_name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Last Name *</label>
                            <input className="form-control" placeholder="e.g. Uwase"
                                value={parent.last_name} onChange={e => setParent(p => ({ ...p, last_name: e.target.value }))} />
                        </div>
                    </div>
                    <div className="resp-grid-2" style={{ gap:'0.75rem' }}>
                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <input className="form-control" type="email" placeholder="parent@example.com"
                                value={parent.email} onChange={e => setParent(p => ({ ...p, email: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone Number</label>
                            <input className="form-control" placeholder="+250 7XX XXX XXX"
                                value={parent.phone_number} onChange={e => setParent(p => ({ ...p, phone_number: e.target.value }))} />
                        </div>
                    </div>
                    <p style={{ fontSize:'0.8rem', color:'var(--muted)', marginTop:'-0.25rem' }}>
                        At least one of email or phone is required for the parent.
                    </p>
                </div>

                {error && <p style={{ color:'var(--danger)', marginTop:'0.75rem', fontSize:'0.875rem' }}>{error}</p>}
            </>}

            {/* ── Bulk tab ── */}
            {tab === 'bulk' && <>
                {/* Step 1 – download template */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.875rem 1rem', background:'var(--surface-2,#f8f9fa)', borderRadius:'0.5rem', marginBottom:'1rem' }}>
                    <div>
                        <p style={{ margin:0, fontWeight:600, fontSize:'0.9rem' }}>Step 1 — Download the template</p>
                        <p style={{ margin:0, fontSize:'0.8rem', color:'var(--muted)' }}>Fill in student and parent details, one row per student.</p>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={downloadTemplate}>
                        <span className="material-symbols-rounded icon-sm">download</span> Template
                    </button>
                </div>

                {/* Step 2 – upload CSV */}
                <p style={{ fontWeight:600, fontSize:'0.9rem', marginBottom:'0.5rem' }}>Step 2 — Upload completed CSV</p>
                <label style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.875rem 1rem', border:'2px dashed var(--border)', borderRadius:'0.5rem', cursor:'pointer', marginBottom:'1rem' }}>
                    <span className="material-symbols-rounded" style={{ color:'var(--primary)', fontSize:'1.5rem' }}>upload_file</span>
                    <span style={{ fontSize:'0.875rem', color: file ? 'var(--foreground)' : 'var(--muted)' }}>
                        {file ? file.name : 'Click to choose a CSV file…'}
                    </span>
                    <input type="file" accept=".csv" style={{ display:'none' }} onChange={handleFileChange} />
                </label>

                {/* Preview */}
                {preview.length > 0 && !bulkResult && (
                    <div style={{ marginBottom:'1rem' }}>
                        <p style={{ fontWeight:600, fontSize:'0.85rem', marginBottom:'0.4rem', color:'var(--muted)' }}>
                            Preview (first {preview.length} rows)
                        </p>
                        <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:'0.5rem' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8rem' }}>
                                <thead>
                                    <tr style={{ background:'var(--surface-2,#f8f9fa)', color:'var(--muted)', textTransform:'uppercase', fontSize:'0.72rem', letterSpacing:'0.04em' }}>
                                        <th style={{ padding:'0.4rem 0.75rem', textAlign:'left' }}>Student</th>
                                        <th style={{ padding:'0.4rem 0.75rem', textAlign:'left' }}>Email</th>
                                        <th style={{ padding:'0.4rem 0.75rem', textAlign:'left' }}>Year/Stream</th>
                                        <th style={{ padding:'0.4rem 0.75rem', textAlign:'left' }}>Parent</th>
                                        <th style={{ padding:'0.4rem 0.75rem', textAlign:'left' }}>Parent Contact</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.map((row, i) => (
                                        <tr key={i} style={{ borderTop:'1px solid var(--border)' }}>
                                            <td style={{ padding:'0.4rem 0.75rem' }}>{row.student_first_name} {row.student_last_name}</td>
                                            <td style={{ padding:'0.4rem 0.75rem', color:'var(--muted)' }}>{row.student_email}</td>
                                            <td style={{ padding:'0.4rem 0.75rem' }}>{row.year}{row.stream}</td>
                                            <td style={{ padding:'0.4rem 0.75rem' }}>{row.parent_first_name} {row.parent_last_name}</td>
                                            <td style={{ padding:'0.4rem 0.75rem', color:'var(--muted)' }}>{row.parent_email || row.parent_phone || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Results after upload */}
                {bulkResult && (
                    <div style={{ padding:'1rem', background: bulkResult.created > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderRadius:'0.5rem', border:`1px solid ${bulkResult.created > 0 ? 'var(--success)' : 'var(--danger)'}` }}>
                        <p style={{ margin:'0 0 0.5rem', fontWeight:700, fontSize:'0.95rem', color: bulkResult.created > 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {bulkResult.created > 0 ? `${bulkResult.created} student${bulkResult.created > 1 ? 's' : ''} invited successfully` : 'No invitations sent'}
                            {bulkResult.failed > 0 && ` — ${bulkResult.failed} row${bulkResult.failed > 1 ? 's' : ''} failed`}
                        </p>
                        {bulkResult.errors.length > 0 && (
                            <ul style={{ margin:0, padding:'0 0 0 1.25rem', fontSize:'0.8rem', color:'var(--danger)' }}>
                                {bulkResult.errors.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
                            </ul>
                        )}
                    </div>
                )}
            </>}
        </Modal>
    )
}

// ── Pending Student Invitations Card ──────────────────────────────────────────
const INV_TABS = [
    { key: 'all',        label: 'All'        },
    { key: 'pending',    label: 'Pending'    },
    { key: 'registered', label: 'Registered' },
    { key: 'expired',    label: 'Expired'    },
]

function InvitationHistory({ invitations, onResend, onCancel }) {
    const [resending,  setResending]  = useState(null)
    const [cancelling, setCancelling] = useState(null)
    const [filter,     setFilter]     = useState('all')

    if (invitations.length === 0) return null

    async function doResend(id) {
        setResending(id)
        try { await onResend(id) } finally { setResending(null) }
    }
    async function doCancel(id) {
        setCancelling(id)
        try { await onCancel(id) } finally { setCancelling(null) }
    }

    const registered = invitations.filter(inv =>  inv.is_used)
    const expired    = invitations.filter(inv => !inv.is_used &&  inv.is_expired)
    const pending    = invitations.filter(inv => !inv.is_used && !inv.is_expired)

    const counts = { all: invitations.length, pending: pending.length, registered: registered.length, expired: expired.length }

    const visible = filter === 'registered' ? registered
                  : filter === 'expired'    ? expired
                  : filter === 'pending'    ? pending
                  : invitations

    return (
        <div className="card" style={{ marginBottom: '1.25rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>mark_email_read</span>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Student Invitation History</span>
                <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '999px', fontSize: '0.72rem', padding: '0.1rem 0.55rem', fontWeight: 700 }}>
                    {invitations.length}
                </span>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface-2,#f8f9fa)' }}>
                {INV_TABS.map(tab => (
                    <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
                        padding: '0.5rem 1.1rem', fontSize: '0.82rem', background: 'none', border: 'none',
                        borderBottom: filter === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                        fontWeight: filter === tab.key ? 700 : 400,
                        color: filter === tab.key ? 'var(--primary)' : 'var(--muted)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
                    }}>
                        {tab.label}
                        {counts[tab.key] > 0 && (
                            <span style={{
                                background: filter === tab.key ? 'var(--primary)' : 'var(--border)',
                                color: filter === tab.key ? '#fff' : 'var(--muted)',
                                borderRadius: '999px', fontSize: '0.68rem', padding: '0.05rem 0.45rem', fontWeight: 700,
                            }}>{counts[tab.key]}</span>
                        )}
                    </button>
                ))}
            </div>

            {visible.length === 0 ? (
                <div style={{ padding: '1.5rem', color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center' }}>
                    No {filter === 'all' ? '' : filter} invitations
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ fontSize: '0.78rem', color: 'var(--muted)', background: 'var(--surface-2,#f8f9fa)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            <th style={{ padding: '0.55rem 1.25rem', textAlign: 'left', fontWeight: 600 }}>Student</th>
                            <th style={{ padding: '0.55rem 1rem',    textAlign: 'left', fontWeight: 600 }}>Email</th>
                            <th style={{ padding: '0.55rem 1rem',    textAlign: 'left', fontWeight: 600 }}>Class</th>
                            <th style={{ padding: '0.55rem 1rem',    textAlign: 'left', fontWeight: 600 }}>Status</th>
                            <th style={{ padding: '0.55rem 1rem',    textAlign: 'left', fontWeight: 600 }}>Invited</th>
                            <th style={{ padding: '0.55rem 1rem',    textAlign: 'left', fontWeight: 600 }}>Expires</th>
                            <th style={{ padding: '0.55rem 1.25rem', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map(inv => {
                            const fullName = `${inv.first_name} ${inv.last_name}`
                            let statusEl
                            if (inv.is_used) {
                                statusEl = (
                                    <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: '0.95rem' }}>check_circle</span>Registered
                                    </span>
                                )
                            } else if (inv.is_expired) {
                                statusEl = <span style={{ color: 'var(--danger)',  fontWeight: 600, fontSize: '0.8rem' }}>Expired</span>
                            } else if (inv.delivery_status === 'sent') {
                                statusEl = <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '0.8rem' }}>Pending</span>
                            } else {
                                statusEl = <span style={{ color: 'var(--danger)',  fontWeight: 600, fontSize: '0.8rem' }}>Failed</span>
                            }

                            return (
                                <tr key={inv.id} style={{ borderTop: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.75rem 1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div className="dt-avatar" style={{ background: avatarColor(fullName) }}>{initials(fullName)}</div>
                                            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{fullName}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.875rem' }}>{inv.email || '—'}</td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.875rem' }}>{inv.class_obj_name || '—'}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>{statusEl}</td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.8rem' }}>{daysAgo(inv.created_at)}</td>
                                    <td style={{ padding: '0.75rem 1rem', color: inv.is_expired && !inv.is_used ? 'var(--danger)' : 'var(--muted)', fontSize: '0.8rem' }}>
                                        {inv.is_used ? '—' : new Date(inv.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td style={{ padding: '0.75rem 1.25rem' }}>
                                        {!inv.is_used && (
                                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                                <button className="btn btn-outline btn-sm" disabled={resending === inv.id} onClick={() => doResend(inv.id)}>
                                                    <span className="material-symbols-rounded icon-sm">send</span>
                                                    {resending === inv.id ? 'Sending…' : 'Resend'}
                                                </button>
                                                <button className="btn btn-sm"
                                                    style={{ color: 'var(--danger)', border: '1px solid var(--danger)', background: 'transparent' }}
                                                    disabled={cancelling === inv.id} onClick={() => doCancel(inv.id)}>
                                                    <span className="material-symbols-rounded icon-sm">cancel</span>
                                                    {cancelling === inv.id ? '…' : 'Cancel'}
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            )}
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function DosStudents() {
    const { config }  = useSchoolConfig()
    const admitYears  = yearsFromConfig(config)
    const admitStreams = [...new Set(config.flatMap(s => s.years.flatMap(y => y.streams)))]

    const [students,    setStudents]    = useState([])
    const [apiStats,    setApiStats]    = useState(null)
    const [loading,     setLoading]     = useState(true)
    const [error,       setError]       = useState(null)
    const [section,     setSection]     = useState('')
    const [year,        setYear]        = useState('')
    const [classVal,    setClassVal]    = useState('')
    const [search,      setSearch]      = useState('')
    const [inviteOpen,  setInviteOpen]  = useState(false)
    const [invitations, setInvitations] = useState([])

    useEffect(() => {
        Promise.all([getDosStudents(), getDosStudentStats(), getInvitations()])
            .then(([list, stats, invList]) => {
                setStudents((list.results ?? list).map(apiToStudent))
                setApiStats(stats)
                const arr = Array.isArray(invList) ? invList : (invList?.results ?? [])
                setInvitations(arr.filter(inv => inv.role === 'student'))
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    const studentStats = apiStats ? [
        { icon: 'people',       value: apiStats.total_students,        label: 'Total Students',  trend: `+${apiStats.new_this_term} this term`,            trendClass: 'positive', colorClass: 'info'    },
        { icon: 'check_circle', value: apiStats.active_students,       label: 'Active Students', trend: `${apiStats.enrollment_pct}% enrollment`,           trendClass: 'positive', colorClass: 'success' },
        { icon: 'person_add',   value: apiStats.new_admissions,        label: 'New Admissions',  trend: 'This term',                                        trendClass: '',         colorClass: 'warning' },
        { icon: 'trending_up',  value: `${apiStats.avg_performance}%`, label: 'Avg Performance', trend: `+${apiStats.avg_performance_change}% improvement`, trendClass: 'positive', colorClass: 'success' },
    ] : []

    async function handleInvite(data) {
        await inviteDosStudent(data)
        const invList = await getInvitations()
        const arr = Array.isArray(invList) ? invList : (invList?.results ?? [])
        setInvitations(arr.filter(inv => inv.role === 'student'))
    }

    async function handleBulkInvite(file) {
        const result = await bulkInviteDosStudents(file)
        if (result.created > 0) {
            const invList = await getInvitations()
            const arr = Array.isArray(invList) ? invList : (invList?.results ?? [])
            setInvitations(arr.filter(inv => inv.role === 'student'))
        }
        return result
    }

    async function handleResend(id) {
        await resendInvitation(id)
        const invList = await getInvitations()
        const arr = Array.isArray(invList) ? invList : (invList?.results ?? [])
        setInvitations(arr.filter(inv => inv.role === 'student'))
    }

    async function handleCancelInvite(id) {
        await cancelInvitation(id)
        const invList = await getInvitations()
        const arr = Array.isArray(invList) ? invList : (invList?.results ?? [])
        setInvitations(arr.filter(inv => inv.role === 'student'))
    }

    if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>
    if (error)   return <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>

    const filtered = students.filter(s => {
        if (year && s.year !== year) return false
        if (classVal && s.classLetter !== classVal) return false
        if (search) {
            const q = search.toLowerCase()
            if (!s.name.toLowerCase().includes(q) && !s.adm.toLowerCase().includes(q)) return false
        }
        return true
    })

    const classLabel = year && classVal ? `${year}${classVal}` : year || 'All Classes'

    function handleExport() {
        if (!filtered.length) return
        const header = 'Name,Adm No,Year,Class,Dormitory,Term 1,Term 2,Current,Standing'
        const body   = filtered.map(s =>
            `"${s.name}","${s.adm}",${s.year},${s.classLetter},${s.house},${s.t1},${s.t2},${s.curr},${s.standing}`
        ).join('\n')
        const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a'); a.href = url; a.download = `students-${classLabel}.csv`; a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Student Management" subtitle="Monitor student enrollment and performance" {...dosUser} />

                    <DashboardContent>
                        <div className="portal-stat-grid">
                            {studentStats.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <ClassPicker
                            sections={config}
                            section={section}
                            onSectionChange={s => { setSection(s); setYear(''); setClassVal('') }}
                            year={year}
                            onYearChange={y => { setYear(y); setClassVal('') }}
                            classVal={classVal}
                            onClassChange={setClassVal}
                        />

                        <div className="toolbar-card">
                            <div className="toolbar-search">
                                <span className="material-symbols-rounded">search</span>
                                <input placeholder="Search by name or admission number..." value={search} onChange={e => setSearch(e.target.value)} />
                                {search && <button className="toolbar-search-clear" onClick={() => setSearch('')}><span className="material-symbols-rounded">close</span></button>}
                            </div>
                            <div className="toolbar-spacer" />
                            <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={!filtered.length}>
                                <span className="material-symbols-rounded icon-sm">download</span> Export
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => setInviteOpen(true)}>
                                <span className="material-symbols-rounded icon-sm">send</span> Invite Student
                            </button>
                        </div>

                        <InvitationHistory
                            invitations={invitations}
                            onResend={handleResend}
                            onCancel={handleCancelInvite}
                        />

                        <DataTable
                            title={`${classLabel} — Students`}
                            data={filtered}
                            columns={['Student','Adm No.','Dormitory','Term 1','Term 2','Current','Standing','Actions']}
                            renderRow={s => <StudentRow key={s.adm} {...s} />}
                            emptyIcon="people"
                            emptyTitle="No students found"
                            emptyDesc={search ? `No results for "${search}"` : `No students found for ${classLabel}.`}
                            onClearFilters={search ? () => setSearch('') : undefined}
                        />
                    </DashboardContent>
                </main>
            </div>

            {inviteOpen && (
                <InviteStudentModal
                    admitYears={admitYears}
                    admitStreams={admitStreams}
                    onClose={() => setInviteOpen(false)}
                    onInvite={handleInvite}
                    onBulkInvite={handleBulkInvite}
                />
            )}
        </>
    )
}
