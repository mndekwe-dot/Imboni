import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { StatCard } from '../../components/layout/StatCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { SearchBar } from '../../components/ui/SearchBar'
import { StaffModal } from '../../components/modals/StaffModal'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { getDisStaff, createDisStaff, updateDisStaff } from '../../api/discipline'
import { disNavItems, disSecondaryItems } from './disNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'

/**
 * The staff a Discipline Director supervises.
 *
 * What was here before put "Add Staff" as a loose full-width button wedged
 * between the Matrons heading and the Matrons grid — so it read as an action on
 * the matrons alone, while it in fact adds either kind. It now sits in the
 * toolbar beside the search field, at its own width, above BOTH sections; and
 * the two sections below are the same shape as each other: heading, count, and
 * a grid of the same card.
 *
 * Two card components that differed by a colour and one meta line have become
 * one. Failures were `console.error` and nothing else — adding a matron that
 * the server rejected looked exactly like adding one that worked.
 */

const STAFF_TYPES = {
    head_matron: { roleKey: 'dis.staff.headMatron', avatar: 'matron' },
    matron:      { roleKey: 'dis.staff.matron',     avatar: 'matron' },
    patron:      { roleKey: 'dis.staff.patron',     avatar: 'patron' },
}

const MATRON_TYPES = ['matron', 'head_matron']

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function StaffCard({ staff, onEdit }) {
    const { t } = useTranslation()
    const { full_name, email, assigned_dormitory, assigned_grade, staff_type } = staff
    const meta = STAFF_TYPES[staff_type] || STAFF_TYPES.patron
    const posting = assigned_dormitory || assigned_grade || t('dis.staff.unassigned')

    return (
        <div className="staff-card">
            <div className="staff-card-top">
                <div className={`staff-card-avatar ${meta.avatar}`}>{initials(full_name)}</div>
                <div>
                    <div className="staff-card-name">{full_name}</div>
                    <div className="staff-card-role">{t(meta.roleKey)} ({posting})</div>
                </div>
            </div>
            <div className="staff-card-meta">
                {email && <span><span className="material-symbols-rounded">mail</span>{email}</span>}
                {assigned_dormitory && <span><span className="material-symbols-rounded">home</span>{assigned_dormitory}</span>}
                {assigned_grade && <span><span className="material-symbols-rounded">school</span>{assigned_grade}</span>}
            </div>
            <div className="staff-card-actions">
                {/* Opens the thread with THIS person, not the message list.
                    Landing on the list meant finding by name, in a dialog, the
                    colleague whose card you had just clicked. Falls back to the
                    list for a staff record with no account behind it. */}
                <Link
                    to={staff.user_id ? `/discipline/messages?with=${staff.user_id}` : '/discipline/messages'}
                    className="btn btn-sm btn-primary"
                >
                    <span className="material-symbols-rounded icon-sm">chat</span> {t('nav.messages')}
                </Link>
                <button className="btn btn-sm btn-outline" onClick={onEdit}>
                    <span className="material-symbols-rounded icon-sm">edit</span> {t('common.edit')}
                </button>
            </div>
        </div>
    )
}

/** Heading, count, and either a grid of cards or a proper empty state. */
function StaffSection({ icon, title, count, countLabel, staff, emptyTitle, emptyDesc, onAdd, addLabel, onEdit }) {
    return (
        <section className="mb-1-5">
            <div className="disc-section-header">
                <div className="disc-section-title">
                    <span className="material-symbols-rounded" aria-hidden="true">{icon}</span> {title}
                </div>
                <span className="badge">{countLabel}</span>
            </div>
            {count === 0 ? (
                <EmptyState
                    icon={icon}
                    title={emptyTitle}
                    description={emptyDesc}
                    action={{ label: addLabel, icon: 'person_add', onClick: onAdd }}
                />
            ) : (
                <div className="staff-cards-grid">
                    {staff.map(s => <StaffCard key={s.id} staff={s} onEdit={() => onEdit(s)} />)}
                </div>
            )}
        </section>
    )
}

