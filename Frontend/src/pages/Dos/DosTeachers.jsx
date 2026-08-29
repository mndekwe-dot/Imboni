import { useState, useRef, useEffect } from 'react'
import { PageLoading } from '../../components/layout/PageLoading'
import { useTranslation } from 'react-i18next'
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
import { formatDate } from '../../utils/date'
import { SearchBar } from '../../components/ui/SearchBar'

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
                <span className="material-symbols-rounded" aria-hidden="true">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div className="inline-select-menu">
                    {[placeholder, ...options].map(opt => (
                        <button key={opt} type="button"
                            onClick={() => { onChange(opt === placeholder ? '' : opt); setOpen(false) }}
                            className={`inline-select-opt${value === opt ? ' active' : ''}`}
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
                <span className="material-symbols-rounded" aria-hidden="true">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {open && (
                <div className="form-select-menu">
                    {options.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => { onChange(opt.value); setOpen(false) }}
                            className={`form-select-opt${value === opt.value ? ' active' : ''}`}
                        >{opt.label}</button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Unified Add / Edit Teacher Modal (details + class assignment) ─────────────
function TeacherModal({ teacher, config, subjectOptions, onClose, onSave }) {
    const { t } = useTranslation()
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
                <div className="modal-confirm-actions u-full">
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" disabled={!isValid} onClick={handleSave}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">{isEdit ? 'save' : 'person_add'}</span>
                        {isEdit ? 'Save Changes' : 'Add Teacher'}
                    </button>
                </div>
            }
        >
            {/* ── Teacher Details ── */}
            <p className="teacher-modal-section-label">{t('dos.teachers.teacherDetails')}</p>
            <div className="settings-form">
                <div className="form-group">
                    <label className="form-label">{t('common.fullNameRequired')}</label>
                    <input className="form-control" placeholder="e.g. Jean-Pierre Habimana"
                        value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
                </div>
                <div className="resp-grid-2 u-gap-sm">
                    <div className="form-group">
                        <label className="form-label">{t('dos.teachers.subjectRequired')}</label>
                        <FormSelect value={form.subject} onChange={v => setForm(p => ({ ...p, subject: v }))}
                            placeholder={t('dos.teachers.selectSubject')}
                            options={subjectOptions.map(s => ({ value: s, label: s }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('dos.teachers.employmentTypeRequired')}</label>
                        <FormSelect value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))}
                            placeholder=""
                            options={TYPES.map(t => ({ value: t, label: t }))} />
                    </div>
                </div>
                {isEdit && (
                    <div className="form-group">
                        <label className="form-label">{t('common.status')}</label>
                        <FormSelect value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))}
                            placeholder=""
                            options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
                    </div>
                )}
                {!isEdit && (
                    <div className="resp-grid-2 u-gap-sm">
                        <div className="form-group">
                            <label className="form-label">{t('dos.teachers.emailRequired')}</label>
                            <input className="form-control" type="email" placeholder="teacher@school.rw"
                                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('dos.teachers.passwordRequired')}</label>
                            <input className="form-control" type="password" placeholder={t('dos.teachers.minChars')}
                                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                        </div>
                    </div>
                )}
            </div>

            {/* ── Divider ── */}
            <div className="teacher-modal-divider" />

            {/* ── Classes to Teach ── */}
            <p className="teacher-modal-section-label">{t('dos.teachers.classesToTeach')}</p>

            {noConfig ? (
                <EmptyState
                    icon="settings"
                    title={t('dos.teachers.noClassesConfigured')}
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
                            ? 'No classes selected: teacher will not appear on any timetable'
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
    const { t } = useTranslation()
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
            setError(err.message || t('dos.teachers.sendInvitationFailed'))
        } finally { setSending(false) }
    }

    if (sent) return (
        <Modal title={t('dos.teachers.invitationSent')} icon="mark_email_read" onClose={onClose}
            footer={<div className="modal-confirm-actions u-full"><button className="btn btn-primary" onClick={onClose}>{t('common.done')}</button></div>}>
            <div className="dt-modal-success">
                <span className="material-symbols-rounded dt-success-icon" aria-hidden="true">check_circle</span>
                <p className="dt-success-title">Invitation sent to {form.email}</p>
                <p className="dt-success-note">
                    {form.first_name} will receive an email with a secure link to set up their account.
                    They will appear in the teacher list after completing registration.
                </p>
            </div>
        </Modal>
    )

    return (
        <Modal title={t('dos.teachers.inviteTeacher')} icon="person_add" onClose={onClose} size="wide"
            footer={
                <div className="modal-confirm-actions u-full">
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" disabled={!isValid || sending} onClick={handleSend}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">send</span>
                        {sending ? 'Sending…' : 'Send Invitation'}
                    </button>
                </div>
            }
        >
            <div className="dt-info-box">
                <span className="material-symbols-rounded dt-info-icon" aria-hidden="true">info</span>
                <p className="dt-info-text">
                    An email will be sent with a secure registration link. The teacher sets their own password. You never need to share credentials.
                </p>
            </div>

            <div className="settings-form">
                <div className="resp-grid-2 u-gap-sm">
                    <div className="form-group">
                        <label className="form-label">{t('common.firstNameRequired')}</label>
                        <input className="form-control" placeholder="e.g. Jean-Pierre"
                            value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} autoFocus />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('common.lastNameRequired')}</label>
                        <input className="form-control" placeholder="e.g. Habimana"
                            value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">{t('common.emailAddressRequired')}</label>
                    <input className="form-control" type="email" placeholder="teacher@school.rw"
                        value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('dos.teachers.employmentType')}</label>
                    <FormSelect value={form.type} onChange={v => setForm(p => ({ ...p, type: v }))}
                        placeholder="" options={TYPES.map(t => ({ value: t, label: t }))} />
                </div>
            </div>
            {error && <p className="dt-form-err">{error}</p>}
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
    const { t } = useTranslation()
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
        <div className="card pinv-card">
            <div className="pinv-hdr">
                <span className="material-symbols-rounded pinv-hdr-icon" aria-hidden="true">schedule_send</span>
                <span className="pinv-hdr-title">{t('dos.teachers.pendingInvitations')}</span>
                <span className="pinv-count">
                    {invitations.length}
                </span>
                <span className="pinv-hdr-note">
                    (teachers who have not yet completed registration)
                </span>
            </div>
            <table className="pinv-table">
                <thead>
                    <tr className="pinv-thead">
                        <th className="pinv-th first">{t('common.teacher')}</th>
                        <th className="pinv-th">{t('common.email')}</th>
                        <th className="pinv-th">{t('common.status')}</th>
                        <th className="pinv-th">{t('dos.teachers.invited')}</th>
                        <th className="pinv-th">{t('dos.teachers.expires')}</th>
                        <th className="pinv-th last">{t('common.actions')}</th>
                    </tr>
                </thead>
                <tbody>
                    {invitations.map(inv => {
                        const expired = inv.is_expired
                        const fullName = `${inv.first_name} ${inv.last_name}`
                        return (
                            <tr key={inv.id} className="pinv-tr">
                                <td className="pinv-td first">
                                    <div className="pinv-user">
                                        <div className="dt-avatar" style={{ background: avatarColor(fullName) }}>{initials(fullName)}</div>
                                        <span className="pinv-name">{fullName}</span>
                                    </div>
                                </td>
                                <td className="pinv-td pinv-email">{inv.email || '-'}</td>
                                <td className="pinv-td">
                                    {expired
                                        ? <span className="pinv-status expired">{t('common.expired')}</span>
                                        : inv.delivery_status === 'sent'
                                            ? <span className="pinv-status sent">{t('common.sent')}</span>
                                            : <span className="pinv-status failed">{t('common.failed')}</span>
                                    }
                                </td>
                                <td className="pinv-td pinv-muted">{daysAgo(inv.created_at)}</td>
                                <td className="pinv-td pinv-muted" style={expired ? { color: 'var(--danger)' } : undefined}>
                                    {formatDate(inv.expires_at)}
                                </td>
                                <td className="pinv-td last">
                                    <div className="pinv-actions">
                                        <button className="btn btn-outline btn-sm" disabled={resending === inv.id} onClick={() => doResend(inv.id)}>
                                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">send</span>
                                            {resending === inv.id ? 'Sending…' : 'Resend'}
                                        </button>
                                        <button className="btn btn-sm pinv-cancel"
                                            disabled={cancelling === inv.id}
                                            onClick={() => doCancel(inv.id)}>
                                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">cancel</span>
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
    const { t } = useTranslation()
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
                    subject: t.subjects[0] || '-',
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

    if (loading) return (
        <PageLoading
            navItems={dosNavItems} secondaryItems={dosSecondaryItems}
            title={t('dos.teachers.title')}
            subtitle={t('dos.teachers.subtitle')}
            user={sessionUser}
        />
    )
    if (error) return <p className="u-pad dos-danger-text">Error: {error}</p>

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title={t('dos.teachers.title')} subtitle={t('dos.teachers.subtitle')} {...sessionUser} notifications={liveNotifications} onNotificationRead={markRead} />

                    <DashboardContent>
                        <div className="portal-stat-grid">
                            {teacherStats.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="toolbar-card">
                            <SearchBar
                                value={search}
                                onChange={setSearch}
                                placeholder={t('dos.teachers.searchTeachers')}
                            />
                            <InlineSelect value={subjectFilter} onChange={setSubjectFilter} options={subjects} placeholder={t('dos.teachers.allSubjects')} />
                            <InlineSelect value={typeFilter} onChange={setTypeFilter} options={TYPES} placeholder={t('dos.teachers.allTypes')} />
                            <div className="toolbar-spacer" />
                            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">send</span> {t('dos.teachers.inviteTeacher')}
                            </button>
                        </div>

                        <PendingInvitationsCard
                            invitations={invitations}
                            onResend={handleResend}
                            onCancel={handleCancelInvite}
                        />

                        <DataTable
                            title={t('dos.teachers.allTeachers')}
                            data={filtered}
                            columns={[t('common.teacher'), t('common.subject'), t('common.type'), t('dos.teachers.classesAssigned'), t('common.status'), t('common.actions')]}
                            renderRow={teacher => (
                                <tr key={teacher.id}>
                                    <td>
                                        <div className="dt-cell-user">
                                            <div className="dt-avatar" style={{ background: avatarColor(teacher.name) }}>{initials(teacher.name)}</div>
                                            <div><div className="dt-name">{teacher.name}</div><div className="dt-sub">{teacher.id}</div></div>
                                        </div>
                                    </td>
                                    <td className="fw-600">{teacher.subject}</td>
                                    <td><span className={`tm-badge ${teacher.type === 'Full-Time' ? 'fulltime' : 'parttime'}`}>{teacher.type}</span></td>
                                    <td>{teacher.classes.length > 0 ? teacher.classes.map((cls, i) => <span key={i} className="dt-chip">{cls}</span>) : <span className="dt-sub">{t('dos.teachers.noneAssigned')}</span>}</td>
                                    <td>
                                        <span className={`dt-status${teacher.status === 'Active' ? ' dt-status-active' : ' dt-status-inactive'}`}>
                                            <span className={`dt-status-dot${teacher.status === 'Active' ? ' dt-status-dot-active' : ' dt-status-dot-inactive'}`} />
                                            {teacher.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="btn btn-primary btn-sm" onClick={() => setEditing(teacher)}>
                                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">edit</span> {t('common.edit')}
                                        </button>
                                    </td>
                                </tr>
                            )}
                            emptyIcon="school"
                            emptyTitle={t('dos.teachers.emptyTitle')}
                            emptyDesc={search ? t('dos.students.noResultsFor', { query: search }) : t('dos.teachers.emptyDescNoFilters')}
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
