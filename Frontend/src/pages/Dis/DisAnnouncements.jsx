import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DashboardContent } from '../../components/layout/DashboardContent'
import {
    getDisAnnouncements, createDisAnnouncement,
    updateDisAnnouncement, deleteDisAnnouncement,
} from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { disNavItems, disSecondaryItems, disUser } from './disNav'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
    { value: 'urgent',   label: 'Urgent',   icon: 'priority_high' },
    { value: 'academic', label: 'Academic', icon: 'gavel'          },
    { value: 'event',    label: 'Event',    icon: 'emoji_events'   },
    { value: 'general',  label: 'General',  icon: 'info'           },
]

const AUDIENCES = [
    { value: 'all',      label: 'Everyone',           icon: 'groups'          },
    { value: 'students', label: 'All Students',        icon: 'group'           },
    { value: 'teachers', label: 'All Teachers',        icon: 'badge'           },
    { value: 'parents',  label: 'Parents / Guardians', icon: 'family_restroom' },
]

const FILTERS = ['all', 'published', 'draft', 'archived']

const EMPTY_FORM = {
    title:           '',
    content:         '',
    category:        'general',
    target_audience: 'all',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoStr) {
    if (!isoStr) return ''
    const diff = Date.now() - new Date(isoStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'Just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 7)  return `${d}d ago`
    return new Date(isoStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function audienceLabel(val) {
    return AUDIENCES.find(a => a.value === val)?.label || val
}

// ── Announcement item ─────────────────────────────────────────────────────────

function AnnouncementItem({ ann, onEdit, onDelete, onPublish, onArchive }) {
    const cat     = CATEGORIES.find(c => c.value === ann.category) || CATEGORIES[3]
    const isDraft = ann.status === 'draft'
    const isArch  = ann.status === 'archived'
    const time    = isDraft
        ? `Last edited ${timeAgo(ann.updated_at)}`
        : timeAgo(ann.published_at || ann.created_at)

    return (
        <div className="ann-item">
            <div className="ann-item-header">
                <div className="ann-avatar">
                    {ann.author ? ann.author.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'DI'}
                </div>
                <div className="ann-item-meta">
                    <div className="ann-item-title">{ann.title || <em>Untitled</em>}</div>
                    <div className="ann-item-sub">
                        {isDraft ? 'Draft' : `Sent to: ${audienceLabel(ann.target_audience)}`}
                        &nbsp;&middot;&nbsp;{time}
                    </div>
                </div>
                <span className={`ann-badge ${ann.category}`}>{cat.label}</span>
                {isArch && <span className="ann-badge general" style={{ marginLeft: '.25rem' }}>Archived</span>}
            </div>
            <p className="ann-excerpt">{ann.content}</p>
            <div className="ann-item-footer">
                <span className="ann-views">
                    <span className="material-symbols-rounded">{isDraft ? 'draft' : 'visibility'}</span>
                    {isDraft ? 'Draft' : 'Published'}
                </span>
                <div className="ann-item-actions">
                    <button className="ann-icon-btn" title="Edit" onClick={() => onEdit(ann)}>
                        <span className="material-symbols-rounded">edit</span>
                    </button>
                    {isDraft && (
                        <button className="ann-icon-btn" title="Publish" onClick={() => onPublish(ann.id)}>
                            <span className="material-symbols-rounded">publish</span>
                        </button>
                    )}
                    {!isArch && !isDraft && (
                        <button className="ann-icon-btn" title="Archive" onClick={() => onArchive(ann.id)}>
                            <span className="material-symbols-rounded">archive</span>
                        </button>
                    )}
                    <button className="ann-icon-btn danger" title="Delete" onClick={() => onDelete(ann.id)}>
                        <span className="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DisAnnouncements() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [announcements, setAnnouncements] = useState([])
    const [total,         setTotal]         = useState(0)
    const [hasMore,       setHasMore]       = useState(false)
    const [loadingMore,   setLoadingMore]   = useState(false)
    const [loading,       setLoading]       = useState(true)
    const [activeFilter,  setActiveFilter]  = useState('all')
    const PAGE = 50

    const [form,       setForm]       = useState(EMPTY_FORM)
    const [editingId,  setEditingId]  = useState(null)
    const [saving,     setSaving]     = useState(false)
    const [formError,  setFormError]  = useState('')

    function fetchPage(offset = 0, append = false) {
        if (offset === 0) setLoading(true); else setLoadingMore(true)
        getDisAnnouncements({ limit: PAGE, offset })
            .then(data => {
                setTotal(data.total)
                setHasMore(data.has_more)
                setAnnouncements(prev => append ? [...prev, ...data.results] : data.results)
            })
            .catch(console.error)
            .finally(() => { setLoading(false); setLoadingMore(false) })
    }

    useEffect(() => { fetchPage(0) }, [])

    function reload() { fetchPage(0) }
    function loadMore() { fetchPage(announcements.length, true) }

    const filtered = announcements.filter(a => {
        if (activeFilter === 'all') return true
        return a.status === activeFilter
    })

    const countByStatus = s => announcements.filter(a => a.status === s).length

    const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

    function loadForEdit(ann) {
        setEditingId(ann.id)
        setForm({
            title:           ann.title,
            content:         ann.content,
            category:        ann.category,
            target_audience: ann.target_audience,
        })
        setFormError('')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    function handleClear() {
        setForm(EMPTY_FORM)
        setEditingId(null)
        setFormError('')
    }

    async function handleSave(annStatus) {
        if (!form.title.trim())   { setFormError('Title is required.');   return }
        if (!form.content.trim()) { setFormError('Content is required.'); return }
        setFormError('')
        setSaving(true)
        try {
            const payload = { ...form, status: annStatus }
            if (editingId) {
                await updateDisAnnouncement(editingId, payload)
            } else {
                await createDisAnnouncement(payload)
            }
            handleClear()
            reload()
        } catch (e) {
            setFormError('Failed to save. Please try again.')
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Delete this announcement?')) return
        try {
            await deleteDisAnnouncement(id)
            setAnnouncements(prev => prev.filter(a => a.id !== id))
        } catch (e) { console.error(e) }
    }

    async function handlePublish(id) {
        try {
            const updated = await updateDisAnnouncement(id, { status: 'published' })
            setAnnouncements(prev => prev.map(a => a.id === id ? updated : a))
        } catch (e) { console.error(e) }
    }

    async function handleArchive(id) {
        try {
            const updated = await updateDisAnnouncement(id, { status: 'archived' })
            setAnnouncements(prev => prev.map(a => a.id === id ? updated : a))
        } catch (e) { console.error(e) }
    }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Announcements"
                        subtitle="Compose and broadcast discipline notices"
                        {...disUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        <div className="ann-grid">

                            {/* ── LEFT: Compose / Edit form ── */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">
                                        <span className="material-symbols-rounded">edit_note</span>
                                        {editingId ? 'Edit Announcement' : 'Create New Announcement'}
                                    </h2>
                                    {editingId && (
                                        <button className="btn btn-outline btn-sm" onClick={handleClear}>
                                            <span className="material-symbols-rounded icon-sm">close</span> Cancel Edit
                                        </button>
                                    )}
                                </div>
                                <div className="card-content">

                                    {/* Category */}
                                    <div className="form-group ann-form-group">
                                        <label className="form-label">Category</label>
                                        <div className="ann-category-row">
                                            {CATEGORIES.map(c => (
                                                <label key={c.value} className={`ann-cat-label ${c.value}${form.category === c.value ? ' selected' : ''}`}>
                                                    <input type="radio" name="dis-cat" value={c.value}
                                                        checked={form.category === c.value}
                                                        onChange={set('category')} />
                                                    <span className="material-symbols-rounded">{c.icon}</span> {c.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <div className="form-group ann-form-group">
                                        <label className="form-label" htmlFor="disTitle">Announcement Title *</label>
                                        <input type="text" className="form-input" id="disTitle"
                                            placeholder="e.g. Curfew Reminder — All Boarders"
                                            value={form.title} onChange={set('title')} />
                                    </div>

                                    {/* Audience */}
                                    <div className="form-group ann-form-group">
                                        <label className="form-label">Send To</label>
                                        <div className="ann-audience-grid">
                                            {AUDIENCES.map(a => (
                                                <label key={a.value} className={`ann-audience-item${form.target_audience === a.value ? ' selected' : ''}`}>
                                                    <input type="radio" name="dis-audience" value={a.value}
                                                        checked={form.target_audience === a.value}
                                                        onChange={set('target_audience')} />
                                                    <span className="material-symbols-rounded">{a.icon}</span> {a.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="form-group ann-content-group">
                                        <label className="form-label" htmlFor="disContent">Announcement Content *</label>
                                        <textarea className="form-input" id="disContent" rows={6}
                                            placeholder="Type the full announcement details here..."
                                            value={form.content} onChange={set('content')}
                                            style={{ resize: 'vertical' }} />
                                    </div>

                                    {formError && (
                                        <p style={{ color: '#ef4444', fontSize: '.85rem', marginBottom: '.75rem' }}>{formError}</p>
                                    )}

                                    {/* Actions */}
                                    <div className="ann-form-actions">
                                        <button type="button" className="btn btn-outline" onClick={handleClear} disabled={saving}>
                                            Clear
                                        </button>
                                        <button type="button" className="btn btn-secondary" onClick={() => handleSave('draft')} disabled={saving}>
                                            <span className="material-symbols-rounded">draft</span>
                                            {saving ? 'Saving…' : 'Save Draft'}
                                        </button>
                                        <button type="button" className="btn btn-primary" onClick={() => handleSave('published')} disabled={saving}>
                                            <span className="material-symbols-rounded">send</span>
                                            {saving ? 'Publishing…' : (editingId ? 'Update & Publish' : 'Publish Now')}
                                        </button>
                                    </div>

                                </div>
                            </div>

                            {/* ── RIGHT: Recent Broadcasts ── */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Recent Broadcasts</h2>
                                    <span className="badge badge-published">{countByStatus('published')} of {total} loaded</span>
                                </div>
                                <div className="card-content">

                                    {/* Filter pills */}
                                    <div className="ann-filter-row">
                                        {FILTERS.map(f => (
                                            <button key={f} className={`ann-filter-pill${activeFilter === f ? ' active' : ''}`}
                                                onClick={() => setActiveFilter(f)}>
                                                {f.charAt(0).toUpperCase() + f.slice(1)}
                                                {f !== 'all' && (
                                                    <span className="es-chip-count" style={{ marginLeft: '.3rem' }}>
                                                        {countByStatus(f)}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* List */}
                                    {loading ? (
                                        <p className="es-empty-msg">Loading announcements…</p>
                                    ) : filtered.length === 0 ? (
                                        <div className="es-empty-state">
                                            <span className="material-symbols-rounded es-empty-icon">campaign</span>
                                            <p>No {activeFilter !== 'all' ? activeFilter : ''} announcements yet.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {filtered.map(ann => (
                                                <AnnouncementItem
                                                    key={ann.id}
                                                    ann={ann}
                                                    onEdit={loadForEdit}
                                                    onDelete={handleDelete}
                                                    onPublish={handlePublish}
                                                    onArchive={handleArchive}
                                                />
                                            ))}

                                            {hasMore && activeFilter === 'all' && (
                                                <div style={{ textAlign: 'center', padding: '.75rem 0' }}>
                                                    <button className="btn btn-outline btn-sm" onClick={loadMore} disabled={loadingMore}>
                                                        <span className="material-symbols-rounded icon-sm">expand_more</span>
                                                        {loadingMore ? 'Loading…' : `Load more (${total - announcements.length} remaining)`}
                                                    </button>
                                                </div>
                                            )}

                                            {!hasMore && announcements.length > 0 && (
                                                <p style={{ textAlign: 'center', fontSize: '.75rem', color: 'var(--muted-foreground)', padding: '.5rem 0' }}>
                                                    All {total} announcement{total !== 1 ? 's' : ''} loaded
                                                </p>
                                            )}
                                        </>
                                    )}

                                </div>
                            </div>

                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