export function DisStaff() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const toast = useToast()

    const [staff,        setStaff]        = useState([])
    const [loading,      setLoading]      = useState(true)
    const [search,       setSearch]       = useState('')
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingStaff, setEditingStaff] = useState(null)

    useEffect(() => {
        getDisStaff()
            .then(data => setStaff(Array.isArray(data) ? data : []))
            .catch(e => toast.error(errorMessage(e, t('dis.staff.loadFailed'))))
            .finally(() => setLoading(false))
    }, [toast, t])

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return staff
        return staff.filter(s =>
            (s.full_name || '').toLowerCase().includes(q)
            || (s.email || '').toLowerCase().includes(q)
            || (s.assigned_dormitory || '').toLowerCase().includes(q))
    }, [staff, search])

    const matrons = visible.filter(s => MATRON_TYPES.includes(s.staff_type))
    const patrons = visible.filter(s => s.staff_type === 'patron')

    const stats = [
        { colorClass: 'info',    icon: 'home',               value: staff.filter(s => MATRON_TYPES.includes(s.staff_type)).length, label: t('dis.staff.boardingMatrons') },
        { colorClass: 'success', icon: 'emoji_events',       value: staff.filter(s => s.staff_type === 'patron').length,           label: t('dis.staff.activityPatrons') },
        { colorClass: '',        icon: 'meeting_room',       value: new Set(staff.map(s => s.assigned_dormitory).filter(Boolean)).size, label: t('common.dormitory') },
        { colorClass: 'warning', icon: 'person_off',         value: staff.filter(s => !s.assigned_dormitory && !s.assigned_grade).length, label: t('dis.staff.unassigned') },
    ]

    async function handleCreate(data) {
        try {
            const created = await createDisStaff(data)
            setStaff(prev => [created, ...prev])
            toast.success(t('dis.staff.added', { name: created.full_name }))
        } catch (e) {
            toast.error(errorMessage(e, t('dis.staff.saveFailed')))
        }
    }

    async function handleUpdate(id, data) {
        try {
            const updated = await updateDisStaff(id, data)
            setStaff(prev => prev.map(s => s.id === id ? updated : s))
            toast.success(t('common.saved'))
        } catch (e) {
            toast.error(errorMessage(e, t('dis.staff.saveFailed')))
        }
    }

    return (
        <>
            {showAddModal && (
                <StaffModal onClose={() => setShowAddModal(false)} onSave={(data) => { handleCreate(data); setShowAddModal(false) }} />
            )}
            {editingStaff && (
                <StaffModal
                    staff={{
                        name: editingStaff.full_name,
                        role: t((STAFF_TYPES[editingStaff.staff_type] || STAFF_TYPES.patron).roleKey),
                        email: editingStaff.email,
                    }}
                    onClose={() => setEditingStaff(null)}
                    onSave={(data) => { handleUpdate(editingStaff.id, data); setEditingStaff(null) }}
                />
            )}
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('dis.staff.title')}
                        subtitle={t('dis.staff.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>

                        {loading ? (
                            <p className="u-pad u-muted">{t('dis.staff.loading')}</p>
                        ) : (
                            <>
                                <div className="portal-stat-grid mb-5">
                                    {stats.map((s, i) => <StatCard key={i} {...s} />)}
                                </div>

                                {/* Search and the page's one action share the
                                    toolbar. The button used to sit loose between
                                    the Matrons heading and the Matrons grid, where
                                    it read as an action on matrons alone and
                                    stretched to the full width of the page. */}
                                <div className="toolbar-card mb-1-5">
                                    <SearchBar
                                        value={search}
                                        onChange={setSearch}
                                        placeholder={t('dis.staff.searchPlaceholder')}
                                    />
                                    <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                                        <span className="material-symbols-rounded icon-sm">person_add</span> {t('dis.staff.addStaff')}
                                    </button>
                                </div>

                                <StaffSection
                                    icon="home"
                                    title={t('dis.staff.boardingMatrons')}
                                    count={matrons.length}
                                    countLabel={t('dis.staff.countMatrons', { count: matrons.length })}
                                    staff={matrons}
                                    emptyTitle={t('dis.staff.noMatrons')}
                                    emptyDesc={t('dis.staff.noMatronsDesc')}
                                    addLabel={t('dis.staff.addMatron')}
                                    onAdd={() => setShowAddModal(true)}
                                    onEdit={setEditingStaff}
                                />

                                <StaffSection
                                    icon="emoji_events"
                                    title={t('dis.staff.activityPatrons')}
                                    count={patrons.length}
                                    countLabel={t('dis.staff.countPatrons', { count: patrons.length })}
                                    staff={patrons}
                                    emptyTitle={t('dis.staff.noPatrons')}
                                    emptyDesc={t('dis.staff.noPatronsDesc')}
                                    addLabel={t('dis.staff.addPatron')}
                                    onAdd={() => setShowAddModal(true)}
                                    onEdit={setEditingStaff}
                                />
                            </>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
