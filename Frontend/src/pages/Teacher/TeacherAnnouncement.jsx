import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { EmptyState } from '../../components/ui/EmptyState'
import {
    getTeacherAnnouncements, createTeacherAnnouncement,
    updateTeacherAnnouncement, deleteTeacherAnnouncement,
    getTeacherAudienceOptions,
} from '../../api/teacher'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import '../../styles/pages.css'

const CATEGORY_OPTIONS = [
    { value: 'academic', label: 'Academic' },
    { value: 'event',    label: 'Events'   },
    { value: 'general',  label: 'General'  },
    { value: 'urgent',   label: 'Urgent'   },
]

const TEMPLATES = [
    { label: 'Homework Reminder',  category: 'academic', title: 'Homework Reminder',        content: 'Dear students, please remember to complete and submit your homework by the deadline. Late submissions will not be accepted without a valid reason.' },
    { label: 'Exam Schedule',      category: 'academic', title: 'Upcoming Exam Schedule',    content: 'Please take note of the upcoming examination schedule. Make sure you arrive at least 15 minutes before the exam starts. Bring all required materials.' },
    { label: 'Class Canceled',     category: 'general',  title: 'Class Canceled',            content: "Please be informed that today's class has been canceled. We will reschedule to a later date. Apologies for any inconvenience." },
    { label: 'Congratulations',    category: 'general',  title: 'Congratulations!',          content: 'We would like to congratulate our students on their excellent performance. Keep up the great work!' },
    { label: 'Important Notice',   category: 'urgent',   title: 'Important Notice',          content: 'This is an important notice that requires your immediate attention. Please read carefully and act accordingly.' },
    { label: 'Reading Assignment', category: 'academic', title: 'Reading Assignment',        content: 'Please complete the reading assignment before our next session. Be prepared to discuss the key points in class.' },
]

const FILTER_CHIPS = ['All', 'Academic', 'Events', 'General', 'Urgent', 'Drafts']

const CATEGORY_ICON = {
    urgent:   'priority_high',
    academic: 'school',
    event:    'emoji_events',
    general:  'campaign',
}

const CATEGORY_COLOR = {
    urgent:   'var(--destructive)',
    academic: 'var(--primary)',
    event:    '#7c3aed',
    general:  'var(--success)',
}

const EMPTY_FORM = { category: '', title: '', content: '', audienceKey: 'all' }

function chipMatch(ann, chip) {
    if (chip === 'All')      return true
    if (chip === 'Drafts')   return ann.status === 'draft'
    if (chip === 'Academic') return ann.category === 'academic' && ann.status !== 'draft'
    if (chip === 'Events')   return ann.category === 'event'    && ann.status !== 'draft'
    if (chip === 'General')  return ann.category === 'general'  && ann.status !== 'draft'
    if (chip === 'Urgent')   return ann.category === 'urgent'   && ann.status !== 'draft'
    return true
}

