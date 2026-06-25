import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { NewActivityModal } from '../../components/modals/NewActivityModal'
import { EditActivityModal } from '../../components/modals/EditActivityModal'
import { LeaderModal } from '../../components/modals/LeaderModal'
import { DormitoryCaptainModal } from '../../components/modals/DormitoryCaptainModal'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DataTable } from '../../components/ui/DataTable'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import {
    getDisActivities, createDisActivity, patchDisActivity, deleteDisActivity,
    getDisStudentLeaders, createDisStudentLeader, patchDisStudentLeader, deleteDisStudentLeader,
    getDisReports, getDisCurrentTerm,
} from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const CATEGORY_LABELS = {
    sport:      'Sports',
    music:      'Music',
    art:        'Arts & Crafts',
    debate:     'Debate',
    science:    'Science',
    community:  'Community Service',
    leadership: 'Leadership',
    other:      'Other',
}

const ROLE_LABELS = {
    head_boy: 'Head Boy', head_girl: 'Head Girl',
    deputy_head_boy: 'Deputy Head Boy', deputy_head_girl: 'Deputy Head Girl',
    prefect: 'Prefect', house_captain: 'House Captain',
    class_captain: 'Class Captain', games_captain: 'Games Captain',
}

const activityFilterOptions = [
    { key: 'all',       label: 'All Activities'    },
    { key: 'sport',     label: 'Sports'            },
    { key: 'music',     label: 'Music'             },
    { key: 'art',       label: 'Arts'              },
    { key: 'debate',    label: 'Debate'            },
    { key: 'science',   label: 'Science'           },
    { key: 'community', label: 'Community Service' },
    { key: 'leadership',label: 'Leadership'        },
]

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

// ── Activity Card ─────────────────────────────────────────────────────────────

