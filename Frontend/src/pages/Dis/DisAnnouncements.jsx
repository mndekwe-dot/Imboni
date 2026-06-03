import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { getDisAnnouncements, createDisAnnouncement } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const CATEGORIES = [
    { value: 'urgent',   label: 'Urgent',   icon: 'priority_high' },
    { value: 'academic', label: 'Academic',  icon: 'gavel'         },
    { value: 'event',    label: 'Events',    icon: 'emoji_events'  },
    { value: 'general',  label: 'General',   icon: 'info'          },
]

const AUDIENCES = [
    { value: 'all',      label: 'All Users',          icon: 'group'           },
    { value: 'students', label: 'Students',            icon: 'school'          },
    { value: 'teachers', label: 'Teachers',            icon: 'badge'           },
    { value: 'parents',  label: 'Parents / Guardians', icon: 'family_restroom' },
]

const AUDIENCE_LABEL = Object.fromEntries(AUDIENCES.map(a => [a.value, a.label]))

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function BroadcastItem({ ann, onDelete }) {
    const isDraft   = ann.status === 'draft'
    const badge     = CATEGORIES.find(c => c.value === ann.category)?.label || ann.category
    const badgeCls  = ann.category === 'urgent' ? 'urgent' : ann.category === 'event' ? 'event' : 'general'
    const sentTo    = AUDIENCE_LABEL[ann.target_audience] || ann.target_audience
    const avatar    = initials(ann.author || 'Discipline')
    const time      = ann.published_at
        ? new Date(ann.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    return (
        <div className="ann-item">
            <div className="ann-item-header">
                <div className="ann-avatar">{avatar}</div>
                <div className="ann-item-meta">
                    <div className="ann-item-title">{ann.title}</div>
                    <div className="ann-item-sub">
                        {isDraft ? 'Draft' : `Sent to: ${sentTo}`} &nbsp;&middot;&nbsp; {time}
                    </div>
                </div>
                <span className={`ann-badge ${badgeCls}`}>{badge}</span>
            </div>
            <p className="ann-excerpt">{ann.content}</p>
            <div className="ann-item-footer">
                <span className="ann-views">
                    <span className="material-symbols-rounded">{isDraft ? 'draft' : 'campaign'}</span>
                    {isDraft ? 'Draft' : 'Published'}
                </span>
                <div className="ann-item-actions">
                    {onDelete && (
                        <button className="ann-icon-btn danger" onClick={onDelete}>
                            <span className="material-symbols-rounded">delete</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export function DisAnnouncements() {
    const [announcements,  setAnnouncements]  = useState([])
    const [loading,        setLoading]        = useState(true)
    const [saving,         setSaving]         = useState(false)
    const [published,      setPublished]      = useState(false)
    const [broadcastFilter,setBroadcastFilter]= useState('all')

    const [category,  setCategory]  = useState('general')
    const [audience,  setAudience]  = useState('all')
    const [form,      setForm]      = useState({ title: '', content: '' })

    useEffect(() => {
        getDisAnnouncements()
            .then(setAnnouncements)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    async function handlePublish() {
        if (!form.title.trim() || !form.content.trim()) return
        setSaving(true)
        try {
            const created = await createDisAnnouncement({
                title:           form.title,
                content:         form.content,
                category,
                target_audience: audience,
                status:          'published',
            })
            setAnnouncements(prev => [created, ...prev])
            setForm({ title: '', content: '' })
            setCategory('general')
            setAudience('all')
            setPublished(true)
            setTimeout(() => setPublished(false), 3000)
        } catch (e) { console.error(e) }
        setSaving(false)
    }

    function handleDelete(id) {
        setAnnouncements(prev => prev.filter(a => a.id !== id))
    }

    const visible = announcements.filter(a => {
        if (broadcastFilter === 'published') return a.status === 'published'
        if (broadcastFilter === 'drafts')    return a.status === 'draft'
        return true
    })

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
                    />

                    <DashboardContent>
                        <div className="ann-grid">

                            {/* LEFT — Compose */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">
                                        <span className="material-symbols-rounded">edit_note</span> Create Announcement
                                    </h2>
                                </div>
                                <div className="card-content">

                                    <div className="form-group ann-form-group">
                                        <label className="form-label">Category</label>
                                        <div className="ann-category-row">
                                            {CATEGORIES.map(cat => (
                                                <label key={cat.value}
                                                    className={`ann-cat-label ${cat.value === 'urgent' ? 'urgent' : cat.value === 'event' ? 'event' : 'general'}`}>
                                                    <input type="radio" name="dis-cat" value={cat.value}
                                                        checked={category === cat.value}
                                                        onChange={() => setCategory(cat.value)} />
                                                    <span className="material-symbols-rounded">{cat.icon}</span> {cat.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="form-group ann-form-group">
                                        <label className="form-label" htmlFor="disTitle">Title</label>
                                        <input type="text" className="form-input" id="disTitle" name="title"
                                            value={form.title} onChange={handleChange}
                                            placeholder="e.g. Curfew Reminder — All Boarders" />
                                    </div>

                                    <div className="form-group ann-form-group">
                                        <label className="form-label">Send To</label>
                                        <div className="ann-audience-grid">
                                            {AUDIENCES.map(a => (
                                                <label key={a.value} className="ann-audience-item">
                                                    <input type="radio" name="dis-audience" checked={audience === a.value}
                                                        onChange={() => setAudience(a.value)} />
                                                    <span className="material-symbols-rounded">{a.icon}</span> {a.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="form-group ann-content-group">
                                        <label className="form-label" htmlFor="disContent">Content</label>
                                        <textarea className="form-input" id="disContent" name="content" rows={6}
                                            value={form.content} onChange={handleChange}
                                            placeholder="Type the full announcement details here..." />
                                    </div>

                                    <div className="ann-form-actions">
                                        <button type="button" className="btn btn-secondary"
                                            onClick={() => { setForm({ title: '', content: '' }); setAudience('all'); setCategory('general') }}>
                                            Clear
                                        </button>
                                        <button type="button" className="btn btn-primary"
                                            onClick={handlePublish}
                                            disabled={!form.title.trim() || !form.content.trim() || saving}
                                            style={published ? { background: 'var(--success)' } : {}}>
                                            <span className="material-symbols-rounded">{published ? 'check' : 'send'}</span>
                                            {published ? 'Published!' : saving ? 'Saving…' : 'Publish Now'}
                                        </button>
                                    </div>

                                </div>
                            </div>

                            {/* RIGHT — Recent Broadcasts */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Recent Broadcasts</h2>
                                    <span className="badge badge-published">
                                        {announcements.filter(a => a.status === 'published').length} published
                                    </span>
                                </div>
                                <div className="card-content">
                                    <div className="ann-filter-row">
                                        {['all', 'published', 'drafts'].map(f => (
                                            <button key={f}
                                                className={`ann-filter-pill${broadcastFilter === f ? ' active' : ''}`}
                                                onClick={() => setBroadcastFilter(f)}>
                                                {f.charAt(0).toUpperCase() + f.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                    {loading ? (
                                        <p style={{ color: 'var(--muted-foreground)', padding: '1rem' }}>Loading…</p>
                                    ) : visible.length === 0 ? (
                                        <p style={{ color: 'var(--muted-foreground)', padding: '1rem' }}>No announcements found.</p>
                                    ) : (
                                        <div>
                                            {visible.map(a => (
                                                <BroadcastItem key={a.id} ann={a} onDelete={() => handleDelete(a.id)} />
                                            ))}
                                        </div>
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
