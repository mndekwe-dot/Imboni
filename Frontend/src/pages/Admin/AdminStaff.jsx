import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { TabGroup } from '../../components/ui/TabGroup'
import { StaffRegister } from '../../components/staff/StaffRegister'
import { DepartmentsPanel } from '../../components/staff/DepartmentsPanel'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import { formatDate } from '../../utils/date'
import {
    getAdminTeacherStats,
    getInvitations, sendInvitation, resendInvitation, cancelInvitation,
} from '../../api/admin'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import '../../styles/tables.css'

// Every role that signs in. The librarian and the bursar were missing, so a
// school could not invite the two people who run the library and the money.
const INVITE_ROLES = ['teacher', 'dos', 'matron', 'discipline', 'librarian', 'bursar', 'admin']

const BLANK_INVITE = { first_name: '', last_name: '', email: '', role: 'teacher', phone_number: '' }

const TABS = ['staff', 'departments', 'invitations']

function inviteStatusClass(inv) {
    if (inv.is_used)                       return 'active'
    if (inv.status === 'cancelled')        return 'inactive'
    return 'pending'
}
function inviteStatusKey(inv) {
    if (inv.is_used)                       return 'accepted'
    if (inv.status === 'cancelled')        return 'cancelled'
    return 'pending'
}

