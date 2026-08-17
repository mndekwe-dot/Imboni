import { useState, useEffect, useRef } from 'react'
import { changePassword, getProfile, updateProfile, uploadAvatar } from '../api/account'
import { getMyChildren } from '../api/parent'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Sidebar } from '../components/layout/Sidebar'
import { DashboardHeader } from '../components/layout/DashboardHeader'
import { useSessionUser } from '../hooks/useSessionUser'
import { useNotifications } from '../hooks/useNotifications'
import { TwoFactorSettings } from '../components/TwoFactorSettings'
import '../styles/layout.css'
import '../styles/components.css'
import '../styles/parent.css'
import { DashboardContent } from '../components/layout/DashboardContent'
import { dosNavItems, dosSecondaryItems } from './Dos/dosNav'
import { teacherNavItems, teacherSecondaryItems } from './Teacher/teacherNav'
import { studentNavItems, studentSecondaryItems } from './Student/studentNav'
import { parentNavItems, parentSecondaryItems } from './Parent/parentNav'
import { matronNavItems, matronSecondaryItems } from './Matron/matronNav'
import { disNavItems, disSecondaryItems } from './Dis/disNav'
import { adminNavItems, adminSecondaryItems } from './Admin/adminNav'
import { Loading } from '../components/ui/Loading'

// Lookup table — given a role string, returns the correct sidebar nav items.
// Each portal exports its own nav from its own file — one source of truth.
const NAV = {
    dos: { navItems: dosNavItems, secondaryItems: dosSecondaryItems },
    teacher: { navItems: teacherNavItems, secondaryItems: teacherSecondaryItems },
    student: { navItems: studentNavItems, secondaryItems: studentSecondaryItems },
    parent: { navItems: parentNavItems, secondaryItems: parentSecondaryItems },
    matron: { navItems: matronNavItems, secondaryItems: matronSecondaryItems },
    discipline: { navItems: disNavItems, secondaryItems: disSecondaryItems },
    admin: { navItems: adminNavItems, secondaryItems: adminSecondaryItems },
}

