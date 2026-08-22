import { useState, useEffect, useRef } from 'react'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../utils/errors'
import { changePassword, getProfile, updateProfile, uploadAvatar,
         getMyPreferences, updateMyPreferences } from '../api/account'
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher'
import { PageLoading } from '../components/layout/PageLoading'
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

// The settings tabs, in display order. `family` is filtered out for everyone
// except parents — see TABS_FOR below.
const TABS = [
    { id: 'profile',       icon: 'person',           labelKey: 'account.navProfile'       },
    { id: 'security',      icon: 'lock',             labelKey: 'account.navSecurity'      },
    { id: 'notifications', icon: 'notifications',    labelKey: 'account.navNotifications' },
    { id: 'language',      icon: 'translate',        labelKey: 'language.label'           },
    { id: 'family',        icon: 'family_restroom',  labelKey: 'account.navFamily'        },
]
// The three booleans UserPreferences actually has. Keep this list and the
// model in step: a row here with no field behind it is a switch that forgets.
const NOTIF_CHANNELS = [
    { field: 'notification_email', labelKey: 'account.notifEmail', descKey: 'account.notifEmailDesc' },
    { field: 'notification_sms',   labelKey: 'account.notifSms',   descKey: 'account.notifSmsDesc'   },
    { field: 'notification_push',  labelKey: 'account.notifPush',  descKey: 'account.notifPushDesc'  },
]

const TABS_FOR = role => TABS.filter(tab => tab.id !== 'family' || role === 'parent')

