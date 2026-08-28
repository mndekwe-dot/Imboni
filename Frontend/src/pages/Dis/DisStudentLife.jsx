import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { StatCard } from '../../components/layout/StatCard'
import { FilterBar } from '../../components/ui/FilterBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { DataTable } from '../../components/ui/DataTable'
import { TabGroup } from '../../components/ui/TabGroup'
import { NewActivityModal } from '../../components/modals/NewActivityModal'
import { EditActivityModal } from '../../components/modals/EditActivityModal'
import { LeaderModal } from '../../components/modals/LeaderModal'
import { DormitoryCaptainModal } from '../../components/modals/DormitoryCaptainModal'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { disNavItems, disSecondaryItems } from './disNav'
import {
    getDisActivities, createDisActivity, patchDisActivity, deleteDisActivity,
    getDisStudentLeaders, createDisStudentLeader, patchDisStudentLeader, deleteDisStudentLeader,
    getDisReports, getDisCurrentTerm,
} from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'

/**
 * Clubs, activities and student leadership.
 *
 * What was disorganised about the old page, and what changed:
 *
 *  - A club was drawn with `.staff-card`, the card built for a member of staff.
 *    So a club had a circular initials avatar where its category should be, and
 *    "Basketball Team" wrapped onto two lines beside it. Clubs now have their
 *    own card, led by the category — which is the thing you scan a grid of
 *    clubs for.
 *  - The primary action sat INSIDE the row of eight filter chips, so on a
 *    laptop the chips wrapped and "New Club" moved with them. The chips are a
 *    group now and the action sits at the end of the row, at its own width.
 *  - "No activities found." was a bare grey sentence. It is an <EmptyState>
 *    with the action that would fill it, like every other empty list.
 *  - The captains table was hand-rolled markup inside a card. It is a
 *    <DataTable>, so it sorts, pages and empties like every other table.
 *  - Every label on the page was English string literals in the source. They
 *    are keys now, so the page follows the language switch like the rest.
 *  - Failures were `console.error` and nothing else: deleting a club that the
 *    server refused looked exactly like deleting one that worked.
 */

const CATEGORIES = {
    sport:      { labelKey: 'dis.studentLife.catSports',     icon: 'sports_soccer',       tone: 'blue'   },
    music:      { labelKey: 'dis.studentLife.catMusic',      icon: 'music_note',          tone: 'purple' },
    art:        { labelKey: 'dis.studentLife.catArts',       icon: 'palette',             tone: 'orange' },
    debate:     { labelKey: 'dis.studentLife.catDebate',     icon: 'forum',               tone: 'blue'   },
    science:    { labelKey: 'dis.studentLife.catScience',    icon: 'science',             tone: 'green'  },
    community:  { labelKey: 'dis.studentLife.catCommunity',  icon: 'volunteer_activism',  tone: 'green'  },
    leadership: { labelKey: 'dis.studentLife.catLeadership', icon: 'military_tech',       tone: 'purple' },
    other:      { labelKey: 'dis.studentLife.catOther',      icon: 'category',            tone: ''       },
}

const ROLE_KEYS = {
    head_boy:          'dis.studentLife.roleHeadBoy',
    head_girl:         'dis.studentLife.roleHeadGirl',
    deputy_head_boy:   'dis.studentLife.roleDeputyHeadBoy',
    deputy_head_girl:  'dis.studentLife.roleDeputyHeadGirl',
    prefect:           'dis.studentLife.rolePrefect',
    house_captain:     'dis.studentLife.roleHouseCaptain',
    class_captain:     'dis.studentLife.roleClassCaptain',
    games_captain:     'dis.studentLife.roleGamesCaptain',
}

const INCIDENT_TYPES = {
    incident:    { icon: 'warning',      cls: 'warning'  },
    warning:     { icon: 'error',        cls: 'warning'  },
    positive:    { icon: 'thumb_up',     cls: 'positive' },
    achievement: { icon: 'emoji_events', cls: 'positive' },
}

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