// ── Announcement card ─────────────────────────────────────────────────────────
function AnnouncementCard({ ann, onEdit, onDelete, onPublish, busy }) {
    const cat     = ann.category || 'general'
    const icon    = CATEGORY_ICON[cat] || 'campaign'
    const color   = CATEGORY_COLOR[cat] || 'var(--primary)'
    const isDraft = ann.status === 'draft'
    const date    = ann.published_at || ann.created_at
    const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
    const audience = ann.target_grade
        ? ann.target_grade
        : ann.target_audience === 'parents' ? 'Parents' : 'All Classes'

    return (
        <div className="ann-item" style={{ borderLeft: `3px solid ${isDraft ? '#f59e0b' : color}` }}>
            <div className="ann-item-top">
                <div className="ann-item-icon" style={{ background: `${isDraft ? '#f59e0b' : color}18`, color: isDraft ? '#f59e0b' : color }}>
                    <span className="material-symbols-rounded">{isDraft ? 'draft' : icon}</span>
                </div>
                <div className="ann-item-head" style={{ flex: 1, minWidth: 0 }}>
                    <div className="ann-item-title">{ann.title}</div>
                    <div className="ann-item-meta">
                        {isDraft
                            ? <span style={{ color: '#f59e0b', fontWeight: 600 }}>Draft</span>
                            : <span style={{ color, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.72rem' }}>{cat}</span>
                        }
                        <span>·</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>group</span>
                            {audience}
                        </span>
                        <span>·</span>
                        <span>{dateStr}</span>
                    </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                    {isDraft && (
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onPublish(ann)}
                            disabled={busy === ann.id}
                            title="Publish now"
                        >
                            <span className="material-symbols-rounded icon-sm">send</span>
                            {busy === ann.id ? 'Publishing…' : 'Publish'}
                        </button>
                    )}
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onEdit(ann)}
                        title="Edit"
                    >
                        <span className="material-symbols-rounded icon-sm">edit</span>
                    </button>
                    <button
                        className="btn btn-outline btn-sm btn-destructive-outline"
                        onClick={() => onDelete(ann)}
                        title="Delete"
                    >
                        <span className="material-symbols-rounded icon-sm">delete</span>
                    </button>
                </div>
            </div>
            <div className="ann-item-body">{ann.content}</div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function TeacherAnnouncement() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [announcements,  setAnnouncements]  = useState([])
    const [audienceOpts,   setAudienceOpts]   = useState([])
    const [loading,        setLoading]        = useState(true)
    const [chip,           setChip]           = useState('All')
    const [form,           setForm]           = useState({ ...EMPTY_FORM })
    const [editingId,      setEditingId]      = useState(null)
    const [saving,         setSaving]         = useState(false)
    const [busyId,         setBusyId]         = useState(null)
    const [successMsg,     setSuccessMsg]     = useState(null)
    const [error,          setError]          = useState(null)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Teacher'
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    function flash(msg) {
        setSuccessMsg(msg)
        setTimeout(() => setSuccessMsg(null), 3000)
    }

    function loadAnnouncements() {
        setLoading(true)
        getTeacherAnnouncements()
            .then(res => setAnnouncements(Array.isArray(res) ? res : (res?.results ?? [])))
            .catch(() => setAnnouncements([]))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        loadAnnouncements()
        getTeacherAudienceOptions()
            .then(data => setAudienceOpts(Array.isArray(data) ? data : []))
            .catch(() => {})
    }, [])

    // Build a stable key for each audience option
    function audienceKey(opt) {
        return opt.target_grade ? `grade:${opt.target_grade}` : opt.target_audience
    }

    // Resolve selected option from form.audienceKey
    function selectedAudience() {
        return audienceOpts.find(o => audienceKey(o) === form.audienceKey) || audienceOpts[0]
    }

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function handleTemplate(t) {
        setForm(prev => ({ ...prev, category: t.category, title: t.title, content: t.content }))
    }

    function handleEdit(ann) {
        setEditingId(ann.id)
        const matchedOpt = audienceOpts.find(o =>
            ann.target_grade
                ? o.target_grade === ann.target_grade
                : o.target_audience === ann.target_audience && !o.target_grade
        )
        setForm({
            category:    ann.category || '',
            title:       ann.title    || '',
            content:     ann.content  || '',
            audienceKey: matchedOpt ? audienceKey(matchedOpt) : 'all',
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    function handleCancelEdit() {
        setEditingId(null)
        setForm({ ...EMPTY_FORM })
        setError(null)
    }

    async function handleDelete(ann) {
        if (!window.confirm(`Delete "${ann.title}"?`)) return
        setBusyId(ann.id)
        try {
            await deleteTeacherAnnouncement(ann.id)
            setAnnouncements(prev => prev.filter(a => a.id !== ann.id))
            if (editingId === ann.id) handleCancelEdit()
        } catch {
            setError('Failed to delete announcement.')
        } finally {
            setBusyId(null)
        }
    }

    async function handlePublishDraft(ann) {
        setBusyId(ann.id)
        try {
            const updated = await updateTeacherAnnouncement(ann.id, { status: 'published' })
            setAnnouncements(prev => prev.map(a => a.id === ann.id ? updated : a))
            flash('Announcement published!')
        } catch {
            setError('Failed to publish.')
        } finally {
            setBusyId(null)
        }
    }

    async function submit(status) {
        if (!form.title || !form.content || !form.category) return
        setSaving(true); setError(null)
        const aud = selectedAudience()
        const payload = {
            title:           form.title,
            content:         form.content,
            category:        form.category,
            target_audience: aud?.target_audience || 'all',
            target_grade:    aud?.target_grade    || '',
            status,
        }
        try {
            if (editingId) {
                const updated = await updateTeacherAnnouncement(editingId, payload)
                setAnnouncements(prev => prev.map(a => a.id === editingId ? updated : a))
                handleCancelEdit()
                flash('Announcement updated.')
            } else {
                const created = await createTeacherAnnouncement(payload)
                setAnnouncements(prev => [created, ...prev])
                setForm({ ...EMPTY_FORM })
                flash(status === 'published' ? 'Published!' : 'Saved as draft.')
            }
        } catch {
            setError('Failed to save. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    const isValid    = form.title && form.content && form.category
    const visible    = announcements.filter(a => chipMatch(a, chip))
    const draftCount = announcements.filter(a => a.status === 'draft').length
    const charCount  = form.content.length

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Announcements"
                        subtitle="Create and manage class announcements"
                        userName={fullName}
                        userRole="Teacher"
                        userInitials={initials}
                        avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        {/* Success toast */}
                        {successMsg && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                background: 'rgba(16,185,129,0.1)', border: '1px solid var(--success)',
                                borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1rem',
                                color: 'var(--success)', fontWeight: 500, fontSize: '0.875rem',
                            }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>check_circle</span>
                                {successMsg}
                            </div>
                        )}

                        {/* Create / Edit form */}
                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">
                                    {editingId ? 'Edit Announcement' : 'New Announcement'}
                                </h3>
                                {editingId && (
                                    <button className="btn btn-outline btn-sm" onClick={handleCancelEdit}>
                                        <span className="material-symbols-rounded icon-sm">close</span>
                                        Cancel Edit
                                    </button>
                                )}
                            </div>
                            <div className="card-content">
                                <div className="flex-column-gap">

                                    {/* Row 1: category + audience */}
                                    <div className="resp-grid-2" style={{ gap: '0.75rem' }}>
                                        <div className="form-group">
                                            <label className="label" htmlFor="teacher-ann-category">Category *</label>
                                            <select id="teacher-ann-category" className="input" name="category" value={form.category} onChange={handleChange}>
                                                <option value="">Select category…</option>
                                                {CATEGORY_OPTIONS.map(o => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Audience</label>
                                            <select
                                                className="input"
                                                value={form.audienceKey}
                                                onChange={e => setForm(p => ({ ...p, audienceKey: e.target.value }))}
                                            >
                                                {audienceOpts.length === 0 && (
                                                    <option value="all">All Classes</option>
                                                )}
                                                {audienceOpts.map(o => (
                                                    <option key={audienceKey(o)} value={audienceKey(o)}>{o.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <div className="form-group">
                                        <label className="label">Title *</label>
                                        <input
                                            type="text" className="input" name="title"
                                            value={form.title} onChange={handleChange}
                                            placeholder="Announcement title…"
                                        />
                                    </div>

                                    {/* Message + char count */}
                                    <div className="form-group">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                                            <label className="label" style={{ margin: 0 }}>Message *</label>
                                            <span style={{ fontSize: '0.75rem', color: charCount > 800 ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
                                                {charCount} / 1000
                                            </span>
                                        </div>
                                        <textarea
                                            className="input" rows="4" name="content"
                                            value={form.content} onChange={handleChange}
                                            placeholder="Write your announcement…"
                                            maxLength={1000}
                                        />
                                    </div>

                                    {error && (
                                        <p style={{ color: 'var(--destructive)', fontSize: '0.85rem', margin: 0 }}>{error}</p>
                                    )}

                                    {/* Actions */}
                                    <div className="action-toolbar">
                                        {!editingId && (
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => submit('draft')}
                                                disabled={saving || !isValid}
                                            >
                                                <span className="material-symbols-rounded icon-sm">save</span>
                                                Save Draft
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => submit('published')}
                                            disabled={saving || !isValid}
                                        >
                                            <span className="material-symbols-rounded icon-sm">
                                                {editingId ? 'save' : 'send'}
                                            </span>
                                            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Publish'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Templates */}
                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">Quick Templates</h3>
                                <p className="card-description">Click to pre-fill the form</p>
                            </div>
                            <div className="card-content">
                                <div className="filter-group">
                                    {TEMPLATES.map(t => (
                                        <button key={t.label} className="btn btn-outline btn-sm" onClick={() => handleTemplate(t)}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Filter chips */}
                        <div className="ann-chip-bar mb-1">
                            {FILTER_CHIPS.map(c => (
                                <button
                                    key={c}
                                    className={`ann-chip${chip === c ? ' active' : ''}`}
                                    onClick={() => setChip(c)}
                                >
                                    {c}
                                    {c === 'Drafts' && draftCount > 0 && (
                                        <span style={{ marginLeft: '0.25rem', background: 'rgba(0,0,0,0.15)', borderRadius: 9, padding: '0 5px', fontSize: '0.7rem' }}>
                                            {draftCount}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* List */}
                        {loading ? (
                            <p style={{ color: 'var(--muted-foreground)', padding: '1rem 0' }}>Loading announcements…</p>
                        ) : visible.length === 0 ? (
                            <EmptyState
                                icon="campaign"
                                title="No announcements"
                                description={chip === 'All'
                                    ? "You haven't published any announcements yet."
                                    : `No ${chip.toLowerCase()} announcements found.`}
                            />
                        ) : (
                            <div className="ann-list">
                                {visible.map(ann => (
                                    <AnnouncementCard
                                        key={ann.id}
                                        ann={ann}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        onPublish={handlePublishDraft}
                                        busy={busyId}
                                    />
                                ))}
                            </div>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
