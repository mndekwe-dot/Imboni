import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { DataTable } from '../../components/ui/DataTable'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import {
    getAdminStaff, getAdminTeacherStats,
    getInvitations, sendInvitation, resendInvitation, cancelInvitation,
} from '../../api/admin'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import '../../styles/tables.css'

const ROLE_LABEL = {
    teacher:    'Teacher',
    dos:        'Director of Studies',
    matron:     'Matron',
    discipline: 'Discipline Master',
    admin:      'Administrator',
}

const DEPT_FOR_ROLE = {
    teacher:    'Academic',
    dos:        'Academic',
    matron:     'Welfare',
    discipline: 'Welfare',
    admin:      'Admin',
}

const INVITE_ROLES = [
    { value: 'teacher',    label: 'Teacher'             },
    { value: 'dos',        label: 'Director of Studies' },
    { value: 'matron',     label: 'Matron'              },
    { value: 'discipline', label: 'Discipline Master'   },
    { value: 'admin',      label: 'Administrator'       },
]

const BLANK_INVITE = { first_name: '', last_name: '', email: '', role: 'teacher', phone_number: '' }

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function avatarClass(role) {
    const map = { teacher: 'teacher', dos: 'dos', matron: 'matron', discipline: 'dis', admin: 'admin-av' }
    return map[role] || 'support'
}

function contractLabel(empType) {
    if (empType === 'full_time') return 'Full-Time'
    if (empType === 'part_time') return 'Part-Time'
    return '—'
}
function contractClass(empType) {
    if (empType === 'full_time') return 'fulltime'
    if (empType === 'part_time') return 'parttime'
    return ''
}

function inviteStatusClass(inv) {
    if (inv.is_used)                       return 'active'
    if (inv.status === 'cancelled')        return 'inactive'
    return 'pending'
}
function inviteStatusLabel(inv) {
    if (inv.is_used)                       return 'Accepted'
    if (inv.status === 'cancelled')        return 'Cancelled'
    return 'Pending'
}

function StaffRow({ member, onView }) {
    const name    = member.name || member.full_name || `${member.first_name || ''} ${member.last_name || ''}`.trim()
    const role    = member.role
    const dept    = member.department || DEPT_FOR_ROLE[role] || 'Admin'
    const empType = member.employment_type || ''
    const active  = member.is_active !== false

    return (
        <tr>
            <td>
                <div className="adm-cell">
                    <div className={`adm-av ${avatarClass(role)}`}>{initials(name)}</div>
                    <div>
                        <div className="adm-name">{name}</div>
                        <div className="adm-sub">{member.email}</div>
                    </div>
                </div>
            </td>
            <td>{ROLE_LABEL[role] || role}</td>
            <td>{dept}</td>
            <td>
                {empType ? (
                    <span className={`adm-badge ${contractClass(empType)}`}>{contractLabel(empType)}</span>
                ) : '—'}
            </td>
            <td>
                <span className={`adm-badge ${active ? 'active' : 'pending'}`}>{active ? 'Active' : 'Inactive'}</span>
            </td>
            <td>
                <button className="adm-btn" onClick={() => onView(member)}>
                    <span className="material-symbols-rounded">visibility</span> View
                </button>
            </td>
        </tr>
    )
}