/** "Delete? Yes / No" in place of the button that asked. */
function ConfirmInline({ question, onYes, onNo }) {
    const { t } = useTranslation()
    return (
        <>
            <span className="remove-confirm-text">{question}</span>
            <button className="btn btn-primary btn-sm" onClick={onYes}>{t('common.yes')}</button>
            <button className="btn btn-outline btn-sm" onClick={onNo}>{t('common.no')}</button>
        </>
    )
}

// ── Activity card ─────────────────────────────────────────────────────────────

function ActivityCard({ activity, onEdit, onDelete }) {
    const { t } = useTranslation()
    const [confirming, setConfirming] = useState(false)
    const cat = CATEGORIES[activity.category] || CATEGORIES.other

    const enrolled = activity.enrolled_count ?? 0
    const max = activity.max_members || 0
    // Clamped: a club that has over-enrolled must not draw a bar past its own box.
    const fillPct = max ? Math.min(100, Math.round((enrolled / max) * 100)) : 0

    return (
        <article className={`disc-club-card${activity.is_active ? '' : ' inactive'}`}>
            <header className="disc-club-card-top">
                <div className={`disc-activity-icon ${cat.tone}`}>
                    <span className="material-symbols-rounded" aria-hidden="true">{cat.icon}</span>
                </div>
                <div className="disc-club-card-head">
                    <h3 className="disc-club-card-name">{activity.name}</h3>
                    <p className="disc-club-card-cat">{t(cat.labelKey)}</p>
                </div>
                {!activity.is_active && (
                    <span className="badge">{t('dis.studentLife.inactive')}</span>
                )}
                {activity.is_full && (
                    <span className="badge badge-high">{t('dis.studentLife.full')}</span>
                )}
            </header>

            <div className="disc-club-card-meta">
                <span>
                    <span className="material-symbols-rounded" aria-hidden="true">supervisor_account</span>
                    {activity.teacher_name || t('dis.studentLife.noPatron')}
                </span>
                <span>
                    <span className="material-symbols-rounded" aria-hidden="true">schedule</span>
                    {activity.schedule || t('dis.studentLife.noSchedule')}
                </span>
                <span>
                    <span className="material-symbols-rounded" aria-hidden="true">location_on</span>
                    {activity.venue || t('dis.studentLife.noVenue')}
                </span>
            </div>

            {/* Membership is the number a director actually scans this grid for,
                so it gets a bar rather than another line of grey text. */}
            <div className="disc-club-card-capacity">
                <div className="disc-club-card-capacity-label">
                    {t('dis.studentLife.members', { enrolled, max })}
                </div>
                <div
                    className="disc-club-card-bar"
                    role="progressbar"
                    aria-valuenow={enrolled}
                    aria-valuemin={0}
                    aria-valuemax={max || undefined}
                >
                    <span className="disc-club-card-bar-fill" style={{ width: `${fillPct}%` }} />
                </div>
            </div>

            <footer className="disc-club-card-actions">
                {confirming ? (
                    <ConfirmInline
                        question={t('dis.studentLife.deleteClub')}
                        onYes={() => onDelete(activity.id)}
                        onNo={() => setConfirming(false)}
                    />
                ) : (
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirming(true)}>
                            <span className="material-symbols-rounded icon-sm">delete</span> {t('common.delete')}
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => onEdit(activity)}>
                            <span className="material-symbols-rounded icon-sm">edit</span> {t('common.edit')}
                        </button>
                    </>
                )}
            </footer>
        </article>
    )
}

// ── Prefect card ──────────────────────────────────────────────────────────────

