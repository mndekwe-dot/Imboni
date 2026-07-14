import { useState, useEffect } from 'react'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { yearsFromConfig } from '../../utils/classes'
import { Sidebar } from '../../components/layout/Sidebar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { DataTable } from '../../components/ui/DataTable'
import { StatCard } from '../../components/layout/StatCard'
import { Modal } from '../../components/ui/Modal'
import { Loading } from '../../components/ui/Loading'
import { getDosStudents, getDosStudentStats, inviteDosStudent, bulkInviteDosStudents,
         getDosStudentDetail, suspendDosStudent, changeDosStudentClass, appointStudentLeader, removeStudentLeader,
         downloadStudentReportCard } from '../../api/dos'
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
        id:          s.student_id,   // UUID for API calls
        initials:    s.initials,
        name:        s.full_name,
        adm:         s.student_code,
        year:        gradeMap[s.grade] || s.grade,
        classLetter: s.section,
        status:      s.status,
        house:       '—',
        t1:          '—',
        t2:          '—',
        curr:        s.avg_performance != null ? `${s.avg_performance}%` : 'N/A',
        standClass,
        standing,
    }
}

// ── Student Row ───────────────────────────────────────────────────────────────
function StudentRow({ initials, name, adm, house, t1, t2, curr, standClass, standing, status, onView }) {
    return (
        <tr>
            <td>
                <div className="tm-teacher-cell">
                    <div className={'tm-av' + (status === 'suspended' ? ' dos-av-dim' : '')}>{initials}</div>
                    <div>
                        <span>{name}</span>
                        {status === 'suspended' && (
                            <span className="dos-suspend-tag">Suspended</span>
                        )}
                    </div>
                </div>
            </td>
            <td>{adm}</td><td>{house}</td><td>{t1}</td><td>{t2}</td><td>{curr}</td>
            <td><span className={standClass}>{standing}</span></td>
            <td><button className="tm-btn" onClick={onView}>View</button></td>
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
            footer={<div className="modal-confirm-actions u-full"><button className="btn btn-primary" onClick={onClose}>Done</button></div>}>
            <div className="dos-sent-box">
                <span className="material-symbols-rounded dos-sent-icon">check_circle</span>
                <p className="dos-sent-title">Invitations sent successfully</p>
                <p className="dos-sent-note">
                    {student.first_name} will receive a link to create their student account.<br />
                    {parent.first_name} will receive a link to set up their parent account.
                </p>
            </div>
        </Modal>
    )

    const tabClass = (t) => 'dos-tab' + (tab === t ? ' active' : '')

    return (
        <Modal title="Invite Student" icon="person_add" onClose={onClose} size="wide"
            footer={
                <div className="modal-confirm-actions u-full">
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
            <div className="dos-tab-bar">
                <button className={tabClass('single')} onClick={() => setTab('single')}>Single Student</button>
                <button className={tabClass('bulk')}   onClick={() => setTab('bulk')}>Bulk Upload (CSV)</button>
            </div>

            {/* ── Single tab ── */}
            {tab === 'single' && <>
                <div className="dos-info-box">
                    <span className="material-symbols-rounded dos-info-icon">info</span>
                    <p className="dos-info-text">
                        Two invitation emails will be sent — one for the student to create their account, and one for the parent/guardian.
                    </p>
                </div>

                <p className="teacher-modal-section-label">Student Details</p>
                <div className="settings-form">
                    <div className="resp-grid-2 dos-grid-gap">
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
                    <div className="resp-grid-2 dos-grid-gap">
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

                <hr className="dos-hr" />

                <p className="teacher-modal-section-label">Parent / Guardian Details</p>
                <div className="settings-form">
                    <div className="resp-grid-2 dos-grid-gap">
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
                    <div className="resp-grid-2 dos-grid-gap">
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
                    <p className="dos-form-note">
                        At least one of email or phone is required for the parent.
                    </p>
                </div>

                {error && <p className="dos-danger-text u-sm" style={{ marginTop: '0.75rem' }}>{error}</p>}
            </>}

            {/* ── Bulk tab ── */}
            {tab === 'bulk' && <>
                {/* Step 1 – download template */}
                <div className="dos-step-box">
                    <div>
                        <p className="dos-step-title">Step 1 — Download the template</p>
                        <p className="dos-step-desc">Fill in student and parent details, one row per student.</p>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={downloadTemplate}>
                        <span className="material-symbols-rounded icon-sm">download</span> Template
                    </button>
                </div>

                {/* Step 2 – upload CSV */}
                <p className="dos-step2-label">Step 2 — Upload completed CSV</p>
                <label className="dos-upload-label">
                    <span className="material-symbols-rounded dos-upload-icon">upload_file</span>
                    <span className={'dos-upload-text' + (file ? ' has-file' : '')}>
                        {file ? file.name : 'Click to choose a CSV file…'}
                    </span>
                    <input type="file" accept=".csv" className="tm-hidden" onChange={handleFileChange} />
                </label>

                {/* Preview */}
                {preview.length > 0 && !bulkResult && (
                    <div className="u-mb">
                        <p className="dos-preview-label">
                            Preview (first {preview.length} rows)
                        </p>
                        <div className="dos-preview-wrap">
                            <table className="dos-preview-table">
                                <thead>
                                    <tr className="dos-preview-thead">
                                        <th className="dos-preview-th">Student</th>
                                        <th className="dos-preview-th">Email</th>
                                        <th className="dos-preview-th">Year/Stream</th>
                                        <th className="dos-preview-th">Parent</th>
                                        <th className="dos-preview-th">Parent Contact</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.map((row, i) => (
                                        <tr key={i} className="dos-preview-tr">
                                            <td className="dos-preview-td">{row.student_first_name} {row.student_last_name}</td>
                                            <td className="dos-preview-td is-muted">{row.student_email}</td>
                                            <td className="dos-preview-td">{row.year}{row.stream}</td>
                                            <td className="dos-preview-td">{row.parent_first_name} {row.parent_last_name}</td>
                                            <td className="dos-preview-td is-muted">{row.parent_email || row.parent_phone || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Results after upload */}
                {bulkResult && (
                    <div className={'dos-bulk-result ' + (bulkResult.created > 0 ? 'ok' : 'err')}>
                        <p className="dos-bulk-result-title">
                            {bulkResult.created > 0 ? `${bulkResult.created} student${bulkResult.created > 1 ? 's' : ''} invited successfully` : 'No invitations sent'}
                            {bulkResult.failed > 0 && ` — ${bulkResult.failed} row${bulkResult.failed > 1 ? 's' : ''} failed`}
                        </p>
                        {bulkResult.errors.length > 0 && (
                            <ul className="dos-bulk-errors">
                                {bulkResult.errors.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
                            </ul>
                        )}
                    </div>
                )}
            </>}
        </Modal>
    )
}

// ── Student Detail Modal ──────────────────────────────────────────────────────
const LEADER_ROLES = [
    { value: 'head_boy',         label: 'Head Boy'         },
    { value: 'head_girl',        label: 'Head Girl'        },
    { value: 'deputy_head_boy',  label: 'Deputy Head Boy'  },
    { value: 'deputy_head_girl', label: 'Deputy Head Girl' },
    { value: 'prefect',          label: 'Prefect'          },
    { value: 'house_captain',    label: 'House Captain'    },
    { value: 'class_captain',    label: 'Class Captain'    },
    { value: 'games_captain',    label: 'Games Captain'    },
]

const gradeFromYear = y => y.toUpperCase().startsWith('S') ? y.slice(1) : y

function StudentDetailDrawer({ studentId, onClose, onStudentUpdated, config }) {
    const [student,      setStudent]      = useState(null)
    const [loading,      setLoading]      = useState(true)
    const [actionErr,    setActionErr]    = useState('')

    const [changeClassOpen, setChangeClassOpen] = useState(false)
    const [newYear,   setNewYear]   = useState('')
    const [newStream, setNewStream] = useState('')
    const [saving,    setSaving]    = useState(false)

    const [appointOpen, setAppointOpen] = useState(false)
    const [leaderRole,  setLeaderRole]  = useState('')
    const [leaderNotes, setLeaderNotes] = useState('')
    const [appointing,  setAppointing]  = useState(false)

    const [suspending, setSuspending] = useState(false)
    const [removing,   setRemoving]   = useState(null)
    const [downloading, setDownloading] = useState(false)

    async function handleDownloadReportCard() {
        setDownloading(true); setActionErr('')
        try {
            const blob = await downloadStudentReportCard(studentId)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `report_${student?.student_code || studentId}.pdf`
            a.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            // 404 = no approved results for the current term
            setActionErr(err?.response?.status === 404
                ? 'No approved results for this student in the current term yet.'
                : 'Failed to generate the report card.')
        } finally {
            setDownloading(false)
        }
    }

    const availYears   = yearsFromConfig(config)
    const availStreams  = [...new Set(config.flatMap(s => s.years.flatMap(y => y.streams)))]

    useEffect(() => {
        setLoading(true); setActionErr(''); setChangeClassOpen(false); setAppointOpen(false)
        getDosStudentDetail(studentId)
            .then(d => { setStudent(d); setNewYear(`S${d.grade}`); setNewStream(d.section) })
            .catch(() => setActionErr('Failed to load student.'))
            .finally(() => setLoading(false))
    }, [studentId])

    async function handleSuspend() {
        setSuspending(true); setActionErr('')
        try {
            const res = await suspendDosStudent(studentId, { suspended: student.status !== 'suspended' })
            setStudent(s => ({ ...s, status: res.status }))
            onStudentUpdated()
        } catch { setActionErr('Failed to update status.') }
        finally  { setSuspending(false) }
    }

    async function handleChangeClass() {
        if (!newYear || !newStream) return
        setSaving(true); setActionErr('')
        try {
            const res = await changeDosStudentClass(studentId, { grade: gradeFromYear(newYear), section: newStream })
            setStudent(s => ({ ...s, grade: gradeFromYear(newYear), section: newStream }))
            setChangeClassOpen(false)
            if (res.warning) setActionErr(res.warning)
            onStudentUpdated()
        } catch { setActionErr('Failed to change class.') }
        finally  { setSaving(false) }
    }

    async function handleAppoint() {
        if (!leaderRole) return
        setAppointing(true); setActionErr('')
        try {
            const res = await appointStudentLeader(studentId, { role: leaderRole, notes: leaderNotes })
            setStudent(s => ({ ...s, leadership: [...(s.leadership || []).filter(l => l.role !== leaderRole), res] }))
            setAppointOpen(false); setLeaderRole(''); setLeaderNotes('')
        } catch (err) { setActionErr(err?.response?.data?.error || 'Failed to appoint leader.') }
        finally { setAppointing(false) }
    }

    async function handleRemoveLeader(role) {
        setRemoving(role); setActionErr('')
        try {
            await removeStudentLeader(studentId, role)
            setStudent(s => ({ ...s, leadership: s.leadership.filter(l => l.role !== role) }))
        } catch { setActionErr('Failed to remove role.') }
        finally  { setRemoving(null) }
    }

    const isSuspended = student?.status === 'suspended'
    const classLabel  = student ? `S${student.grade}${student.section}` : '—'

    const standingColor = (p) => p >= 80 ? 'var(--success)' : p >= 60 ? 'var(--warning)' : 'var(--danger)'

    const infoRow = (label, value) => (
        <div className="dos-info-row">
            <span className="dos-info-row-label">{label}</span>
            <span className="dos-info-row-value">{value ?? '—'}</span>
        </div>
    )

    return (
        <Modal
            title="Student Profile"
            icon="person"
            onClose={onClose}
            footer={
                <div className="modal-confirm-actions u-full">
                    <button
                        className={'btn btn-sm dos-btn-inline ' + (isSuspended ? 'reinstate' : 'suspend')}
                        onClick={handleSuspend}
                        disabled={suspending || !student}
                    >
                        <span className="material-symbols-rounded icon-sm">{isSuspended ? 'check_circle' : 'block'}</span>
                        {suspending ? '…' : isSuspended ? 'Reinstate' : 'Suspend'}
                    </button>
                    <button className="btn btn-outline btn-sm dos-btn-inline" onClick={handleDownloadReportCard}
                        disabled={downloading || !student}>
                        <span className="material-symbols-rounded icon-sm">picture_as_pdf</span>
                        {downloading ? 'Generating…' : 'Report Card'}
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
                </div>
            }
        >
            {loading && <p className="dos-drawer-loading">Loading…</p>}

            {!loading && student && (
                <>
                    {/* ── Profile row ── */}
                    <div className="dos-profile-row">
                        <div className="dos-profile-av" style={{ background: avatarColor(student.full_name) }}>
                            {initials(student.full_name)}
                        </div>
                        <div className="dos-flex-min">
                            <div className="dos-profile-name">{student.full_name}</div>
                            <div className="dos-profile-meta">{student.student_code} · {classLabel}</div>
                            <div className="dos-badge-row">
                                <span className={'dos-status-pill ' + (isSuspended ? 'suspended' : 'active')}>
                                    {isSuspended ? 'Suspended' : 'Active'}
                                </span>
                                {(student.leadership || []).map(l => (
                                    <span key={l.role} className="dos-role-pill">
                                        {l.role_display}
                                    </span>
                                ))}
                            </div>
                        </div>
                        {/* Stat pills */}
                        <div className="dos-stat-pills">
                            {[
                                { label: 'Perf', val: student.avg_performance },
                                { label: 'Att',  val: student.attendance_rate  },
                            ].map(({ label, val }) => (
                                <div key={label} className="dos-stat-pill" style={{ '--dos-accent': standingColor(val ?? 0) }}>
                                    <div className="dos-stat-pill-value">{val != null ? `${val}%` : '—'}</div>
                                    <div className="dos-stat-pill-label">{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Error ── */}
                    {actionErr && (
                        <div className="dos-action-err">
                            {actionErr}
                        </div>
                    )}

                    {/* ── Info ── */}
                    <p className="teacher-modal-section-label">Information</p>
                    <div className="u-mb">
                        {infoRow('Email',       student.email)}
                        {infoRow('Class',       classLabel)}
                        {infoRow('Student ID',  student.student_code)}
                        {infoRow('Enrolled',    student.enrollment_date)}
                        {infoRow('Status',      student.status.charAt(0).toUpperCase() + student.status.slice(1))}
                    </div>

                    {/* ── Leadership ── */}
                    <p className="teacher-modal-section-label">Leadership Roles</p>
                    {(student.leadership || []).length === 0 && !appointOpen && (
                        <p className="dos-empty-note">No roles this term.</p>
                    )}
                    {(student.leadership || []).map(l => (
                        <div key={l.role} className="dos-role-item">
                            <span className="dos-role-name">{l.role_display} <span className="dos-role-since">since {l.appointed_date}</span></span>
                            <button onClick={() => handleRemoveLeader(l.role)} disabled={removing === l.role}
                                className="dos-role-remove">
                                {removing === l.role ? '…' : 'Remove'}
                            </button>
                        </div>
                    ))}
                    {!appointOpen ? (
                        <button onClick={() => setAppointOpen(true)} className="dos-appoint-btn">
                            + Appoint Role
                        </button>
                    ) : (
                        <div className="dos-inline-panel u-mb-sm">
                            <div className="form-group dos-mb-half">
                                <label className="form-label">Role</label>
                                <select className="form-control" value={leaderRole} onChange={e => setLeaderRole(e.target.value)}>
                                    <option value="">— Select a role —</option>
                                    {LEADER_ROLES.filter(r => !(student.leadership || []).some(l => l.role === r.value)).map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group dos-mb-half">
                                <label className="form-label">Notes <span className="dos-optional">(optional)</span></label>
                                <input className="form-control" placeholder="e.g. Elected by class vote" value={leaderNotes} onChange={e => setLeaderNotes(e.target.value)} />
                            </div>
                            <div className="modal-confirm-actions">
                                <button className="btn btn-outline btn-sm" onClick={() => { setAppointOpen(false); setLeaderRole(''); setLeaderNotes('') }}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleAppoint} disabled={!leaderRole || appointing}>
                                    {appointing ? 'Appointing…' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Change Class ── */}
                    <p className="teacher-modal-section-label">Class Management</p>
                    {!changeClassOpen ? (
                        <button className="btn btn-outline btn-sm dos-btn-full" onClick={() => setChangeClassOpen(true)}>
                            <span className="material-symbols-rounded icon-sm">swap_horiz</span> Change Class
                        </button>
                    ) : (
                        <div className="dos-inline-panel">
                            <div className="dos-class-row">
                                <div className="flex-1">
                                    <label className="form-label">Year</label>
                                    <select className="form-control" value={newYear} onChange={e => setNewYear(e.target.value)}>
                                        {availYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="form-label">Stream</label>
                                    <select className="form-control" value={newStream} onChange={e => setNewStream(e.target.value)}>
                                        {availStreams.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-confirm-actions">
                                <button className="btn btn-outline btn-sm" onClick={() => setChangeClassOpen(false)}>Cancel</button>
                                <button className="btn btn-primary btn-sm" onClick={handleChangeClass} disabled={saving}>
                                    {saving ? 'Saving…' : `Move to ${newYear}${newStream}`}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </Modal>
    )
}

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
        <div className="card dos-inv-card">
            <div className="dos-inv-header">
                <span className="material-symbols-rounded dos-inv-header-icon">mark_email_read</span>
                <span className="dos-inv-title">Student Invitation History</span>
                <span className="dos-inv-count">
                    {invitations.length}
                </span>
            </div>

            <div className="dos-inv-tabs">
                {INV_TABS.map(tab => (
                    <button key={tab.key} onClick={() => setFilter(tab.key)}
                        className={'dos-inv-tab' + (filter === tab.key ? ' active' : '')}>
                        {tab.label}
                        {counts[tab.key] > 0 && (
                            <span className="dos-inv-tab-count">{counts[tab.key]}</span>
                        )}
                    </button>
                ))}
            </div>

            {visible.length === 0 ? (
                <div className="dos-inv-empty">
                    No {filter === 'all' ? '' : filter} invitations
                </div>
            ) : (
                <table className="dos-inv-table">
                    <thead>
                        <tr className="dos-inv-thead">
                            <th className="dos-inv-th wide">Student</th>
                            <th className="dos-inv-th">Email</th>
                            <th className="dos-inv-th">Class</th>
                            <th className="dos-inv-th">Status</th>
                            <th className="dos-inv-th">Invited</th>
                            <th className="dos-inv-th">Expires</th>
                            <th className="dos-inv-th wide right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map(inv => {
                            const fullName = `${inv.first_name} ${inv.last_name}`
                            let statusEl
                            if (inv.is_used) {
                                statusEl = (
                                    <span className="dos-inv-status ok dos-inv-status-flex">
                                        <span className="material-symbols-rounded dos-inv-status-icon">check_circle</span>Registered
                                    </span>
                                )
                            } else if (inv.is_expired) {
                                statusEl = <span className="dos-inv-status err">Expired</span>
                            } else if (inv.delivery_status === 'sent') {
                                statusEl = <span className="dos-inv-status warn">Pending</span>
                            } else {
                                statusEl = <span className="dos-inv-status err">Failed</span>
                            }

                            return (
                                <tr key={inv.id} className="dos-inv-tr">
                                    <td className="dos-inv-td wide">
                                        <div className="dos-inv-student">
                                            <div className="dt-avatar" style={{ background: avatarColor(fullName) }}>{initials(fullName)}</div>
                                            <span className="dos-inv-name">{fullName}</span>
                                        </div>
                                    </td>
                                    <td className="dos-inv-td sm muted">{inv.email || '—'}</td>
                                    <td className="dos-inv-td sm muted">{inv.class_obj_name || '—'}</td>
                                    <td className="dos-inv-td">{statusEl}</td>
                                    <td className="dos-inv-td xs muted">{daysAgo(inv.created_at)}</td>
                                    <td className={'dos-inv-td xs ' + (inv.is_expired && !inv.is_used ? 'danger' : 'muted')}>
                                        {inv.is_used ? '—' : new Date(inv.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="dos-inv-td wide">
                                        {!inv.is_used && (
                                            <div className="dos-inv-actions">
                                                <button className="btn btn-outline btn-sm" disabled={resending === inv.id} onClick={() => doResend(inv.id)}>
                                                    <span className="material-symbols-rounded icon-sm">send</span>
                                                    {resending === inv.id ? 'Sending…' : 'Resend'}
                                                </button>
                                                <button className="btn btn-sm dos-btn-cancel"
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
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const { config }  = useSchoolConfig()
    const admitYears  = yearsFromConfig(config)
    const admitStreams = [...new Set(config.flatMap(s => s.years.flatMap(y => y.streams)))]

    const [students,          setStudents]          = useState([])
    const [apiStats,          setApiStats]          = useState(null)
    const [loading,           setLoading]           = useState(true)
    const [error,             setError]             = useState(null)
    const [section,           setSection]           = useState('')
    const [year,              setYear]              = useState('')
    const [classVal,          setClassVal]          = useState('')
    const [search,            setSearch]            = useState('')
    const [inviteOpen,        setInviteOpen]        = useState(false)
    const [invitations,       setInvitations]       = useState([])
    const [selectedStudentId, setSelectedStudentId] = useState(null)

    async function loadData(params) {
        const [list, stats, invList] = await Promise.all([getDosStudents(params), getDosStudentStats(), getInvitations()])
        setStudents((list.results ?? list).map(apiToStudent))
        setApiStats(stats)
        const arr = Array.isArray(invList) ? invList : (invList?.results ?? [])
        setInvitations(arr.filter(inv => inv.role === 'student'))
    }

    // Search is debounced 300ms so the backend isn't queried on every keystroke —
    // the actual filtering happens server-side via ?search=/?grade=, not in JS on
    // an already-loaded full list (that approach doesn't scale past a few hundred students).
    useEffect(() => {
        const handle = setTimeout(() => {
            const params = {}
            if (search) params.search = search
            if (year) params.grade = year.replace('S', '')
            setLoading(true)
            loadData(params)
                .catch(err => setError(err.message))
                .finally(() => setLoading(false))
        }, search || year ? 300 : 0)
        return () => clearTimeout(handle)
    }, [search, year])

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

    if (loading) return <Loading fullPage />
    if (error)   return <p className="u-pad dos-danger-text">Error: {error}</p>

    // search and year are already applied server-side (see the debounced effect above) —
    // only section/classLetter still needs filtering here, since the backend doesn't
    // support that param and the result set is already narrowed to one grade at most.
    const filtered = students.filter(s => {
        if (classVal && s.classLetter !== classVal) return false
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
                    <DashboardHeader title="Student Management" subtitle="Monitor student enrollment and performance" {...sessionUser} notifications={liveNotifications} onNotificationRead={markRead} />

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
                            renderRow={s => <StudentRow key={s.adm} {...s} onView={() => setSelectedStudentId(s.id)} />}
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

            {selectedStudentId && (
                <StudentDetailDrawer
                    studentId={selectedStudentId}
                    onClose={() => setSelectedStudentId(null)}
                    onStudentUpdated={loadData}
                    config={config}
                />
            )}
        </>
    )
}
