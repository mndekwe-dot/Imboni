import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { NewActivityModal } from '../../components/modals/NewActivityModal'
import { EditActivityModal } from '../../components/modals/EditActivityModal'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { yearsFromConfig, yearLabel } from '../../utils/classes'
import { disNavItems, disSecondaryItems } from './disNav'
import { getDisActivities, createDisActivity, getConsentRequests, createConsentRequest } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import '../../styles/tables.css'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { StatCard } from '../../components/layout/StatCard'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'

/* Category keys, resolved inside the component. As plain strings the whole
   filter row stayed English under the language switch. */
const CATEGORY_KEYS = {
    sports:   'dis.studentLife.catSports',
    arts:     'dis.activities.catArts',
    academic: 'dis.activities.catAcademic',
    social:   'dis.activities.catSocial',
    science:  'dis.studentLife.catScience',
    other:    'dis.studentLife.catOther',
}

/* The stored category when the school has one this list does not know. */
const categoryLabel = (t, value) =>
    (CATEGORY_KEYS[value] ? t(CATEGORY_KEYS[value]) : (value || t('dis.studentLife.catOther')))

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function avClass(category) {
    return ['arts', 'social'].includes(category) ? 'matron' : 'patron'
}

function ActivityCard({ activity, onEdit }) {
    const { t } = useTranslation()
    const { name, category, teacher_name, schedule, venue, enrolled_count, max_members, is_full, is_active } = activity
    const catLabel = categoryLabel(t, category)
    const badge    = is_active ? t('dis.activities.active') : t('dis.activities.inactive')
    const badgeCls = is_active ? 'active' : ''
    const full     = is_full ? ` (${t('dis.studentLife.full')})` : ` / ${max_members}`

    return (
        <div className="staff-card" data-cat={category}>
            <div className="staff-card-top">
                <div className={`staff-card-avatar ${avClass(category)}`}>{initials(name)}</div>
                <div>
                    <div className="staff-card-name">{name}</div>
                    <div className="staff-card-role">{catLabel} &bull; Patron: {teacher_name || '-'}</div>
                </div>
                <span className={`pub-badge ${badgeCls} ml-auto`}>{badge}</span>
            </div>
            <div className="staff-card-meta">
                <span><span className="material-symbols-rounded">groups</span>{enrolled_count} enrolled{full}</span>
                {schedule && <span><span className="material-symbols-rounded">schedule</span>{schedule}</span>}
                {venue    && <span><span className="material-symbols-rounded">location_on</span>{venue}</span>}
            </div>
            <div className="staff-card-actions">
                <button className="btn btn-primary btn-sm" onClick={onEdit}>
                    <span className="material-symbols-rounded">edit</span> Edit
                </button>
            </div>
        </div>
    )
}

