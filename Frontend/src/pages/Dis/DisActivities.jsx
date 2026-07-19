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
import { getDisActivities, createDisActivity, getConsentRequests, createConsentRequest } from '../../api/discipline'
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

const GRADE_OPTIONS = [
    { value: '',  label: 'All grades' },
    { value: '1', label: 'S1' }, { value: '2', label: 'S2' }, { value: '3', label: 'S3' },
    { value: '4', label: 'S4' }, { value: '5', label: 'S5' }, { value: '6', label: 'S6' },
]

function ConsentRequestsPanel() {
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
            setError('Title, description and event date are required.')
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
            setError('Failed to create the request.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="card mb-1-5">
            <div className="card-header">
                <h2 className="card-title">
                    <span className="material-symbols-rounded dis-inline-icon">approval</span>
                    Parent Consent Requests
                </h2>
                <button className="btn btn-outline btn-sm" onClick={() => setShowForm(s => !s)}>
                    <span className="material-symbols-rounded icon-sm">add</span>
                    New Request
                </button>
            </div>
            <div className="card-content">
                {showForm && (
                    <div className="cr-form">
                        <div className="cr-col-full">
                            <label className="form-label" htmlFor="cr-title">Title</label>
                            <input id="cr-title" className="form-input" placeholder="e.g. Museum Trip"
                                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div className="cr-col-full">
                            <label className="form-label" htmlFor="cr-desc">Description</label>
                            <textarea id="cr-desc" className="form-input form-textarea" rows="2"
                                placeholder="What are parents consenting to?"
                                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="cr-date">Event date</label>
                            <input id="cr-date" type="date" className="form-input"
                                value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="cr-deadline">Respond by (optional)</label>
                            <input id="cr-deadline" type="date" className="form-input"
                                value={form.response_deadline} onChange={e => setForm(f => ({ ...f, response_deadline: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="cr-grade">Grade</label>
                            <select id="cr-grade" className="form-input" value={form.grade}
                                onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}>
                                {GRADE_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                            </select>
                        </div>
                        <div className="cr-actions">
                            <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={saving}>
                                {saving ? 'Sending…' : 'Send to Parents'}
                            </button>
                        </div>
                        {error && <p className="cr-error">{error}</p>}
                    </div>
                )}

                {loading ? (
                    <p className="u-muted">Loading consent requests…</p>
                ) : requests.length === 0 ? (
                    <p className="u-muted">
                        No consent requests yet. Create one to collect parent approvals for a trip or activity.
                    </p>
                ) : (
                    <div className="cr-list">
                        {requests.map(req => (
                            <div key={req.id} className="cr-req">
                                <div className="cr-req-main">
                                    <div className="u-strong u-sm">{req.title}</div>
                                    <div className="text-xs-muted">
                                        {req.event_date} · {req.grade ? `S${req.grade}` : 'All grades'}
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
                                        <div className="disc-stat-value">{loading ? '-' : s.value}</div>
                                        <div className="disc-stat-label">{s.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <ConsentRequestsPanel />

                        <div className="toolbar-card">
                            <FilterBar options={filterOptions} active={filter} onChange={setFilter} />
                            <div className="toolbar-spacer" />
                            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                                <span className="material-symbols-rounded">add</span> New Club
                            </button>
                        </div>

                        {loading ? (
                            <p className="u-pad u-muted">Loading activities…</p>
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