export function Account() {
    const { t } = useTranslation()
    const toast = useToast()
    // --- Profile state ---
    const [profile, setProfile] = useState(null)   // original data from server — never edited directly
    const [loading, setLoading] = useState(true)   // true while fetching profile from API
    const [form, setForm] = useState({ first_name: '', last_name: '', phone_number: '' }) // editable copy
    const [saving, setSaving] = useState(false)  // true while profile save request is running
    const [saved, setSaved] = useState(false)  // true for 3s after successful profile save
    const [tab, setTab] = useState('profile')  // which settings panel is showing
    const [dragging, setDragging] = useState(false)  // photo drop zone is hovered
    const [prefs, setPrefs] = useState(null)         // null until loaded from the server
    const [prefsSaving, setPrefsSaving] = useState(false)

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

    // Notification channels come from the same preferences row as language.
    useEffect(() => {
        getMyPreferences()
            .then(data => setPrefs({
                notification_email: !!data?.notification_email,
                notification_sms: !!data?.notification_sms,
                notification_push: !!data?.notification_push,
            }))
            .catch(err => toast.error(errorMessage(err, t('common.loadFailed'))))
    }, [])   // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (role !== 'parent') return
        getMyChildren()
            .then(data => setChildren(Array.isArray(data) ? data : []))
            .catch(() => setChildren([]))
    }, [role])

    // Show loading text while API call is in progress.
    // Prevents the form from flashing with empty inputs.
    if (loading) return (
        <PageLoading
            navItems={navItems} secondaryItems={secondaryItems}
            title={t('account.title')}
            subtitle={t('account.subtitle')}
            user={sessionUser}
        />
    )
    // Build initials from first and last name for the avatar circle e.g. "JN"
    const initials = profile
        ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`
        : '?'

    // True when the form no longer matches what the server last gave us.
    const dirty = !!profile && (
        form.first_name !== (profile.first_name ?? '') ||
        form.last_name !== (profile.last_name ?? '') ||
        form.phone_number !== (profile.phone_number ?? '')
    )

    function resetForm() {
        setForm({
            first_name: profile?.first_name ?? '',
            last_name: profile?.last_name ?? '',
            phone_number: profile?.phone_number ?? '',
        })
    }

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
            // A silent console.error left the user staring at a form that
            // looked saved and was not.
            toast.error(errorMessage(err, t('account.saveFailed')))
        } finally {
            setSaving(false)
        }
    }

    async function handlePrefsSave() {
        setPrefsSaving(true)
        try {
            // PATCH, so sending only these three leaves language and theme alone.
            await updateMyPreferences(prefs)
            toast.success(t('account.prefsSaved'))
        } catch (err) {
            toast.error(errorMessage(err, t('account.prefsFailed')))
        } finally {
            setPrefsSaving(false)
        }
    }

    // Validates passwords match before sending to backend.
    // Clears the form fields after a successful change.
    async function handlePasswordSave() {
        setPwError('')  // clear any previous error
        // Frontend validation — check before hitting the server
        if (pwForm.new_password !== pwForm.confirm_password) {
            setPwError(t('account.passwordsDoNotMatch'))
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
    // Shared by the file picker and the drop zone.
    async function uploadPhoto(file) {
        if (!file) return
        try {
            const updated = await uploadAvatar(file)
            setProfile(updated)
        } catch (err) {
            // The server enforces JPG/PNG and a 2 MB ceiling; its message says
            // which rule was broken, so prefer it over a generic one.
            toast.error(errorMessage(err, t('account.avatarFailed')))
        }
    }

    const handleAvatarChange = e => uploadPhoto(e.target.files[0])

    function handleDrop(e) {
        e.preventDefault()
        setDragging(false)
        uploadPhoto(e.dataTransfer.files?.[0])
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

                            {/* Tabs, not anchors. The old list scrolled a single
                                long column, so Security and Language sat below
                                the fold on every visit. Each panel now stands
                                alone and the set is short enough to read at a
                                glance. */}
                            <div className="settings-tabs" role="tablist" aria-label={t('account.title')}>
                                {TABS_FOR(role).map(item => (
                                    <button
                                        key={item.id}
                                        role="tab"
                                        type="button"
                                        id={`tab-${item.id}`}
                                        aria-selected={tab === item.id}
                                        aria-controls={`panel-${item.id}`}
                                        className={`settings-tab${tab === item.id ? ' active' : ''}`}
                                        onClick={() => setTab(item.id)}
                                    >
                                        <span className="material-symbols-rounded" aria-hidden="true">{item.icon}</span>
                                        {t(item.labelKey)}
                                    </button>
                                ))}
                            </div>

                            <div className="settings-sections">

                                {/* Personal Profile */}
                                {tab === 'profile' && (
                                <section id="panel-profile" role="tabpanel" aria-labelledby="tab-profile"
                                         className="card settings-section-card">
                                    <div className="settings-card-header">
                                        <div>
                                            <h3>{t('account.personalInfo')}</h3>
                                            <p className="settings-card-sub">{t('account.personalInfoDesc')}</p>
                                        </div>
                                        <div className="settings-card-actions">
                                            <button type="button" className="btn btn-outline"
                                                    onClick={resetForm} disabled={!dirty || saving}>
                                                {t('common.cancel')}
                                            </button>
                                            <button type="button" className="btn btn-primary"
                                                    onClick={handleProfileSave} disabled={!dirty || saving}>
                                                {saved ? t('account.savedShort') : saving ? t('common.saving') : t('common.save')}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="card-content">

                                        {/* Two fields, because the backend stores two.
                                            This was one "Full Name" box split on the first
                                            space, so "Uwase Amina Grace" saved a last name
                                            of "Amina Grace" and a one-word name wiped it. */}
                                        <div className="settings-row">
                                            <label className="settings-row-label" htmlFor="first-name">
                                                {t('common.name')}
                                            </label>
                                            <div className="settings-row-field settings-row-field--split">
                                                <input
                                                    id="first-name"
                                                    type="text"
                                                    className="form-input"
                                                    aria-label={t('account.firstName')}
                                                    placeholder={t('account.firstName')}
                                                    value={form.first_name}
                                                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                                                />
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    aria-label={t('account.lastName')}
                                                    placeholder={t('account.lastName')}
                                                    value={form.last_name}
                                                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        <div className="settings-row">
                                            <label className="settings-row-label" htmlFor="account-email">
                                                {t('common.emailAddress')}
                                                <span className="settings-row-hint">{t('account.emailFromSchool')}</span>
                                            </label>
                                            <div className="settings-row-field">
                                                {/* readOnly, not merely value-without-onChange:
                                                    that rendered an input the user could not type
                                                    in and React warned about every render. */}
                                                <input id="account-email" type="email" className="form-input"
                                                       value={profile?.email ?? ''} readOnly />
                                            </div>
                                        </div>

                                        <div className="settings-row">
                                            <div className="settings-row-label">
                                                {t('account.photoLabel')}
                                                <span className="settings-row-hint">{t('account.photoDesc')}</span>
                                            </div>
                                            <div className="settings-row-field settings-row-field--photo">
                                                {profile?.avatar
                                                    ? <img className="avatar-large" src={profile.avatar} alt="" />
                                                    : <div className="avatar-large">{initials}</div>}
                                                <input
                                                    type="file"
                                                    // Narrower than the old image/*: the server accepts
                                                    // only these two, so offering more just moves the
                                                    // rejection to after the upload.
                                                    accept="image/png,image/jpeg"
                                                    ref={avatarInputRef}
                                                    className="u-hidden"
                                                    onChange={handleAvatarChange}
                                                />
                                                <div
                                                    className={`upload-drop${dragging ? ' dragging' : ''}`}
                                                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                                                    onDragLeave={() => setDragging(false)}
                                                    onDrop={handleDrop}
                                                >
                                                    <span className="material-symbols-rounded upload-drop-icon" aria-hidden="true">upload</span>
                                                    <p className="upload-drop-text">
                                                        <button type="button" className="upload-drop-link"
                                                                onClick={() => avatarInputRef.current.click()}>
                                                            {t('account.uploadClick')}
                                                        </button>{' '}{t('account.uploadOrDrag')}
                                                    </p>
                                                    <p className="upload-drop-hint">{t('account.uploadHint')}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="settings-row">
                                            <label className="settings-row-label" htmlFor="account-phone">
                                                {t('common.phoneNumber')}
                                            </label>
                                            <div className="settings-row-field">
                                                <input
                                                    id="account-phone"
                                                    type="tel"
                                                    className="form-input"
                                                    value={form.phone_number ?? ''}
                                                    onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        <div className="settings-row">
                                            <label className="settings-row-label" htmlFor="account-role">
                                                {t('common.role')}
                                                <span className="settings-row-hint">{t('account.roleFromSchool')}</span>
                                            </label>
                                            <div className="settings-row-field">
                                                <input id="account-role" type="text" className="form-input"
                                                       value={profile?.role ?? ''} readOnly />
                                            </div>
                                        </div>

                                        {dirty && <p className="settings-dirty">{t('account.unsavedHint')}</p>}
                                    </div>
                                </section>
                                )}

                                {/* Security */}
                                {tab === 'security' && (
                                <section id="panel-security" role="tabpanel" aria-labelledby="tab-security"
                                         className="card settings-section-card">
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
                                )}


                                {/* Notifications */}
                                {tab === 'notifications' && (
                                <section id="panel-notifications" role="tabpanel" aria-labelledby="tab-notifications"
                                         className="card settings-section-card">
                                    <div className="settings-card-header">
                                        <div>
                                            <h3>{t('account.navNotifications')}</h3>
                                            <p className="settings-card-sub">{t('account.notifIntro')}</p>
                                        </div>
                                        <div className="settings-card-actions">
                                            <button type="button" className="btn btn-primary"
                                                    onClick={handlePrefsSave}
                                                    disabled={prefsSaving || prefs === null}>
                                                {prefsSaving ? t('common.saving') : t('account.savePreferences')}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="card-content">
                                        {prefs === null ? (
                                            <p className="u-muted u-sm">{t('common.loading')}</p>
                                        ) : (
                                            <div className="notif-list">
                                                {/* One row per delivery channel, because that is what
                                                    UserPreferences actually stores. This was four rows
                                                    by topic — messages, announcements, results,
                                                    discipline — with nowhere to save them, every switch
                                                    hardcoded on and a Save button wired to nothing. */}
                                                {NOTIF_CHANNELS.map(channel => (
                                                    <div key={channel.field} className="notif-row">
                                                        <div>
                                                            <div className="notif-label" id={`notif-${channel.field}`}>
                                                                {t(channel.labelKey)}
                                                            </div>
                                                            <div className="notif-desc">{t(channel.descKey)}</div>
                                                        </div>
                                                        <label className="toggle-wrap">
                                                            <input
                                                                type="checkbox"
                                                                aria-labelledby={`notif-${channel.field}`}
                                                                checked={!!prefs[channel.field]}
                                                                onChange={e => setPrefs(p => ({
                                                                    ...p, [channel.field]: e.target.checked,
                                                                }))}
                                                            />
                                                            <span className="toggle-thumb"></span>
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </section>
                                )}

                                {/* Language.
                                    Also reachable from the sidebar and, signed
                                    out, from the login page — this is the
                                    deliberate home for it, not the only one.
                                    Saving here writes to the account, so the
                                    choice follows the user to another device. */}
                                {tab === 'language' && (
                                <section id="panel-language" role="tabpanel" aria-labelledby="tab-language"
                                         className="card settings-section-card">
                                    <div className="settings-card-header">
                                        <h3>{t('language.label')}</h3>
                                    </div>
                                    <div className="card-content">
                                        <LanguageSwitcher />
                                    </div>
                                </section>
                                )}

                                {/* Linked family / billing */}
                                {/* Linked students — parents only.
                                    This block used to render two invented
                                    children ("Uwase Amina · ID 2024-001",
                                    "Ishimwe Jean · ID 2024-042") to every user
                                    of every role, alongside a Link New Student
                                    button wired to nothing. The real list comes
                                    from /parents/my-children/. */}
                                {role === 'parent' && tab === 'family' && (
                                    <section id="panel-family" role="tabpanel" aria-labelledby="tab-family" className="card settings-section-card">
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