function PrefectCard({ leader, onEdit, onRemove }) {
    const { t } = useTranslation()
    const [confirming, setConfirming] = useState(false)
    const cls = `${leader.grade || ''}${leader.section || ''}`
    const role = t(ROLE_KEYS[leader.role] || 'dis.studentLife.rolePrefect')

    return (
        <article className="disc-club-card">
            <header className="disc-club-card-top">
                <div className="staff-card-avatar matron">{initials(leader.student_name)}</div>
                <div className="disc-club-card-head">
                    <h3 className="disc-club-card-name">{leader.student_name}</h3>
                    <p className="disc-club-card-cat">{role}{cls ? ` · ${cls}` : ''}</p>
                </div>
            </header>
            <div className="disc-club-card-meta">
                <span><span className="material-symbols-rounded" aria-hidden="true">badge</span>{leader.student_id}</span>
                <span><span className="material-symbols-rounded" aria-hidden="true">calendar_today</span>{t('dis.studentLife.appointed', { date: leader.appointed_date })}</span>
                {leader.notes && <span><span className="material-symbols-rounded" aria-hidden="true">notes</span>{leader.notes}</span>}
            </div>
            <footer className="disc-club-card-actions">
                {confirming ? (
                    <ConfirmInline
                        question={t('common.removeConfirm')}
                        onYes={() => onRemove(leader.id)}
                        onNo={() => setConfirming(false)}
                    />
                ) : (
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirming(true)}>
                            <span className="material-symbols-rounded icon-sm">person_remove</span> {t('common.remove')}
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => onEdit(leader)}>
                            <span className="material-symbols-rounded icon-sm">edit</span> {t('common.edit')}
                        </button>
                    </>
                )}
            </footer>
        </article>
    )
}

// ── Captain row ───────────────────────────────────────────────────────────────