function InviteModal({ onClose, onSent }) {
    const { t } = useTranslation()
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
            setError(t('admin.staff.requiredFields'))
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
            setError(typeof msg === 'string' ? msg : Object.values(msg || {}).flat().join(' ') || t('admin.staff.inviteFailed'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{t('admin.staff.inviteMember')}</h2>
                    <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
                        <span className="material-symbols-rounded" aria-hidden="true">close</span>
                    </button>
                </div>
                {success ? (
                    <div className="modal-body adm-invite-success">
                        <span className="material-symbols-rounded adm-invite-success-icon" aria-hidden="true">mark_email_read</span>
                        <p className="adm-invite-success-title">{t('admin.staff.invitationSent')}</p>
                        <p className="adm-invite-success-note">
                            {t('admin.staff.inviteLinkSentTo')} <strong>{form.email}</strong>
                        </p>
                    </div>
                ) : (
                    <form className="modal-body u-stack-1" onSubmit={handleSubmit}>
                        <div className="u-grid-2">
                            <div className="form-group form-group-0">
                                <label className="form-label" htmlFor="invite-first-name">{t('common.firstNameRequired')}</label>
                                <input id="invite-first-name" className="form-input" name="first_name" value={form.first_name} onChange={handleChange} autoFocus />
                            </div>
                            <div className="form-group form-group-0">
                                <label className="form-label" htmlFor="invite-last-name">{t('common.lastNameRequired')}</label>
                                <input id="invite-last-name" className="form-input" name="last_name" value={form.last_name} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-group form-group-0">
                            <label className="form-label" htmlFor="invite-email">{t('common.emailAddressRequired')}</label>
                            <input id="invite-email" className="form-input" name="email" type="email" value={form.email} onChange={handleChange} />
                        </div>
                        <div className="form-group form-group-0">
                            <label className="form-label" htmlFor="invite-role">{t('common.roleRequired')}</label>
                            <select id="invite-role" className="form-input" name="role" value={form.role} onChange={handleChange}>
                                {INVITE_ROLES.map(r => <option key={r} value={r}>{t(`admin.staff.roles.${r}`)}</option>)}
                            </select>
                        </div>
                        <div className="form-group form-group-0">
                            <label className="form-label" htmlFor="invite-phone">
                                {t('admin.staff.phone')} <span className="u-muted u-fw-400">{t('admin.staff.optional')}</span>
                            </label>
                            <input id="invite-phone" className="form-input" name="phone_number" value={form.phone_number} onChange={handleChange} placeholder="+250 7XX XXX XXX" />
                        </div>
                        {error && <p className="form-error-text">{error}</p>}
                        <div className="u-row-sm u-justify-end u-pt-xs">
                            <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                <span className="material-symbols-rounded" aria-hidden="true">send</span>
                                {loading ? t('admin.staff.sending') : t('admin.staff.send')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}

/**
 * The school's people: everyone it employs, the departments they work in, and
 * the invitations that give some of them an Imboni login.
 *
 * The staff list used to be the login accounts only, with a department guessed
 * from the role and a filter that compared translated labels against English
 * words. It is now the staff register, the same one payroll pays from, so the
 * cook and the night guard are on it and a department is something recorded.
 */
export function AdminStaff() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const toast = useToast()
    const [params, setParams] = useSearchParams()
    const activeTab = TABS.includes(params.get('tab')) ? params.get('tab') : 'staff'
    const [stats,       setStats]       = useState(null)
    const [showInvite,  setShowInvite]  = useState(false)
    const [invitations, setInvitations] = useState([])

    function loadInvitations() {
        getInvitations().then(data => {
            setInvitations(Array.isArray(data) ? data : (data?.results ?? []))
        }).catch(e => toast.error(errorMessage(e, t('admin.staff.loadInvitationsFailed'))))
    }

    useEffect(() => {
        getAdminTeacherStats().then(setStats)
            .catch(e => toast.error(errorMessage(e, t('common.loadFailed'))))
        loadInvitations()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    async function handleResend(id) {
        try {
            await resendInvitation(id)
            toast.success(t('admin.staff.resent'))
            loadInvitations()
        } catch (e) {
            toast.error(errorMessage(e, t('admin.staff.resendFailed')))
        }
    }
    async function handleCancel(id) {
        try {
            await cancelInvitation(id)
            toast.success(t('admin.staff.cancelled'))
            loadInvitations()
        } catch (e) {
            toast.error(errorMessage(e, t('admin.staff.cancelFailed')))
        }
    }

    const statCards = stats ? [
        { icon: 'badge',    value: stats.total_teachers,  label: t('admin.staff.totalTeachers'),  trend: t('admin.staff.allActive'),              colorClass: ''        },
        { icon: 'work',     value: stats.full_time_count, label: t('admin.staff.fullTime'),        trend: `${stats.full_time_pct}%`, colorClass: 'info'    },
        { icon: 'schedule', value: stats.part_time_count, label: t('admin.staff.partTime'),        trend: `${stats.part_time_pct}%`, colorClass: 'success' },
        { icon: 'group',    value: stats.student_teacher_ratio || '-', label: t('admin.staff.studentTeacher'), trend: stats.ratio_label || '', colorClass: 'warning' },
    ] : [
        { icon: 'badge',    value: '-', label: t('admin.staff.totalTeachers'),  trend: t('common.loading'), colorClass: ''        },
        { icon: 'work',     value: '-', label: t('admin.staff.fullTime'),        trend: t('common.loading'), colorClass: 'info'    },
        { icon: 'schedule', value: '-', label: t('admin.staff.partTime'),        trend: t('common.loading'), colorClass: 'success' },
        { icon: 'group',    value: '-', label: t('admin.staff.studentTeacher'),  trend: t('common.loading'), colorClass: 'warning' },
    ]

    const pendingCount = invitations.filter(i => !i.is_used && i.status !== 'cancelled').length

    return (
        <>
            {showInvite && (
                <InviteModal onClose={() => setShowInvite(false)} onSent={loadInvitations} />
            )}

            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title={t('admin.staff.title')} subtitle={t('admin.staff.subtitle')} {...adminUser} notifications={liveNotifications} onNotificationRead={markRead} />
                    <DashboardContent>

                        <div className="portal-stat-grid">
                            {statCards.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="u-row-sm u-justify-between u-wrap">
                            <TabGroup label={t('admin.staff.title')} value={activeTab} idPrefix="staff-"
                                onChange={key => setParams(key === 'staff' ? {} : { tab: key }, { replace: true })}
                                tabs={[
                                    { key: 'staff', icon: 'badge', label: t('staff.register') },
                                    { key: 'departments', icon: 'corporate_fare', label: t('staff.departmentsTitle') },
                                    { key: 'invitations', icon: 'mail', label: t('admin.staff.invitations'), count: pendingCount },
                                ]} />
                            <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>
                                <span className="material-symbols-rounded" aria-hidden="true">person_add</span>
                                {t('admin.staff.invite')}
                            </button>
                        </div>

                        <div role="tabpanel" id={`staff-panel-${activeTab}`} aria-labelledby={`staff-tab-${activeTab}`}
                            className="page-stack">
                            {activeTab === 'staff' && <StaffRegister />}
                            {activeTab === 'departments' && <DepartmentsPanel />}
                            {activeTab === 'invitations' && (
                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">{t('admin.staff.invitations')}</h2>
                                        <button className="btn btn-outline btn-sm" onClick={loadInvitations}>
                                            <span className="material-symbols-rounded" aria-hidden="true">refresh</span> {t('common.refresh')}
                                        </button>
                                    </div>
                                    <div className="card-content">
                                        {invitations.length === 0 ? (
                                            <div className="u-center-text u-muted u-pad-lg">
                                                <span className="material-symbols-rounded u-empty-icon" aria-hidden="true">mail_outline</span>
                                                {t('admin.staff.noInvitations')} <strong>{t('admin.staff.invite')}</strong> {t('admin.staff.noInvitationsHint')}
                                            </div>
                                        ) : (
                                            <div className="data-table-wrap">
                                                <table className="data-table">
                                                    <thead>
                                                        <tr>
                                                            <th>{t('admin.staff.recipient')}</th>
                                                            <th>{t('common.role')}</th>
                                                            <th>{t('common.status')}</th>
                                                            <th>{t('common.sent')}</th>
                                                            <th>{t('common.actions')}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {invitations.map(inv => (
                                                            <tr key={inv.id}>
                                                                <td>
                                                                    <div className="adm-name">{`${inv.first_name || ''} ${inv.last_name || ''}`.trim() || '-'}</div>
                                                                    <div className="adm-sub">{inv.email}</div>
                                                                </td>
                                                                <td>{INVITE_ROLES.includes(inv.role) ? t(`admin.staff.roles.${inv.role}`) : (inv.role || '-')}</td>
                                                                <td>
                                                                    <span className={`adm-badge ${inviteStatusClass(inv)}`}>
                                                                        {t(`admin.staff.inviteStatus.${inviteStatusKey(inv)}`)}
                                                                    </span>
                                                                </td>
                                                                <td className="adm-sent-cell">
                                                                    {inv.created_at ? formatDate(inv.created_at) : '-'}
                                                                </td>
                                                                <td>
                                                                    {!inv.is_used && inv.status !== 'cancelled' && (
                                                                        <div className="u-flex u-gap-035">
                                                                            <button className="adm-btn" title={t('admin.staff.resend')} onClick={() => handleResend(inv.id)}>
                                                                                <span className="material-symbols-rounded" aria-hidden="true">forward_to_inbox</span>
                                                                            </button>
                                                                            <button className="adm-btn u-destructive" title={t('admin.staff.cancel')} onClick={() => handleCancel(inv.id)}>
                                                                                <span className="material-symbols-rounded" aria-hidden="true">cancel</span>
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
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