export function Account() {
    const { t } = useTranslation()
    // --- Profile state ---
    const [profile, setProfile] = useState(null)   // original data from server — never edited directly
    const [loading, setLoading] = useState(true)   // true while fetching profile from API
    const [form, setForm] = useState({ first_name: '', last_name: '', phone_number: '' }) // editable copy
    const [saving, setSaving] = useState(false)  // true while profile save request is running
    const [saved, setSaved] = useState(false)  // true for 3s after successful profile save

    // --- Sidebar nav ---
    // Role comes from URL (?role=dos) first, then localStorage, then empty string
    const [searchParams] = useSearchParams()
    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || 'null')
    const role = searchParams.get('role') || storedUser?.role || ''
    const { navItems = [], secondaryItems = [] } = NAV[role] ?? {}

    // Same header data source as every other page in the portal, so the
    // profile page's header matches the dashboard (proper role label, correct
    // avatar colour, notification bell, live date).
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()

    // Ref pointing to the hidden file input — used to trigger file picker from the button
    const avatarInputRef = useRef(null)

    // --- Password state ---
    const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm_password: '' })
    const [pwSaving, setPwSaving] = useState(false)  // true while password save request is running
    const [pwSaved, setPwSaved] = useState(false)  // true for 3s after successful password change
    const [pwError, setPwError] = useState('')      // error message shown below password form

    // Linked students, for parents. Only parents have any.
    const [children, setChildren] = useState(null)

    // Fetch real user data from the server when the page first loads.
    // Sets both profile (original) and form (editable copy) at the same time.
    useEffect(() => {
        getProfile()
            .then(data => {
                setProfile(data)
                setForm({
                    first_name: data.first_name ?? '',
                    last_name: data.last_name ?? '',
                    phone_number: data.phone_number ?? '',
                })
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (role !== 'parent') return
        getMyChildren()
            .then(data => setChildren(Array.isArray(data) ? data : []))
            .catch(() => setChildren([]))
    }, [role])

    // Show loading text while API call is in progress.
    // Prevents the form from flashing with empty inputs.
    if (loading) return <Loading fullPage />

    // Build initials from first and last name for the avatar circle e.g. "JN"
    const initials = profile
        ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`
        : '?'

    // Sends the edited form fields to the backend via PATCH.
    // Updates the header name immediately after success.
    async function handleProfileSave() {
        setSaving(true)
        try {
            const updated = await updateProfile(form)
            setProfile(updated)       // update original with what the server returned
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (err) {
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    // Validates passwords match before sending to backend.
    // Clears the form fields after a successful change.
    async function handlePasswordSave() {
        setPwError('')  // clear any previous error
        // Frontend validation — check before hitting the server
        if (pwForm.new_password !== pwForm.confirm_password) {
            setPwError('New password do not match')
            return  // stop here, do not call the API
        }
        setPwSaving(true)
        try {
            await changePassword(pwForm)
            setPwSaved(true)
            setPwForm({ old_password: '', new_password: '', confirm_password: '' }) // clear fields
            setTimeout(() => setPwSaved(false), 3000)
        } catch (err) {
            setPwError(err.message)  // show server error e.g. "Wrong current password"
        } finally {
            setPwSaving(false)
        }
    }
    async function handleAvatarChange(e) {
        const file = e.target.files[0]
        if (!file) return
        try {
            const updated = await uploadAvatar(file)
            setProfile(updated)
        } catch (err) {
            console.error(err)
        }

    }
    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={navItems} secondaryItems={secondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('account.title')}
                        subtitle={t('account.subtitle')}
                        userName={profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || sessionUser.userName : sessionUser.userName}
                        userRole={sessionUser.userRole}
                        userInitials={initials !== '?' ? initials.toUpperCase() : sessionUser.userInitials}
                        avatarClass={sessionUser.avatarClass}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>
                        <div className="account-settings-grid">

                            {/* Settings sidebar nav */}
                            <aside className="card settings-nav-card">
                                <nav className="settings-nav-list">
                                    <a href="#profile" className="settings-nav-item active">
                                        <span className="material-symbols-rounded">person</span> {t('account.navProfile')}
                                    </a>
                                    <a href="#security" className="settings-nav-item">
                                        <span className="material-symbols-rounded">lock</span> {t('account.navSecurity')}
                                    </a>
                                    <a href="#notifications" className="settings-nav-item">
                                        <span className="material-symbols-rounded">notifications</span> {t('account.navNotifications')}
                                    </a>
                                    {role === 'parent' && (
                                        <a href="#family" className="settings-nav-item">
                                            <span className="material-symbols-rounded">family_restroom</span> {t('account.navFamily')}
                                        </a>
                                    )}
                                </nav>
                            </aside>

                            <div className="settings-sections">

                                {/* Personal Profile */}
                                <section id="profile" className="card settings-section-card">
                                    <div className="settings-card-header">
                                        <h3>{t('account.navProfile')}</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="profile-upload-container">
                                            <div className="avatar-large">{initials}</div>
                                            {/* Hidden file input — triggered by the button below */}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                ref={avatarInputRef}
                                                className="u-hidden"
                                                onChange={handleAvatarChange}
                                            />
                                            {/* Clicking this button opens the file picker */}
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => avatarInputRef.current.click()}
                                            >
                                                {t('account.changePhoto')}
                                            </button>
                                        </div>

                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">{t('modals.disStaff.fullName')}</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={form.first_name + ' ' + form.last_name}
                                                    onChange={e => {
                                                        const [first, ...rest] = e.target.value.split(' ')
                                                        setForm(f => ({ ...f, first_name: first, last_name: rest.join(' ') }))
                                                    }}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">{t('common.emailAddress')}</label>
                                                <input type="email" className="form-input" value={profile?.email ?? ''} />
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">{t('common.phoneNumber')}</label>
                                                <input
                                                    type="tel"
                                                    className="form-input"
                                                    value={form.phone_number ?? ''}
                                                    onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">{t('common.role')}</label>
                                                <input type="text" className="form-input" value={profile?.role ?? ''} readOnly />
                                            </div>
                                        </div>
                                        <div className="form-actions">
                                            <button
                                                className="btn btn-primary"
                                                onClick={handleProfileSave}
                                                disabled={saving}
                                            >{saved ? t('account.savedShort') : saving ? t('common.saving') : t('account.updateProfile')}</button>
                                        </div>
                                    </div>
                                </section>

                                {/* Security */}
                                <section id="security" className="card settings-section-card">
                                    <div className="settings-card-header">
                                        <h3>{t('account.navSecurity')}</h3>
                                    </div>
                                    <div className="card-content">
                                        {pwError && (
                                            <p className="u-danger u-mb">{pwError}</p>
                                        )}
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">{t('account.currentPassword')}</label>
                                                <input
                                                    type="password"
                                                    className="form-input"
                                                    placeholder={t('account.enterCurrentPassword')}
                                                    value={pwForm.old_password}
                                                    onChange={e => setPwForm(f => ({ ...f, old_password: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">{t('account.newPassword')}</label>
                                                <input
                                                    type="password"
                                                    className="form-input"
                                                    placeholder={t('account.enterNewPassword')}
                                                    value={pwForm.new_password}
                                                    onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('account.confirmNewPassword')}</label>
                                            <input
                                                type="password"
                                                className="form-input"
                                                placeholder={t('account.confirmNewPasswordPlaceholder')}
                                                value={pwForm.confirm_password}
                                                onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                                            />
                                        </div>
                                        <div className="form-actions">
                                            <button
                                                className="btn btn-primary"
                                                onClick={handlePasswordSave}
                                                disabled={pwSaving}
                                            >
                                                {pwSaved ? t('account.passwordChanged') : pwSaving ? t('common.saving') : t('account.changePassword')}
                                            </button>
                                        </div>

                                        <TwoFactorSettings />
                                    </div>
                                </section>


                                {/* Notifications */}
                                <section id="notifications" className="card settings-section-card">
                                    <div className="settings-card-header">
                                        <h3>{t('account.navNotifications')}</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="notif-list">
                                            {[
                                                { label: t('account.notifMessages'),      desc: t('account.notifMessagesDesc')      },
                                                { label: t('account.notifAnnouncements'), desc: t('account.notifAnnouncementsDesc') },
                                                { label: t('account.notifResults'),       desc: t('account.notifResultsDesc')       },
                                                { label: t('account.notifDiscipline'),    desc: t('account.notifDisciplineDesc')    },
                                            ].map((item) => (
                                                <div key={item.label} className="notif-row">
                                                    <div>
                                                        <div className="notif-label">{item.label}</div>
                                                        <div className="notif-desc">{item.desc}</div>
                                                    </div>
                                                    <label className="toggle-wrap">
                                                        <input type="checkbox" defaultChecked />
                                                        <span className="toggle-thumb"></span>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="form-actions">
                                            <button className="btn btn-primary">{t('account.savePreferences')}</button>
                                        </div>
                                    </div>
                                </section>

                                {/* Linked family / billing */}
                                {/* Linked students — parents only.
                                    This block used to render two invented
                                    children ("Uwase Amina · ID 2024-001",
                                    "Ishimwe Jean · ID 2024-042") to every user
                                    of every role, alongside a Link New Student
                                    button wired to nothing. The real list comes
                                    from /parents/my-children/. */}
                                {role === 'parent' && (
                                    <section id="family" className="card settings-section-card">
                                        <div className="settings-card-header">
                                            <h3>{t('account.navFamily')}</h3>
                                        </div>
                                        <div className="card-content">
                                            {children === null ? (
                                                <p className="u-muted u-sm">{t('account.loadingChildren')}</p>
                                            ) : children.length === 0 ? (
                                                <p className="u-muted u-sm">{t('account.noChildren')}</p>
                                            ) : (
                                                <div className="linked-children-list">
                                                    {children.map(child => (
                                                        <div key={child.id} className="linked-child-item">
                                                            <div className="child-brief">
                                                                <div className="avatar-sm">
                                                                    {(child.student_name || '')
                                                                        .split(' ').filter(Boolean).slice(0, 2)
                                                                        .map(w => w[0]).join('').toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="name">{child.student_name}</p>
                                                                    <p className="id-tag">
                                                                        {t('account.childIdTag', {
                                                                            class: `${child.grade ?? ''}${child.section ?? ''}`,
                                                                            id: child.student_id ?? '-',
                                                                        })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                )}

                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