function InviteModal({ onClose, onSent }) {
    const [form,    setForm]    = useState(BLANK_INVITE)
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState('')
    const [success, setSuccess] = useState(false)

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
        setError('')
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
            setError('First name, last name and email are required.')
            return
        }
        setLoading(true)
        try {
            await sendInvitation(form)
            setSuccess(true)
            onSent()
            setTimeout(onClose, 1800)
        } catch (err) {
            const msg = err?.response?.data
            setError(typeof msg === 'string' ? msg : Object.values(msg || {}).flat().join(' ') || 'Failed to send invitation.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Invite Staff Member</h2>
                    <button className="modal-close" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>
                {success ? (
                    <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', color: 'var(--success, #16a34a)' }}>mark_email_read</span>
                        <p style={{ fontWeight: 600, marginTop: '0.75rem' }}>Invitation sent!</p>
                        <p style={{ fontSize: '0.83rem', color: 'var(--muted-foreground)' }}>
                            An invitation link was sent to <strong>{form.email}</strong>
                        </p>
                    </div>
                ) : (
                    <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group form-group-0">
                                <label className="form-label">First Name *</label>
                                <input className="form-input" name="first_name" value={form.first_name} onChange={handleChange} autoFocus />
                            </div>
                            <div className="form-group form-group-0">
                                <label className="form-label">Last Name *</label>
                                <input className="form-input" name="last_name" value={form.last_name} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-group form-group-0">
                            <label className="form-label">Email Address *</label>
                            <input className="form-input" name="email" type="email" value={form.email} onChange={handleChange} />
                        </div>
                        <div className="form-group form-group-0">
                            <label className="form-label">Role *</label>
                            <select className="form-input" name="role" value={form.role} onChange={handleChange}>
                                {INVITE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <div className="form-group form-group-0">
                            <label className="form-label">
                                Phone <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
                            </label>
                            <input className="form-input" name="phone_number" value={form.phone_number} onChange={handleChange} placeholder="+250 7XX XXX XXX" />
                        </div>
                        {error && <p style={{ color: 'var(--destructive)', fontSize: '0.82rem' }}>{error}</p>}
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                <span className="material-symbols-rounded">send</span>
                                {loading ? 'Sending…' : 'Send Invitation'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}

export function AdminStaff() {
    const [staffList,   setStaffList]   = useState([])
    const [stats,       setStats]       = useState(null)
    const [loading,     setLoading]     = useState(true)
    const [search,      setSearch]      = useState('')
    const [deptFilter,  setDeptFilter]  = useState('All Departments')
    const [roleFilter,  setRoleFilter]  = useState('All Roles')
    const [viewing,     setViewing]     = useState(null)
    const [showInvite,  setShowInvite]  = useState(false)
    const [invitations, setInvitations] = useState([])
    const [activeTab,   setActiveTab]   = useState('staff')

    function loadStaff() {
        setLoading(true)
        Promise.all([
            getAdminStaff().catch(() => []),
            getAdminTeacherStats().catch(() => null),
        ]).then(([staff, s]) => {
            setStaffList(Array.isArray(staff) ? staff : (staff?.results ?? []))
            setStats(s)
        }).finally(() => setLoading(false))
    }

    function loadInvitations() {
        getInvitations().then(data => {
            setInvitations(Array.isArray(data) ? data : (data?.results ?? []))
        }).catch(() => {})
    }

    useEffect(() => { loadStaff(); loadInvitations() }, [])

    async function handleResend(id) {
        try { await resendInvitation(id); loadInvitations() } catch {}
    }
    async function handleCancel(id) {
        try { await cancelInvitation(id); loadInvitations() } catch {}
    }

    const statCards = stats ? [
        { icon: 'badge',    value: stats.total_teachers,  label: 'Total Teachers',  trend: 'All active',              colorClass: ''        },
        { icon: 'work',     value: stats.full_time_count, label: 'Full-Time',        trend: `${stats.full_time_pct}%`, colorClass: 'info'    },
        { icon: 'schedule', value: stats.part_time_count, label: 'Part-Time',        trend: `${stats.part_time_pct}%`, colorClass: 'success' },
        { icon: 'group',    value: stats.student_teacher_ratio || '—', label: 'Student:Teacher', trend: stats.ratio_label || '', colorClass: 'warning' },
    ] : [
        { icon: 'badge',    value: '—', label: 'Total Teachers',  trend: 'Loading…', colorClass: ''        },
        { icon: 'work',     value: '—', label: 'Full-Time',        trend: 'Loading…', colorClass: 'info'    },
        { icon: 'schedule', value: '—', label: 'Part-Time',        trend: 'Loading…', colorClass: 'success' },
        { icon: 'group',    value: '—', label: 'Student:Teacher',  trend: 'Loading…', colorClass: 'warning' },
    ]

    const filtered = staffList.filter(s => {
        const name  = (s.name || s.full_name || `${s.first_name || ''} ${s.last_name || ''}`).toLowerCase()
        const q     = search.toLowerCase()
        const dept  = s.department || DEPT_FOR_ROLE[s.role] || 'Admin'
        const matchSearch = !q || name.includes(q) || (s.email || '').toLowerCase().includes(q)
        const matchDept   = deptFilter === 'All Departments' || dept === deptFilter
        const matchRole   = roleFilter === 'All Roles' || s.role === roleFilter
        return matchSearch && matchDept && matchRole
    })

    const pendingCount = invitations.filter(i => !i.is_used && i.status !== 'cancelled').length

    return (
        <>
            {viewing && (
                <div className="modal-overlay" onClick={() => setViewing(null)}>
                    <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Staff Profile</h2>
                            <button className="modal-close" onClick={() => setViewing(null)}>
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {[
                                ['Name',     (viewing.name || viewing.full_name || `${viewing.first_name || ''} ${viewing.last_name || ''}`.trim())],
                                ['Email',    viewing.email],
                                ['Phone',    viewing.phone_number || '—'],
                                ['Role',     ROLE_LABEL[viewing.role] || viewing.role],
                                ['Contract', contractLabel(viewing.employment_type)],
                                ['Status',   viewing.is_active !== false ? 'Active' : 'Inactive'],
                            ].map(([label, val]) => (
                                <div key={label} style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span style={{ width: 100, color: 'var(--muted-foreground)', fontSize: '0.85rem', flexShrink: 0 }}>{label}</span>
                                    <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{val}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showInvite && (
                <InviteModal onClose={() => setShowInvite(false)} onSent={loadInvitations} />
            )}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Staff Management" subtitle="Teachers, welfare and administration staff" {...adminUser} />
                    <DashboardContent>

                        <div className="portal-stat-grid">
                            {statCards.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        {/* Tab bar + Invite button */}
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                    className={`btn btn-sm ${activeTab === 'staff' ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setActiveTab('staff')}
                                >
                                    <span className="material-symbols-rounded">badge</span> Staff List
                                </button>
                                <button
                                    className={`btn btn-sm ${activeTab === 'invitations' ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setActiveTab('invitations')}
                                    style={{ position: 'relative' }}
                                >
                                    <span className="material-symbols-rounded">mail</span>
                                    Invitations
                                    {pendingCount > 0 && (
                                        <span style={{ marginLeft: '0.35rem', background: 'var(--warning, #f59e0b)', color: '#fff', borderRadius: '999px', padding: '0 0.4rem', fontSize: '0.68rem', fontWeight: 700 }}>
                                            {pendingCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>
                                <span className="material-symbols-rounded">person_add</span>
                                Invite Staff
                            </button>
                        </div>

                        {activeTab === 'staff' && (
                            <>
                                <div className="toolbar-card">
                                    <div className="toolbar-search">
                                        <span className="material-symbols-rounded">search</span>
                                        <input placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />
                                        {search && <button className="toolbar-search-clear" onClick={() => setSearch('')}><span className="material-symbols-rounded">close</span></button>}
                                    </div>
                                    <select className="input input-auto select-xs" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                                        <option>All Departments</option>
                                        <option>Academic</option><option>Welfare</option><option>Admin</option>
                                    </select>
                                    <select className="input input-auto select-xs" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                                        <option>All Roles</option>
                                        <option value="teacher">Teacher</option>
                                        <option value="dos">Director of Studies</option>
                                        <option value="matron">Matron</option>
                                        <option value="discipline">Discipline Master</option>
                                        <option value="admin">Administrator</option>
                                    </select>
                                </div>

                                {loading ? (
                                    <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading staff…</p>
                                ) : (
                                    <DataTable
                                        title="All Staff"
                                        data={filtered}
                                        columns={['Name', 'Role', 'Department', 'Contract', 'Status', 'Actions']}
                                        renderRow={s => <StaffRow key={s.id} member={s} onView={setViewing} />}
                                        emptyIcon="badge"
                                        emptyTitle="No staff found"
                                        emptyDesc={search ? `No results for "${search}"` : 'No staff match the selected filters.'}
                                        onClearFilters={() => { setSearch(''); setDeptFilter('All Departments'); setRoleFilter('All Roles') }}
                                    />
                                )}
                            </>
                        )}

                        {activeTab === 'invitations' && (
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Staff Invitations</h2>
                                    <button className="btn btn-outline btn-sm" onClick={loadInvitations}>
                                        <span className="material-symbols-rounded">refresh</span> Refresh
                                    </button>
                                </div>
                                <div className="card-content">
                                    {invitations.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--muted-foreground)' }}>
                                            <span className="material-symbols-rounded" style={{ fontSize: '2.2rem', display: 'block', marginBottom: '0.5rem' }}>mail_outline</span>
                                            No invitations sent yet. Click <strong>Invite Staff</strong> to get started.
                                        </div>
                                    ) : (
                                        <div className="adm-table-wrap">
                                            <table className="adm-table">
                                                <thead>
                                                    <tr>
                                                        <th>Recipient</th>
                                                        <th>Role</th>
                                                        <th>Status</th>
                                                        <th>Sent</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {invitations.map(inv => (
                                                        <tr key={inv.id}>
                                                            <td>
                                                                <div className="adm-name">{`${inv.first_name || ''} ${inv.last_name || ''}`.trim() || '—'}</div>
                                                                <div className="adm-sub">{inv.email}</div>
                                                            </td>
                                                            <td>{ROLE_LABEL[inv.role] || inv.role || '—'}</td>
                                                            <td>
                                                                <span className={`adm-badge ${inviteStatusClass(inv)}`}>
                                                                    {inviteStatusLabel(inv)}
                                                                </span>
                                                            </td>
                                                            <td style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                                                                {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
                                                            </td>
                                                            <td>
                                                                {!inv.is_used && inv.status !== 'cancelled' && (
                                                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                                        <button className="adm-btn" title="Resend invitation" onClick={() => handleResend(inv.id)}>
                                                                            <span className="material-symbols-rounded">forward_to_inbox</span>
                                                                        </button>
                                                                        <button className="adm-btn" style={{ color: 'var(--destructive)' }} title="Cancel invitation" onClick={() => handleCancel(inv.id)}>
                                                                            <span className="material-symbols-rounded">cancel</span>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