function ActivityCard({ activity, onEdit, onDelete }) {
    const [confirmDelete, setConfirmDelete] = useState(false)
    const cat = CATEGORY_LABELS[activity.category] || activity.category

    return (
        <div className="staff-card" style={{ opacity: activity.is_active ? 1 : 0.6 }}>
            <div className="staff-card-top">
                <div className="staff-card-avatar patron">{initials(activity.name)}</div>
                <div>
                    <div className="staff-card-name">{activity.name}</div>
                    <div className="staff-card-role">
                        {cat}{activity.teacher_name ? ` · ${activity.teacher_name}` : ''}
                    </div>
                </div>
                <span className={`pub-badge ${activity.is_active ? 'active' : 'draft'} ml-auto`}>
                    {activity.is_active ? 'Active' : 'Inactive'}
                </span>
            </div>
            <div className="staff-card-meta">
                <span><span className="material-symbols-rounded">groups</span>{activity.enrolled_count ?? 0} / {activity.max_members} members</span>
                {activity.schedule && <span><span className="material-symbols-rounded">schedule</span>{activity.schedule}</span>}
                {activity.venue    && <span><span className="material-symbols-rounded">location_on</span>{activity.venue}</span>}
                {activity.is_full  && <span style={{ color: '#dc2626', fontSize: '0.78rem', fontWeight: 600 }}>Full</span>}
            </div>
            <div className="staff-card-actions">
                {confirmDelete ? (
                    <>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>Delete?</span>
                        <button className="btn btn-primary btn-sm" onClick={() => onDelete(activity.id)}>Yes</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>No</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(true)}>
                            <span className="material-symbols-rounded icon-sm">delete</span>
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => onEdit(activity)}>
                            <span className="material-symbols-rounded icon-sm">edit</span> Edit
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

// ── Prefect Card ──────────────────────────────────────────────────────────────

function PrefectCard({ leader, onEdit, onRemove }) {
    const [confirmDelete, setConfirmDelete] = useState(false)
    const cls = `${leader.grade || ''}${leader.section || ''}`

    return (
        <div className="staff-card">
            <div className="staff-card-top">
                <div className="staff-card-avatar matron">{initials(leader.student_name)}</div>
                <div>
                    <div className="staff-card-name">{leader.student_name}</div>
                    <div className="staff-card-role">{ROLE_LABELS[leader.role] || leader.role} · {cls}</div>
                </div>
                <span className="pub-badge active ml-auto">{ROLE_LABELS[leader.role] || leader.role}</span>
            </div>
            <div className="staff-card-meta">
                <span><span className="material-symbols-rounded">badge</span>ADM: {leader.student_id}</span>
                <span><span className="material-symbols-rounded">calendar_today</span>Since: {leader.appointed_date}</span>
                {leader.notes && <span><span className="material-symbols-rounded">notes</span>{leader.notes}</span>}
            </div>
            <div className="staff-card-actions">
                {confirmDelete ? (
                    <>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>Remove?</span>
                        <button className="btn btn-primary btn-sm" onClick={() => onRemove(leader.id)}>Yes</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>No</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(true)}>Remove</button>
                        <button className="btn btn-primary btn-sm" onClick={() => onEdit(leader)}>
                            <span className="material-symbols-rounded icon-sm">edit</span> Edit
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

// ── Captain Row ───────────────────────────────────────────────────────────────

function CaptainRow({ leader, onEdit, onRemove, confirmId, onConfirmRemove, onCancelRemove }) {
    const cls = `${leader.grade || ''}${leader.section || ''}`
    const dorm = leader.notes || '—'
    const isConfirming = confirmId === leader.id

    return (
        <tr>
            <td><span className="disc-badge">{dorm}</span></td>
            <td><strong>{leader.student_name}</strong> <span className="class-chip">{cls}</span></td>
            <td><span className="text-muted text-sm-muted">{leader.student_id}</span></td>
            <td>{leader.appointed_date}</td>
            <td className="action-cell">
                {isConfirming ? (
                    <>
                        <span className="remove-confirm-text">Remove?</span>
                        <button className="btn btn-primary btn-sm" onClick={() => onConfirmRemove(leader.id)}>Yes</button>
                        <button className="btn btn-outline btn-sm" onClick={onCancelRemove}>No</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => onEdit(leader)}>
                            <span className="material-symbols-rounded icon-sm">edit</span> Edit
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => onRemove(leader.id)}>
                            <span className="material-symbols-rounded icon-sm">delete</span> Remove
                        </button>
                    </>
                )}
            </td>
        </tr>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DisStudentLife() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [activeTab, setActiveTab] = useState('activities')

    // ── Activities ──
    const [activities,       setActivities]       = useState([])
    const [actLoading,       setActLoading]       = useState(false)
    const [actFilter,        setActFilter]        = useState('all')
    const [editingActivity,  setEditingActivity]  = useState(null)
    const [showNewActivity,  setShowNewActivity]  = useState(false)

    // ── Leaders ──
    const [leaders,          setLeaders]          = useState([])
    const [leadLoading,      setLeadLoading]      = useState(false)
    const [currentTermId,    setCurrentTermId]    = useState(null)
    const [leaderFilter,     setLeaderFilter]     = useState('all')
    const [showAddLeader,    setShowAddLeader]    = useState(null)  // 'prefect' | 'captain' | null
    const [editingLeader,    setEditingLeader]    = useState(null)
    const [confirmRemoveId,  setConfirmRemoveId]  = useState(null)

    // ── Incidents ──
    const [incidents, setIncidents] = useState([])

    useEffect(() => {
        setActLoading(true)
        Promise.all([
            getDisActivities(),
            getDisReports({ type: 'incident' }),
        ]).then(([acts, reps]) => {
            setActivities(Array.isArray(acts) ? acts : [])
            setIncidents(Array.isArray(reps) ? reps.slice(0, 5) : [])
        }).catch(console.error).finally(() => setActLoading(false))
    }, [])

    useEffect(() => {
        if (activeTab !== 'leaders') return
        setLeadLoading(true)
        Promise.all([
            getDisStudentLeaders(),
            getDisCurrentTerm(),
        ]).then(([ldrs, term]) => {
            setLeaders(Array.isArray(ldrs) ? ldrs : [])
            if (term?.id) setCurrentTermId(term.id)
        }).catch(console.error).finally(() => setLeadLoading(false))
    }, [activeTab])

    // ── Activity handlers ──
    async function handleCreateActivity(data) {
        try {
            const created = await createDisActivity(data)
            setActivities(prev => [created, ...prev])
        } catch(e) { console.error(e) }
    }

    async function handleUpdateActivity(id, data) {
        try {
            const updated = await patchDisActivity(id, data)
            setActivities(prev => prev.map(a => a.id === id ? updated : a))
        } catch(e) { console.error(e) }
    }

    async function handleDeleteActivity(id) {
        try {
            await deleteDisActivity(id)
            setActivities(prev => prev.filter(a => a.id !== id))
        } catch(e) { console.error(e) }
    }

    // ── Leader handlers ──
    async function handleCreateLeader(data) {
        try {
            const created = await createDisStudentLeader({ ...data, term_id: currentTermId })
            setLeaders(prev => [created, ...prev])
        } catch(e) { console.error(e) }
    }

    async function handleUpdateLeader(id, data) {
        try {
            const updated = await patchDisStudentLeader(id, data)
            setLeaders(prev => prev.map(l => l.id === id ? { ...l, ...updated } : l))
        } catch(e) { console.error(e) }
    }

    async function handleRemoveLeader(id) {
        try {
            await deleteDisStudentLeader(id)
            setLeaders(prev => prev.filter(l => l.id !== id))
            setConfirmRemoveId(null)
        } catch(e) { console.error(e) }
    }

    // ── Derived data ──
    const visibleActivities = actFilter === 'all'
        ? activities
        : activities.filter(a => a.category === actFilter)

    const prefects  = leaders.filter(l => l.role !== 'house_captain')
    const captains  = leaders.filter(l => l.role === 'house_captain')

    const totalEnrolled = activities.reduce((s, a) => s + (a.enrolled_count || 0), 0)

    const activityStats = [
        { iconClass: 'info',    icon: 'emoji_events',       value: activities.filter(a => a.is_active).length, label: 'Active Clubs'       },
        { iconClass: 'success', icon: 'groups',             value: totalEnrolled,                              label: 'Enrolled Students'  },
        { iconClass: 'warning', icon: 'report',             value: incidents.length,                           label: 'Recent Incidents'   },
        { iconClass: 'positive',icon: 'supervisor_account', value: activities.filter(a => a.teacher_name).length, label: 'Patron Teachers' },
    ]

    const leaderStats = [
        { iconClass: 'info',    icon: 'military_tech', value: prefects.length,  label: 'Prefects & Leaders'  },
        { iconClass: 'success', icon: 'home',          value: captains.length,  label: 'Dormitory Captains'  },
        { iconClass: 'warning', icon: 'groups',        value: activities.length,label: 'Active Clubs'        },
        { iconClass: 'positive',icon: 'report',        value: incidents.length, label: 'Recent Incidents'    },
    ]

    const TYPE_META = {
        incident:    { icon: 'warning',   cls: 'warning'  },
        warning:     { icon: 'error',     cls: 'warning'  },
        positive:    { icon: 'thumb_up',  cls: 'positive' },
        achievement: { icon: 'emoji_events', cls: 'positive' },
    }

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

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Student Life"
                        subtitle="Extracurricular activities, clubs and student leadership"
                        {...disUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <div className="filter-tabs-bar mb-5">
                            <button className={`filter-tab${activeTab === 'activities' ? ' active' : ''}`} onClick={() => setActiveTab('activities')}>
                                <span className="material-symbols-rounded">emoji_events</span> Activities & Clubs
                            </button>
                            <button className={`filter-tab${activeTab === 'leaders' ? ' active' : ''}`} onClick={() => setActiveTab('leaders')}>
                                <span className="material-symbols-rounded">military_tech</span> Student Leaders
                            </button>
                        </div>

                        {/* ── ACTIVITIES TAB ── */}
                        {activeTab === 'activities' && (
                            <>
                                <div className="disc-stat-grid">
                                    {activityStats.map((s, i) => (
                                        <div key={i} className="disc-stat-card">
                                            <div className={`disc-stat-icon ${s.iconClass}`}><span className="material-symbols-rounded">{s.icon}</span></div>
                                            <div>
                                                <div className="disc-stat-value">{s.value}</div>
                                                <div className="disc-stat-label">{s.label}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="section-toolbar-row">
                                    <FilterBar options={activityFilterOptions} active={actFilter} onChange={setActFilter} />
                                    <button className="btn btn-primary" onClick={() => setShowNewActivity(true)}>
                                        <span className="material-symbols-rounded">add</span> New Club
                                    </button>
                                </div>

                                {actLoading ? (
                                    <p style={{ color: 'var(--muted-foreground)', padding: '2rem 0' }}>Loading activities…</p>
                                ) : visibleActivities.length === 0 ? (
                                    <p style={{ color: 'var(--muted-foreground)', padding: '2rem 0', textAlign: 'center' }}>No activities found.</p>
                                ) : (
                                    <div className="staff-cards-grid">
                                        {visibleActivities.map(a => (
                                            <ActivityCard key={a.id} activity={a} onEdit={setEditingActivity} onDelete={handleDeleteActivity} />
                                        ))}
                                    </div>
                                )}

                                {incidents.length > 0 && (
                                    <div className="card mt-1-5">
                                        <div className="card-header">
                                            <h2 className="card-title">Recent Conduct Incidents</h2>
                                        </div>
                                        <div className="card-content">
                                            <div className="disc-activity-list">
                                                {incidents.map(r => {
                                                    const meta = TYPE_META[r.report_type] || { icon: 'warning', cls: 'warning' }
                                                    return (
                                                        <div key={r.id} className="disc-activity-item">
                                                            <div className={`disc-activity-icon ${meta.cls}`}>
                                                                <span className="material-symbols-rounded">{meta.icon}</span>
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
                            </>
                        )}

                        {/* ── LEADERS TAB ── */}
                        {activeTab === 'leaders' && (
                            <>
                                <div className="disc-stat-grid">
                                    {leaderStats.map((s, i) => (
                                        <div key={i} className="disc-stat-card">
                                            <div className={`disc-stat-icon ${s.iconClass}`}><span className="material-symbols-rounded">{s.icon}</span></div>
                                            <div>
                                                <div className="disc-stat-value">{s.value}</div>
                                                <div className="disc-stat-label">{s.label}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="section-toolbar-row">
                                    <FilterBar
                                        options={[
                                            { key: 'all',      label: 'All Leaders'       },
                                            { key: 'prefects', label: 'Prefects'          },
                                            { key: 'captains', label: 'Dormitory Captains'},
                                        ]}
                                        active={leaderFilter}
                                        onChange={setLeaderFilter}
                                    />
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-outline btn-sm" onClick={() => setShowAddLeader('captain')}>
                                            <span className="material-symbols-rounded icon-sm">add</span> Add Captain
                                        </button>
                                        <button className="btn btn-primary" onClick={() => setShowAddLeader('prefect')}>
                                            <span className="material-symbols-rounded">add</span> Add Leader
                                        </button>
                                    </div>
                                </div>

                                {leadLoading ? (
                                    <p style={{ color: 'var(--muted-foreground)', padding: '2rem 0' }}>Loading leaders…</p>
                                ) : (
                                    <>
                                        {(leaderFilter === 'all' || leaderFilter === 'prefects') && (
                                            <div className="staff-cards-grid">
                                                {prefects.length === 0
                                                    ? <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>No prefects appointed this term.</p>
                                                    : prefects.map(l => (
                                                        <PrefectCard key={l.id} leader={l} onEdit={setEditingLeader} onRemove={handleRemoveLeader} />
                                                    ))
                                                }
                                            </div>
                                        )}

                                        {(leaderFilter === 'all' || leaderFilter === 'captains') && (
                                            <div className="card mt-1-5">
                                                <div className="card-header">
                                                    <h2 className="card-title"><span className="material-symbols-rounded">home</span> Dormitory Captains</h2>
                                                </div>
                                                <div className="card-content">
                                                    <div className="disc-table-wrap">
                                                        <table className="disc-table">
                                                            <thead>
                                                                <tr><th>Dormitory</th><th>Captain</th><th>ADM</th><th>Since</th><th>Actions</th></tr>
                                                            </thead>
                                                            <tbody>
                                                                {captains.length === 0
                                                                    ? <tr><td colSpan={5} className="td-italic-muted">No captains assigned this term.</td></tr>
                                                                    : captains.map(c => (
                                                                        <CaptainRow key={c.id} leader={c}
                                                                            confirmId={confirmRemoveId}
                                                                            onEdit={setEditingLeader}
                                                                            onRemove={setConfirmRemoveId}
                                                                            onConfirmRemove={handleRemoveLeader}
                                                                            onCancelRemove={() => setConfirmRemoveId(null)}
                                                                        />
                                                                    ))
                                                                }
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
