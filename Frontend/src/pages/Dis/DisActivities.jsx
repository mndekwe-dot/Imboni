import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { NewActivityModal } from '../../components/modals/NewActivityModal'
import { EditActivityModal } from '../../components/modals/EditActivityModal'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { disNavItems, disSecondaryItems } from './disNav'
import { getDisActivities, createDisActivity } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import '../../styles/tables.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const filterOptions = [
    { key: 'all',      label: 'All Activities' },
    { key: 'sports',   label: 'Sports'         },
    { key: 'arts',     label: 'Arts'           },
    { key: 'academic', label: 'Academic'       },
    { key: 'social',   label: 'Social'         },
    { key: 'science',  label: 'Science'        },
    { key: 'other',    label: 'Other'          },
]

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function avClass(category) {
    return ['arts', 'social'].includes(category) ? 'matron' : 'patron'
}

function ActivityCard({ activity, onEdit }) {
    const { name, category, teacher_name, schedule, venue, enrolled_count, max_members, is_full, is_active } = activity
    const catLabel = category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Other'
    const badge    = is_active ? 'Active' : 'Inactive'
    const badgeCls = is_active ? 'active' : ''
    const full     = is_full ? ' (Full)' : ` / ${max_members} max`

    return (
        <div className="staff-card" data-cat={category}>
            <div className="staff-card-top">
                <div className={`staff-card-avatar ${avClass(category)}`}>{initials(name)}</div>
                <div>
                    <div className="staff-card-name">{name}</div>
                    <div className="staff-card-role">{catLabel} &bull; Patron: {teacher_name || '—'}</div>
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

export function DisActivities() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [activities,      setActivities]      = useState([])
    const [loading,         setLoading]         = useState(true)
    const [filter,          setFilter]          = useState('all')
    const [showNew,         setShowNew]         = useState(false)
    const [editingActivity, setEditingActivity] = useState(null)

    useEffect(() => {
        getDisActivities()
            .then(setActivities)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    async function handleCreate(form) {
        try {
            const created = await createDisActivity(form)
            setActivities(prev => [created, ...prev])
        } catch (e) { console.error(e) }
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
        { iconClass: 'info',    icon: 'emoji_events',       value: activities.filter(a => a.is_active).length, label: 'Active Clubs'    },
        { iconClass: 'success', icon: 'groups',             value: activities.reduce((s, a) => s + (a.enrolled_count || 0), 0), label: 'Enrolled Students' },
        { iconClass: 'positive',icon: 'supervisor_account', value: new Set(activities.filter(a => a.teacher_name).map(a => a.teacher_name)).size, label: 'Patron Teachers' },
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
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Extracurricular Activities" subtitle="Manage clubs, patron assignments and memberships" {...sessionUser} notifications={liveNotifications} onNotificationRead={markRead} />

                    <DashboardContent>

                        <div className="disc-stat-grid">
                            {stats.map((s, i) => (
                                <div key={i} className="disc-stat-card">
                                    <div className={`disc-stat-icon ${s.iconClass}`}><span className="material-symbols-rounded">{s.icon}</span></div>
                                    <div>
                                        <div className="disc-stat-value">{loading ? '—' : s.value}</div>
                                        <div className="disc-stat-label">{s.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="toolbar-card">
                            <FilterBar options={filterOptions} active={filter} onChange={setFilter} />
                            <div className="toolbar-spacer" />
                            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                                <span className="material-symbols-rounded">add</span> New Club
                            </button>
                        </div>

                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading activities…</p>
                        ) : visible.length === 0 ? (
                            <EmptyState
                                icon="sports_soccer"
                                title={`No ${filter === 'all' ? '' : filter + ' '}activities found`}
                                description="No clubs match this filter."
                                action={{ label: 'Show All', icon: 'refresh', onClick: () => setFilter('all') }}
                            />
                        ) : (
                            <div className="act-list-card">
                                <div className="act-list-header">
                                    <div className="act-list-title">
                                        {filter === 'all' ? 'All Clubs & Activities' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Activities`}
                                    </div>
                                    <span className="act-list-count">{visible.length} club{visible.length !== 1 ? 's' : ''}</span>
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