function CaptainRow({ leader, onEdit, onRemove, confirmId, onConfirmRemove, onCancelRemove }) {
    const { t } = useTranslation()
    const cls = `${leader.grade || ''}${leader.section || ''}`
    const isConfirming = confirmId === leader.id

    return (
        <tr>
            <td><span className="disc-badge">{leader.notes || '-'}</span></td>
            <td><strong>{leader.student_name}</strong> {cls && <span className="class-chip">{cls}</span>}</td>
            <td className="text-muted">{leader.student_id}</td>
            <td className="text-muted">{leader.appointed_date}</td>
            <td className="action-cell">
                {isConfirming ? (
                    <ConfirmInline
                        question={t('common.removeConfirm')}
                        onYes={() => onConfirmRemove(leader.id)}
                        onNo={onCancelRemove}
                    />
                ) : (
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => onEdit(leader)}>
                            <span className="material-symbols-rounded icon-sm">edit</span> {t('common.edit')}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => onRemove(leader.id)}>
                            <span className="material-symbols-rounded icon-sm">delete</span> {t('common.remove')}
                        </button>
                    </>
                )}
            </td>
        </tr>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DisStudentLife() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const toast = useToast()

    /* The tab is in the URL. /discipline/leaders used to be a second,
       read-only copy of the Leaders tab — same cards, same table, no way to
       add or remove anyone — reachable only by typing the address. It
       redirects here now, and needs a tab to land on. */
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab = searchParams.get('tab') === 'leaders' ? 'leaders' : 'activities'
    const setActiveTab = tab => setSearchParams(
        tab === 'leaders' ? { tab: 'leaders' } : {},
        { replace: true },
    )

    const [activities,      setActivities]      = useState([])
    const [actLoading,      setActLoading]      = useState(true)
    const [actFilter,       setActFilter]       = useState('all')
    const [editingActivity, setEditingActivity] = useState(null)
    const [showNewActivity, setShowNewActivity] = useState(false)

    const [leaders,         setLeaders]         = useState([])
    const [leadLoading,     setLeadLoading]     = useState(false)
    const [leadLoaded,      setLeadLoaded]      = useState(false)
    const [currentTermId,   setCurrentTermId]   = useState(null)
    const [leaderFilter,    setLeaderFilter]    = useState('all')
    const [showAddLeader,   setShowAddLeader]   = useState(null)   // 'prefect' | 'captain' | null
    const [editingLeader,   setEditingLeader]   = useState(null)
    const [confirmRemoveId, setConfirmRemoveId] = useState(null)

    const [incidents, setIncidents] = useState([])

    useEffect(() => {
        Promise.all([
            getDisActivities(),
            getDisReports({ type: 'incident' }),
        ]).then(([acts, reps]) => {
            setActivities(Array.isArray(acts) ? acts : [])
            setIncidents(Array.isArray(reps) ? reps.slice(0, 5) : [])
        }).catch(e => {
            toast.error(errorMessage(e, t('dis.studentLife.loadFailed')))
        }).finally(() => setActLoading(false))
    }, [toast, t])

    useEffect(() => {
        if (activeTab !== 'leaders' || leadLoaded) return
        setLeadLoaded(true)
        setLeadLoading(true)
        Promise.all([
            getDisStudentLeaders(),
            getDisCurrentTerm(),
        ]).then(([ldrs, term]) => {
            setLeaders(Array.isArray(ldrs) ? ldrs : [])
            if (term?.id) setCurrentTermId(term.id)
        }).catch(e => {
            toast.error(errorMessage(e, t('dis.studentLife.loadFailed')))
        }).finally(() => setLeadLoading(false))
    }, [activeTab, leadLoaded, toast, t])

    // ── Writes. Each one says what happened; they used to say nothing. ──
    async function guard(fn) {
        try { await fn() }
        catch (e) { toast.error(errorMessage(e, t('dis.studentLife.saveFailed'))) }
    }

    const handleCreateActivity = data => guard(async () => {
        const created = await createDisActivity(data)
        setActivities(prev => [created, ...prev])
        toast.success(t('common.saved'))
    })

    const handleUpdateActivity = (id, data) => guard(async () => {
        const updated = await patchDisActivity(id, data)
        setActivities(prev => prev.map(a => a.id === id ? updated : a))
        toast.success(t('common.saved'))
    })

    const handleDeleteActivity = id => guard(async () => {
        await deleteDisActivity(id)
        setActivities(prev => prev.filter(a => a.id !== id))
    })

    const handleCreateLeader = data => guard(async () => {
        const created = await createDisStudentLeader({ ...data, term_id: currentTermId })
        setLeaders(prev => [created, ...prev])
        toast.success(t('common.saved'))
    })

    const handleUpdateLeader = (id, data) => guard(async () => {
        const updated = await patchDisStudentLeader(id, data)
        setLeaders(prev => prev.map(l => l.id === id ? { ...l, ...updated } : l))
        toast.success(t('common.saved'))
    })

    const handleRemoveLeader = id => guard(async () => {
        await deleteDisStudentLeader(id)
        setLeaders(prev => prev.filter(l => l.id !== id))
        setConfirmRemoveId(null)
    })

    // ── Derived ──
    const categoryFilters = useMemo(() => [
        { key: 'all', label: t('dis.studentLife.allActivities') },
        ...Object.entries(CATEGORIES)
            .filter(([key]) => key !== 'other')
            .map(([key, c]) => ({ key, label: t(c.labelKey) })),
    ], [t])

    const visibleActivities = actFilter === 'all'
        ? activities
        : activities.filter(a => a.category === actFilter)

    const prefects = leaders.filter(l => l.role !== 'house_captain')
    const captains = leaders.filter(l => l.role === 'house_captain')
    const totalEnrolled = activities.reduce((s, a) => s + (a.enrolled_count || 0), 0)

    const activityStats = [
        { colorClass: 'info',    icon: 'emoji_events',       value: activities.filter(a => a.is_active).length,    label: t('dis.studentLife.activitiesClubs') },
        { colorClass: 'success', icon: 'groups',             value: totalEnrolled,                                 label: t('common.allStudents')              },
        { colorClass: 'warning', icon: 'report',             value: incidents.length,                              label: t('dis.studentLife.recentIncidents') },
        { colorClass: '',        icon: 'supervisor_account', value: activities.filter(a => a.teacher_name).length, label: t('dis.staff.activityPatrons')       },
    ]

    const leaderStats = [
        { colorClass: 'info',    icon: 'military_tech', value: prefects.length,   label: t('dis.studentLife.prefects')  },
        { colorClass: 'success', icon: 'home',          value: captains.length,   label: t('dis.studentLife.captains')  },
        { colorClass: 'warning', icon: 'emoji_events',  value: activities.length, label: t('dis.studentLife.activitiesClubs') },
        { colorClass: '',        icon: 'report',        value: incidents.length,  label: t('dis.studentLife.recentIncidents') },
    ]

    return (
        <>
            {showNewActivity && (
                <NewActivityModal
                    onClose={() => setShowNewActivity(false)}
                    onSave={async (data) => { await handleCreateActivity(data); setShowNewActivity(false) }}
                />
            )}
            {editingActivity && (
                <EditActivityModal
                    activity={editingActivity}
                    onClose={() => setEditingActivity(null)}
                    onSave={async (data) => { await handleUpdateActivity(editingActivity.id, data); setEditingActivity(null) }}
                />
            )}
            {showAddLeader === 'prefect' && (
                <LeaderModal
                    onClose={() => setShowAddLeader(null)}
                    onSave={async (data) => { await handleCreateLeader(data); setShowAddLeader(null) }}
                />
            )}
            {showAddLeader === 'captain' && (
                <DormitoryCaptainModal
                    onClose={() => setShowAddLeader(null)}
                    onSave={async (data) => { await handleCreateLeader({ ...data, role: 'house_captain' }); setShowAddLeader(null) }}
                />
            )}
            {editingLeader && editingLeader.role !== 'house_captain' && (
                <LeaderModal
                    leader={editingLeader}
                    onClose={() => setEditingLeader(null)}
                    onSave={async (data) => { await handleUpdateLeader(editingLeader.id, data); setEditingLeader(null) }}
                />
            )}
            {editingLeader && editingLeader.role === 'house_captain' && (
                <DormitoryCaptainModal
                    captain={editingLeader}
                    onClose={() => setEditingLeader(null)}
                    onSave={async (data) => { await handleUpdateLeader(editingLeader.id, data); setEditingLeader(null) }}
                />
            )}

            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('dis.studentLife.title')}
                        subtitle={t('dis.studentLife.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <TabGroup
                            tabs={[
                                { key: 'activities', label: t('dis.studentLife.activitiesClubs'), icon: 'emoji_events' },
                                { key: 'leaders',    label: t('dis.studentLeaders.title'),        icon: 'military_tech' },
                            ]}
                            value={activeTab}
                            onChange={setActiveTab}
                            label={t('dis.studentLife.title')}
                            idPrefix="dis-life-"
                        />

                        {/* ── ACTIVITIES ── */}
                        {activeTab === 'activities' && (
                            <div id="dis-life-panel-activities" role="tabpanel" aria-labelledby="dis-life-tab-activities">
                                <div className="portal-stat-grid mb-5">
                                    {activityStats.map((s, i) => <StatCard key={i} {...s} />)}
                                </div>

                                {/* Filters lead, the action sits at the end of
                                    the same row. Before, the button was INSIDE
                                    the chip row, so on a laptop the eight chips
                                    wrapped and "New Club" moved with them. */}
                                <div className="section-toolbar-row">
                                    <FilterBar options={categoryFilters} active={actFilter} onChange={setActFilter} />
                                    <button className="btn btn-primary btn-sm" onClick={() => setShowNewActivity(true)}>
                                        <span className="material-symbols-rounded icon-sm">add</span> {t('dis.studentLife.newClub')}
                                    </button>
                                </div>

                                {actLoading ? (
                                    <p className="u-pad u-muted">{t('dis.studentLife.loadingActivities')}</p>
                                ) : visibleActivities.length === 0 ? (
                                    <EmptyState
                                        icon="emoji_events"
                                        title={t('dis.studentLife.noActivities')}
                                        description={t('dis.studentLife.noActivitiesDesc')}
                                        action={{ label: t('dis.studentLife.createFirstClub'), icon: 'add', onClick: () => setShowNewActivity(true) }}
                                        secondAction={actFilter !== 'all'
                                            ? { label: t('common.clearFilters'), icon: 'close', onClick: () => setActFilter('all') }
                                            : undefined}
                                    />
                                ) : (
                                    <div className="disc-club-grid">
                                        {visibleActivities.map(a => (
                                            <ActivityCard key={a.id} activity={a} onEdit={setEditingActivity} onDelete={handleDeleteActivity} />
                                        ))}
                                    </div>
                                )}

                                {incidents.length > 0 && (
                                    <div className="card mt-1-5">
                                        <div className="card-header">
                                            <h2 className="card-title">{t('dis.studentLife.recentIncidents')}</h2>
                                        </div>
                                        <div className="card-content">
                                            <div className="disc-activity-list">
                                                {incidents.map(r => {
                                                    const meta = INCIDENT_TYPES[r.report_type] || INCIDENT_TYPES.incident
                                                    return (
                                                        <div key={r.id} className="disc-activity-item">
                                                            <div className={`disc-activity-icon ${meta.cls}`}>
                                                                <span className="material-symbols-rounded" aria-hidden="true">{meta.icon}</span>
                                                            </div>
                                                            <div className="disc-activity-details">
                                                                <p className="disc-activity-title">{r.title}</p>
                                                                <p className="disc-activity-time">
                                                                    {r.date} · <strong>{r.student}</strong>
                                                                    {r.grade && r.section && ` (${r.grade}${r.section})`}
                                                                    {r.reported_by && ` · ${r.reported_by}`}
                                                                </p>
                                                            </div>
                                                            <span className={`incident-type-tag ${meta.cls}`}>{r.severity || r.report_type}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── LEADERS ── */}
                        {activeTab === 'leaders' && (
                            <div id="dis-life-panel-leaders" role="tabpanel" aria-labelledby="dis-life-tab-leaders">
                                <div className="portal-stat-grid mb-5">
                                    {leaderStats.map((s, i) => <StatCard key={i} {...s} />)}
                                </div>

                                <div className="section-toolbar-row">
                                    <FilterBar
                                        options={[
                                            { key: 'all',      label: t('dis.studentLife.allLeaders') },
                                            { key: 'prefects', label: t('dis.studentLife.prefects')   },
                                            { key: 'captains', label: t('dis.studentLife.captains')   },
                                        ]}
                                        active={leaderFilter}
                                        onChange={setLeaderFilter}
                                    />
                                    <div className="disc-btn-inline-group">
                                        <button className="btn btn-outline btn-sm" onClick={() => setShowAddLeader('captain')}>
                                            <span className="material-symbols-rounded icon-sm">add</span> {t('dis.studentLife.addCaptain')}
                                        </button>
                                        <button className="btn btn-primary btn-sm" onClick={() => setShowAddLeader('prefect')}>
                                            <span className="material-symbols-rounded icon-sm">add</span> {t('dis.studentLife.addLeader')}
                                        </button>
                                    </div>
                                </div>

                                {leadLoading ? (
                                    <p className="u-pad u-muted">{t('dis.studentLife.loadingLeaders')}</p>
                                ) : (
                                    <>
                                        {(leaderFilter === 'all' || leaderFilter === 'prefects') && (
                                            prefects.length === 0 ? (
                                                <EmptyState
                                                    icon="military_tech"
                                                    title={t('dis.studentLife.noPrefects')}
                                                    description={t('dis.studentLife.noPrefectsDesc')}
                                                    action={{ label: t('dis.studentLife.appointFirstLeader'), icon: 'add', onClick: () => setShowAddLeader('prefect') }}
                                                />
                                            ) : (
                                                <div className="disc-club-grid mb-1-5">
                                                    {prefects.map(l => (
                                                        <PrefectCard key={l.id} leader={l} onEdit={setEditingLeader} onRemove={handleRemoveLeader} />
                                                    ))}
                                                </div>
                                            )
                                        )}

                                        {(leaderFilter === 'all' || leaderFilter === 'captains') && (
                                            <DataTable
                                                title={t('dis.studentLife.dormitoryCaptains')}
                                                data={captains}
                                                columns={[
                                                    t('common.dormitory'), t('dis.studentLife.captain'),
                                                    t('common.admNo'), t('common.appointedDate'), t('common.actions'),
                                                ]}
                                                renderRow={c => (
                                                    <CaptainRow
                                                        key={c.id} leader={c}
                                                        confirmId={confirmRemoveId}
                                                        onEdit={setEditingLeader}
                                                        onRemove={setConfirmRemoveId}
                                                        onConfirmRemove={handleRemoveLeader}
                                                        onCancelRemove={() => setConfirmRemoveId(null)}
                                                    />
                                                )}
                                                emptyIcon="home"
                                                emptyTitle={t('dis.studentLife.noCaptains')}
                                                emptyDesc={t('dis.studentLife.noCaptainsDesc')}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
