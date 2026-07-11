import { useState, useRef, useEffect } from 'react'
import { getSubjects } from '../../api/dos'
import { DataTable } from '../../components/ui/DataTable'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { StatCard } from '../../components/layout/StatCard'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { getDosTeachers, getDosTeacherStats, updateDosTeacher, getDosTeacherClasses, assignDosTeacherClasses } from '../../api/dos'
import { sendInvitation, getInvitations, resendInvitation, cancelInvitation } from '../../api/auth'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { Loading } from '../../components/ui/Loading'

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPES = ['Full-Time', 'Part-Time']

const AVATAR_COLORS = ['#003d7a', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#0891b2', '#7c3aed', '#be185d']
function avatarColor(name) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] }
function initials(name) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }


const EMPTY_FORM = { name: '', subject: '', type: 'Full-Time', status: 'Active', email: '', password: '' }

// ── Inline dropdown (shared) ──────────────────────────────────────────────────
function InlineSelect({ value, onChange, options, placeholder }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])
    const label = options.find(o => o === value) ?? placeholder
    return (
        <div ref={ref} className="inline-select-wrap">
            <button type="button" onClick={() => setOpen(o => !o)}
                className={`inline-select-btn${value ? ' has-value' : ''}`}>
                {label}
                <span className="material-symbols-rounded">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div className="inline-select-menu">
                    {[placeholder, ...options].map(opt => (
                        <button key={opt} type="button"
                            onClick={() => { onChange(opt === placeholder ? '' : opt); setOpen(false) }}
                            className={`inline-select-opt${value === opt ? ' active' : ''}`}
                            onMouseEnter={e => { if (value !== opt) e.currentTarget.style.background = 'var(--muted)' }}
                            onMouseLeave={e => { if (value !== opt) e.currentTarget.style.background = 'transparent' }}
                        >{opt}</button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── FormSelect (for modals) ───────────────────────────────────────────────────
function FormSelect({ value, onChange, options, placeholder }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])
    const selected = options.find(o => o.value === value)
    return (
        <div ref={ref} className="form-select-wrap">
            <button type="button" onClick={() => setOpen(o => !o)}
                className={`form-select-btn${selected ? ' has-value' : ''}`}>
                <span>{selected ? selected.label : placeholder}</span>
                <span className="material-symbols-rounded">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div className="form-select-menu">
                    {options.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => { onChange(opt.value); setOpen(false) }}
                            className={`form-select-opt${value === opt.value ? ' active' : ''}`}
                            onMouseEnter={e => { if (value !== opt.value) e.currentTarget.style.background = 'var(--muted)' }}
                            onMouseLeave={e => { if (value !== opt.value) e.currentTarget.style.background = 'transparent' }}
                        >{opt.label}</button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Unified Add / Edit Teacher Modal (details + class assignment) ─────────────
function TeacherModal({ teacher, config, subjectOptions, onClose, onSave }) {
    const isEdit = !!teacher
    const sections = config ?? []
    const noConfig = sections.length === 0 ||
        sections.every(s => s.years.length === 0 || s.years.every(y => y.streams.length === 0))

    const [form, setForm] = useState(
        isEdit
            ? { name: teacher.name, subject: teacher.subject, type: teacher.type, status: teacher.status }
            : { ...EMPTY_FORM }
    )
    const [selected, setSelected] = useState(new Set(teacher?.classes ?? []))

    const isValid = form.name.trim() && form.subject && form.type &&
        (isEdit || (form.email.trim() && form.password.length >= 8))

    function toggle(cls) {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(cls) ? next.delete(cls) : next.add(cls)
            return next
        })
    }

    function toggleYear(year, streams) {
        const yearClasses = streams.map(s => `${year}${s}`)
        const allOn = yearClasses.every(c => selected.has(c))
        setSelected(prev => {
            const next = new Set(prev)
            yearClasses.forEach(c => allOn ? next.delete(c) : next.add(c))
            return next
        })
    }

    function toggleSection(sec) {
        const sectionClasses = sec.years.flatMap(y => y.streams.map(s => `${y.name}${s}`))
        const allOn = sectionClasses.every(c => selected.has(c))
        setSelected(prev => {
            const next = new Set(prev)
            sectionClasses.forEach(c => allOn ? next.delete(c) : next.add(c))
            return next
        })
    }

    function handleSave() {
        onSave({ ...form, classes: [...selected].sort() })
        onClose()
    }

    return (
        <Modal
            title={isEdit ? 'Edit Teacher' : 'Add Teacher'}
            icon={isEdit ? 'edit' : 'person_add'}
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-confirm-actions" style={{ width: '100%' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={!isValid} onClick={handleSave}>
                        <span className="material-symbols-rounded icon-sm">{isEdit ? 'save' : 'person_add'}</span>
                        {isEdit ? 'Save Changes' : 'Add Teacher'}
                    </button>
                </div>
            }
        >
            {/* ── Teacher Details ── */}
            <p className="teacher-modal-section-label">Teacher Details</p>
            <div className="settings-form">
                <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input className="form-control" placeholder="e.g. Jean-Pierre Habimana"
                        value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
                </div>
                <div className="resp-grid-2" style={{ gap: '0.75rem' }}>
                    <div className="form-group">
                        <label className="form-label">Subject *</label>
                        <FormSelect value={form.subject} onChange={v => setForm(p => ({ ...p, subject: v }))}
                            placeholder="— Select subject —"
                            options={subjectOptions.map(s => ({ value: s, label: s }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Employment Type *</label>
                        <FormSelect value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))}
                            placeholder=""
                            options={TYPES.map(t => ({ value: t, label: t }))} />
                    </div>
                </div>
                {isEdit && (
                    <div className="form-group">
                        <label className="form-label">Status</label>
                        <FormSelect value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))}
                            placeholder=""
                            options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
                    </div>
                )}
                {!isEdit && (
                    <div className="resp-grid-2" style={{ gap: '0.75rem' }}>
                        <div className="form-group">
                            <label className="form-label">Email *</label>
                            <input className="form-control" type="email" placeholder="teacher@school.rw"
                                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password * (min 8 chars)</label>
                            <input className="form-control" type="password" placeholder="Min 8 characters"
                                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Divider ── */}
            <div className="teacher-modal-divider" />

            {/* ── Classes to Teach ── */}
            <p className="teacher-modal-section-label">Classes to Teach</p>

            {noConfig ? (
                <EmptyState
                    icon="settings"
                    title="No classes configured yet"
                    description="Go to School Settings to add sections, year groups, and streams before assigning classes."
                />
            ) : (
                <>
                    {sections.map(sec => {
                        const sectionClasses = sec.years.flatMap(y => y.streams.map(s => `${y.name}${s}`))
                        const allSectionOn = sectionClasses.length > 0 && sectionClasses.every(c => selected.has(c))
                        return (
                            <div key={sec.name} className="assign-section">
                                <div className="assign-section-hdr">
                                    <span className="assign-section-name">{sec.name}</span>
                                    <button type="button" className="assign-select-all" onClick={() => toggleSection(sec)}>
                                        {allSectionOn ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                {sec.years.map(y => {
                                    const allYearOn = y.streams.length > 0 &&
                                        y.streams.map(s => `${y.name}${s}`).every(c => selected.has(c))
                                    return (
                                        <div key={y.name} className="assign-year-row">
                                            <button type="button"
                                                className={`assign-year-lbl${allYearOn ? ' active' : ''}`}
                                                onClick={() => toggleYear(y.name, y.streams)}
                                                title={`Toggle all ${y.name} classes`}>
                                                {y.name}
                                            </button>
                                            <div className="assign-stream-group">
                                                {y.streams.map(stream => {
                                                    const cls = `${y.name}${stream}`
                                                    return (
                                                        <button key={stream} type="button" onClick={() => toggle(cls)}
                                                            className={`assign-class-btn${selected.has(cls) ? ' active' : ''}`}>
                                                            {stream}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                    <div className="teacher-assign-hint">
                        {selected.size === 0
                            ? 'No classes selected — teacher will not appear on any timetable'
                            : `${selected.size} class${selected.size !== 1 ? 'es' : ''} selected · ${[...selected].sort().join(', ')}`
                        }
                    </div>
                </>
            )}
        </Modal>
    )
}

// ── Invite Teacher Modal ──────────────────────────────────────────────────────
function InviteTeacherModal({ onClose, onInvite }) {
    const [form, setForm] = useState({ first_name: '', last_name: '', email: '', type: 'Full-Time' })
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState('')

    const isValid = form.first_name.trim() && form.last_name.trim() && form.email.trim()

    async function handleSend() {
        setSending(true); setError('')
        try {
            await onInvite(form.first_name.trim(), form.last_name.trim(), form.email.trim())
            setSent(true)
        } catch (err) {
            setError(err.message || 'Failed to send invitation')
        } finally { setSending(false) }
    }

    if (sent) return (
        <Modal title="Invitation Sent" icon="mark_email_read" onClose={onClose}
            footer={<div className="modal-confirm-actions" style={{ width: '100%' }}><button className="btn btn-primary" onClick={onClose}>Done</button></div>}>
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '3.5rem', color: 'var(--success)' }}>check_circle</span>
                <p style={{ marginTop: '1rem', fontWeight: 600, fontSize: '1.05rem' }}>Invitation sent to {form.email}</p>
                <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    {form.first_name} will receive an email with a secure link to set up their account.
                    They will appear in the teacher list after completing registration.
                </p>
            </div>
        </Modal>
    )

    return (
        <Modal title="Invite Teacher" icon="person_add" onClose={onClose} size="wide"
            footer={
                <div className="modal-confirm-actions" style={{ width: '100%' }}>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={!isValid || sending} onClick={handleSend}>
                        <span className="material-symbols-rounded icon-sm">send</span>
                        {sending ? 'Sending...' : 'Send Invitation'}
                    </button>
                </div>
            }
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--muted)', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '1.25rem', flexShrink: 0 }}>info</span>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', margin: 0 }}>
                    An email will be sent with a secure registration link. The teacher sets their own password — you never need to share credentials.
                </p>
            </div>

            <div className="settings-form">
                <div className="resp-grid-2" style={{ gap: '0.75rem' }}>
                    <div className="form-group">
                        <label className="form-label">First Name *</label>
                        <input className="form-control" placeholder="e.g. Jean-Pierre"
                            value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} autoFocus />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Last Name *</label>
                        <input className="form-control" placeholder="e.g. Habimana"
                            value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input className="form-control" type="email" placeholder="teacher@school.rw"
                        value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Employment Type</label>
                    <FormSelect value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))}
                        placeholder="" options={TYPES.map(t => ({ value: t, label: t }))} />
                </div>
            </div>
            {error && <p style={{ color: 'var(--danger)', marginTop: '0.75rem', fontSize: '0.875rem' }}>{error}</p>}
        </Modal>
    )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return '1 day ago'
    return `${diff} days ago`
}

// ── Pending Invitations Card ──────────────────────────────────────────────────
function PendingInvitationsCard({ invitations, onResend, onCancel }) {
    const [resending, setResending] = useState(null)
    const [cancelling, setCancelling] = useState(null)

    if (invitations.length === 0) return null

    async function doResend(id) {
        setResending(id)
        try { await onResend(id) } finally { setResending(null) }
    }

    async function doCancel(id) {
        setCancelling(id)
        try { await onCancel(id) } finally { setCancelling(null) }
    }

    return (
        <div className="card" style={{ marginBottom: '1.25rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--warning)', fontSize: '1.2rem' }}>schedule_send</span>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Pending Invitations</span>
                <span style={{ background: 'var(--warning)', color: '#fff', borderRadius: '999px', fontSize: '0.72rem', padding: '0.1rem 0.55rem', fontWeight: 700, marginLeft: '0.1rem' }}>
                    {invitations.length}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: '0.8rem', marginLeft: '0.25rem' }}>
                    — teachers who have not yet completed registration
                </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ fontSize: '0.78rem', color: 'var(--muted)', background: 'var(--surface-2, #f8f9fa)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <th style={{ padding: '0.55rem 1.25rem', textAlign: 'left', fontWeight: 600 }}>Teacher</th>
                        <th style={{ padding: '0.55rem 1rem', textAlign: 'left', fontWeight: 600 }}>Email</th>
                        <th style={{ padding: '0.55rem 1rem', textAlign: 'left', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '0.55rem 1rem', textAlign: 'left', fontWeight: 600 }}>Invited</th>
                        <th style={{ padding: '0.55rem 1rem', textAlign: 'left', fontWeight: 600 }}>Expires</th>
                        <th style={{ padding: '0.55rem 1.25rem', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {invitations.map(inv => {
                        const expired = inv.is_expired
                        const fullName = `${inv.first_name} ${inv.last_name}`
                        return (
                            <tr key={inv.id} style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.75rem 1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <div className="dt-avatar" style={{ background: avatarColor(fullName) }}>{initials(fullName)}</div>
                                        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{fullName}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.875rem' }}>{inv.email || '—'}</td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    {expired
                                        ? <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '0.8rem' }}>Expired</span>
                                        : inv.delivery_status === 'sent'
                                            ? <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.8rem' }}>Sent</span>
                                            : <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: '0.8rem' }}>Failed</span>
                                    }
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontSize: '0.8rem' }}>{daysAgo(inv.created_at)}</td>
                                <td style={{ padding: '0.75rem 1rem', color: expired ? 'var(--danger)' : 'var(--muted)', fontSize: '0.8rem' }}>
                                    {new Date(inv.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td style={{ padding: '0.75rem 1.25rem' }}>
                                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-outline btn-sm" disabled={resending === inv.id} onClick={() => doResend(inv.id)}>
                                            <span className="material-symbols-rounded icon-sm">send</span>
                                            {resending === inv.id ? 'Sending…' : 'Resend'}
                                        </button>
                                        <button className="btn btn-sm"
                                            style={{ color: 'var(--danger)', border: '1px solid var(--danger)', background: 'transparent' }}
                                            disabled={cancelling === inv.id}
                                            onClick={() => doCancel(inv.id)}>
                                            <span className="material-symbols-rounded icon-sm">cancel</span>
                                            {cancelling === inv.id ? '…' : 'Cancel'}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

const typeMap = { full_time: 'Full-Time', part_time: 'Part-Time' }

// ── Main Page ─────────────────────────────────────────────────────────────────
export function DosTeachers() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const { config } = useSchoolConfig()

    // ── All hooks first ────────────────────────────────────────────────────────
    const [teachers, setTeachers] = useState([])
    const [apiStats, setApiStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')
    const [subjectFilter, setSubjectFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [addOpen, setAddOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [invitations, setInvitations] = useState([])
    const [subjects,    setSubjects]    = useState([])

    useEffect(() => {
        async function load() {
            try {
                const [list, stats, invList, subjectList] = await Promise.all([
                    getDosTeachers(), getDosTeacherStats(), getInvitations(), getSubjects()
                ])
                const teacherList = list.map(t => ({
                    id: t.teacher_id,
                    name: t.full_name,
                    subject: t.subjects[0] || '—',
                    type: typeMap[t.employment_type] || 'Full-Time',
                    classes: [],
                    status: 'Active',
                }))
                const classResults = await Promise.all(
                    teacherList.map(t => getDosTeacherClasses(t.id).catch(() => ({ classes: [] })))
                )
                teacherList.forEach((t, i) => { t.classes = classResults[i].classes ?? [] })
                setTeachers(teacherList)
                setApiStats(stats)
                const invArr = Array.isArray(invList) ? invList : (invList?.results ?? [])
                setInvitations(invArr.filter(inv => inv.role === 'teacher' && !inv.is_used))
                setSubjects(subjectList.map(s => s.name))
            } catch (err) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const teacherStats = apiStats ? [
        { colorClass: 'info', icon: 'school', trend: `+${apiStats.new_this_term} this term`, value: apiStats.total_teachers, label: 'Total Teachers' },
        { colorClass: 'success', icon: 'badge', trend: `${apiStats.full_time_pct}% of staff`, value: apiStats.full_time_count, label: 'Full-Time' },
        { colorClass: 'warning', icon: 'schedule', trend: `${apiStats.part_time_pct}% of staff`, value: apiStats.part_time_count, label: 'Part-Time' },
        { colorClass: 'info', icon: 'groups', trend: apiStats.ratio_label, value: apiStats.student_teacher_ratio, label: 'Student-Teacher Ratio' },
    ] : []

    async function handleInvite(first_name, last_name, email) {
        await sendInvitation({ first_name, last_name, email, role: 'teacher' })
    }

    async function handleResend(id) {
        await resendInvitation(id)
        getInvitations().then(invList => {
            const invArr = Array.isArray(invList) ? invList : (invList?.results ?? [])
            setInvitations(invArr.filter(inv => inv.role === 'teacher' && !inv.is_used))
        })
    }

    async function handleCancelInvite(id) {
        await cancelInvitation(id)
        setInvitations(prev => prev.filter(inv => inv.id !== id))
    }

    async function handleEdit({ name, type, status, classes }) {
        const parts = name.trim().split(' ')
        const last_name = parts.pop()
        const first_name = parts.join(' ') || last_name
        const employment_type = type === 'Full-Time' ? 'full_time' : 'part_time'
        try {
            await Promise.all([
                updateDosTeacher(editing.id, { first_name, last_name, employment_type }),
                assignDosTeacherClasses(editing.id, classes),
            ])
            setTeachers(prev => prev.map(t =>
                t.id === editing.id ? { ...t, name, type, status, classes } : t
            ))
        } catch (err) { console.error(err) }
    }

    const filtered = teachers.filter(t => {
        if (subjectFilter && t.subject !== subjectFilter) return false
        if (typeFilter && t.type !== typeFilter) return false
        if (search) {
            const q = search.toLowerCase()
            if (!t.name.toLowerCase().includes(q) && !t.subject.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) return false
        }
        return true
    })

    if (loading) return <Loading fullPage />
    if (error) return <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Teacher Management" subtitle="View, add, update teachers and manage class assignments" {...sessionUser} notifications={liveNotifications} onNotificationRead={markRead} />

                    <DashboardContent>
                        <div className="portal-stat-grid">
                            {teacherStats.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="toolbar-card">
                            <div className="toolbar-search">
                                <span className="material-symbols-rounded">search</span>
                                <input placeholder="Search by name or subject..." value={search} onChange={e => setSearch(e.target.value)} />
                                {search && <button className="toolbar-search-clear" onClick={() => setSearch('')}><span className="material-symbols-rounded">close</span></button>}
                            </div>
                            <InlineSelect value={subjectFilter} onChange={setSubjectFilter} options={subjects} placeholder="All Subjects" />
                            <InlineSelect value={typeFilter} onChange={setTypeFilter} options={TYPES} placeholder="All Types" />
                            <div className="toolbar-spacer" />
                            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
                                <span className="material-symbols-rounded icon-sm">send</span> Invite Teacher
                            </button>
                        </div>

                        <PendingInvitationsCard
                            invitations={invitations}
                            onResend={handleResend}
                            onCancel={handleCancelInvite}
                        />

                        <DataTable
                            title="All Teachers"
                            data={filtered}
                            columns={['Teacher', 'Subject', 'Type', 'Classes Assigned', 'Status', 'Actions']}
                            renderRow={t => (
                                <tr key={t.id}>
                                    <td>
                                        <div className="dt-cell-user">
                                            <div className="dt-avatar" style={{ background: avatarColor(t.name) }}>{initials(t.name)}</div>
                                            <div><div className="dt-name">{t.name}</div><div className="dt-sub">{t.id}</div></div>
                                        </div>
                                    </td>
                                    <td className="fw-600">{t.subject}</td>
                                    <td><span className={`tm-badge ${t.type === 'Full-Time' ? 'fulltime' : 'parttime'}`}>{t.type}</span></td>
                                    <td>{t.classes.length > 0 ? t.classes.map((cls, i) => <span key={i} className="dt-chip">{cls}</span>) : <span className="dt-sub">None assigned</span>}</td>
                                    <td>
                                        <span className={`dt-status${t.status === 'Active' ? ' dt-status-active' : ' dt-status-inactive'}`}>
                                            <span className={`dt-status-dot${t.status === 'Active' ? ' dt-status-dot-active' : ' dt-status-dot-inactive'}`} />
                                            {t.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-primary btn-sm" onClick={() => setEditing(t)}>
                                            <span className="material-symbols-rounded icon-sm">edit</span> Edit
                                        </button>
                                    </td>
                                </tr>
                            )}
                            emptyIcon="school"
                            emptyTitle="No teachers found"
                            emptyDesc={search ? `No results for "${search}"` : 'No teachers match the selected filters.'}
                            onClearFilters={() => { setSearch(''); setSubjectFilter(''); setTypeFilter('') }}
                        />
                    </DashboardContent>
                </main>
            </div>

            {addOpen && <InviteTeacherModal onClose={() => setAddOpen(false)} onInvite={handleInvite} />}
            {editing && <TeacherModal config={config} subjectOptions={subjects} teacher={editing} onClose={() => setEditing(null)} onSave={handleEdit} />}
        </>
    )
}