function ConsentRequestsPanel() {
    const { t } = useTranslation()
    const { config } = useSchoolConfig()
    const years = yearsFromConfig(config)

    const [requests, setRequests] = useState([])
    const [loading, setLoading]   = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ title: '', description: '', event_date: '', response_deadline: '', grade: '' })
    const [saving, setSaving]     = useState(false)
    const [error, setError]       = useState(null)

    function load() {
        getConsentRequests()
            .then(data => setRequests(Array.isArray(data) ? data : []))
            .catch(() => setRequests([]))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [])

    async function handleCreate() {
        if (!form.title.trim() || !form.description.trim() || !form.event_date) {
            setError(t('common.formFieldsRequired'))
            return
        }
        setSaving(true); setError(null)
        try {
            await createConsentRequest({
                title: form.title.trim(),
                description: form.description.trim(),
                event_date: form.event_date,
                response_deadline: form.response_deadline || null,
                grade: form.grade,
            })
            setForm({ title: '', description: '', event_date: '', response_deadline: '', grade: '' })
            setShowForm(false)
            load()
        } catch {
            setError(t('dis.activities.createRequestFailed'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="card mb-1-5">
            <div className="card-header">
                {/* This panel is about parental CONSENT, not clubs. It was
                    headed with the page title and its button said "New Club",
                    both of which described the grid further down the page. */}
                <h2 className="card-title">
                    <span className="material-symbols-rounded">approval</span>
                    {t('dis.activities.consentTitle')}
                </h2>
                <button className="btn btn-outline btn-sm" onClick={() => setShowForm(s => !s)}>
                    <span className="material-symbols-rounded icon-sm">{showForm ? 'expand_less' : 'add'}</span>
                    {showForm ? t('common.cancel') : t('dis.activities.newRequest')}
                </button>
            </div>
            <div className="card-content">
                {showForm && (
                    <div className="cr-form">
                        <div className="cr-col-full">
                            <label className="form-label" htmlFor="cr-title">{t('dis.activities.titleLabel')}</label>
                            <input id="cr-title" className="form-input" placeholder={t('dis.activities.titlePlaceholder')}
                                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div className="cr-col-full">
                            <label className="form-label" htmlFor="cr-desc">{t('dis.activities.descriptionLabel')}</label>
                            <textarea id="cr-desc" className="form-input form-textarea" rows="2"
                                placeholder={t('dis.activities.descriptionPlaceholder')}
                                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="cr-date">{t('dis.activities.eventDateLabel')}</label>
                            <input id="cr-date" type="date" className="form-input"
                                value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="cr-deadline">{t('dis.activities.deadlineLabel')}</label>
                            <input id="cr-deadline" type="date" className="form-input"
                                value={form.response_deadline} onChange={e => setForm(f => ({ ...f, response_deadline: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="cr-grade">{t('dis.activities.gradeLabel')}</label>
                            <select id="cr-grade" className="form-select" value={form.grade}
                                onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}>
                                <option value="">{t('dis.activities.allGrades')}</option>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="cr-actions">
                            <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={saving}>
                                {saving ? t('dis.activities.sendingButton') : t('dis.activities.sendButton')}
                            </button>
                        </div>
                        {error && <p className="cr-error">{error}</p>}
                    </div>
                )}

                {loading ? (
                    <p className="u-muted">{t('dis.activities.loadingRequests')}</p>
                ) : requests.length === 0 ? (
                    <p className="u-muted">
                        {t('dis.activities.empty')}
                    </p>
                ) : (
                    <div className="cr-list">
                        {requests.map(req => (
                            <div key={req.id} className="cr-req">
                                <div className="cr-req-main">
                                    <div className="u-strong u-sm">{req.title}</div>
                                    <div className="text-xs-muted">
                                        {req.event_date} · {req.grade ? yearLabel(req.grade) : t('dis.activities.allGrades')}
                                        {req.response_deadline && ` · respond by ${req.response_deadline}`}
                                    </div>
                                </div>
                                <span className="cr-count-approved">
                                    {req.approved ?? 0} approved
                                </span>
                                <span className="cr-count-declined">
                                    {req.declined ?? 0} declined
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export function DisActivities() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const toast = useToast()

    /* Built here rather than at module scope so the labels follow the language
       switch; as a module constant the whole row stayed English. */
    const filterOptions = useMemo(() => [
        { key: 'all', label: t('dis.studentLife.allActivities') },
        ...Object.keys(CATEGORY_KEYS).map(key => ({ key, label: categoryLabel(t, key) })),
    ], [t])

    const [activities,      setActivities]      = useState([])
    const [loading,         setLoading]         = useState(true)
    const [filter,          setFilter]          = useState('all')
    const [showNew,         setShowNew]         = useState(false)
    const [editingActivity, setEditingActivity] = useState(null)

    useEffect(() => {
        getDisActivities()
            .then(data => setActivities(Array.isArray(data) ? data : []))
            .catch(e => toast.error(errorMessage(e, t('dis.activities.loadFailed'))))
            .finally(() => setLoading(false))
    }, [toast, t])

    async function handleCreate(form) {
        try {
            const created = await createDisActivity(form)
            setActivities(prev => [created, ...prev])
            toast.success(t('common.saved'))
        } catch (e) {
            toast.error(errorMessage(e, t('dis.activities.saveFailed')))
        }
        setShowNew(false)
    }

    function handleSaveEdit(updated) {
        setActivities(prev => prev.map(a => a.id === editingActivity.id ? { ...a, ...updated } : a))
        setEditingActivity(null)
    }

    const visible = activities.filter(a =>
        (filter === 'all' || a.category === filter) && a.is_active !== false
    )

    const stats = [
        { iconClass: 'info',    icon: 'emoji_events',       value: activities.filter(a => a.is_active).length, label: t('dis.activities.activeClubs') },
        { iconClass: 'success', icon: 'groups',             value: activities.reduce((s, a) => s + (a.enrolled_count || 0), 0), label: t('dis.activities.enrolled') },
        { iconClass: '',        icon: 'supervisor_account', value: new Set(activities.filter(a => a.teacher_name).map(a => a.teacher_name)).size, label: t('dis.activities.patronTeachers') },
    ]

    return (
        <>
            {editingActivity && (
                <EditActivityModal
                    activity={editingActivity}
                    onClose={() => setEditingActivity(null)}
                    onSave={handleSaveEdit}
                />
            )}
            {showNew && (
                <NewActivityModal
                    onClose={() => setShowNew(false)}
                    onSave={handleCreate}
                />
            )}
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title={t('dis.activities.title')} subtitle={t('dis.activities.subtitle')} {...sessionUser} notifications={liveNotifications} onNotificationRead={markRead} />

                    <DashboardContent>

                        <div className="portal-stat-grid">
                            {stats.map((s, i) => (
                                <StatCard key={i} icon={s.icon} value={loading ? '-' : s.value} label={s.label} colorClass={s.iconClass} />
                            ))}
                        </div>

                        <ConsentRequestsPanel />

                        <div className="toolbar-card">
                            <FilterBar options={filterOptions} active={filter} onChange={setFilter} />
                            <div className="toolbar-spacer" />
                            <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
                                <span className="material-symbols-rounded icon-sm">add</span> {t('dis.activities.newClub')}
                            </button>
                        </div>

                        {loading ? (
                            <p className="u-pad u-muted">{t('dis.activities.loading')}</p>
                        ) : visible.length === 0 ? (
                            <EmptyState
                                icon="sports_soccer"
                                title={t('dis.studentLife.noActivities')}
                                description={t('dis.studentLife.noActivitiesDesc')}
                                action={filter === 'all'
                                    ? { label: t('dis.studentLife.createFirstClub'), icon: 'add', onClick: () => setShowNew(true) }
                                    : { label: t('dis.activities.showAll'), icon: 'refresh', onClick: () => setFilter('all') }}
                            />
                        ) : (
                            <div className="act-list-card">
                                <div className="act-list-header">
                                    <div className="act-list-title">
                                        {filter === 'all'
                                            ? t('dis.studentLife.allActivities')
                                            : categoryLabel(t, filter)}
                                    </div>
                                    <span className="act-list-count">
                                        {t('dis.activities.clubCount', { count: visible.length })}
                                    </span>
                                </div>
                                <div className="act-list-body">
                                    <div className="staff-cards-grid">
                                        {visible.map(a => (
                                            <ActivityCard key={a.id} activity={a} onEdit={() => setEditingActivity(a)} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
