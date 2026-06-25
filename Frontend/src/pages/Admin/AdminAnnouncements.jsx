import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { EmptyState } from '../../components/ui/EmptyState'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import {
    getAdminAnnouncements, createAdminAnnouncement,
    updateAdminAnnouncement, deleteAdminAnnouncement,
    getAdminAudienceOptions, getAnnouncementTemplates,
} from '../../api/admin'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import '../../styles/tables.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
    { value: 'general',  label: 'General'  },
    { value: 'academic', label: 'Academic' },
    { value: 'event',    label: 'Events'   },
    { value: 'urgent',   label: 'Urgent'   },
]

const CAT_STYLE = {
    urgent:   { borderColor: 'var(--destructive)',   badge: 'var(--destructive-light)',   text: 'var(--destructive)',   icon: 'priority_high'  },
    academic: { borderColor: '#3b82f6',              badge: '#dbeafe',                    text: '#2563eb',              icon: 'school'         },
    event:    { borderColor: '#8b5cf6',              badge: '#ede9fe',                    text: '#7c3aed',              icon: 'emoji_events'   },
    general:  { borderColor: 'var(--muted-foreground)', badge: 'var(--muted)',            text: 'var(--muted-foreground)', icon: 'campaign'    },
}

const TABS = [
    { key: 'all',      label: 'All'      },
    { key: 'academic', label: 'Academic' },
    { key: 'events',   label: 'Events'   },
    { key: 'general',  label: 'General'  },
    { key: 'urgent',   label: 'Urgent'   },
    { key: 'drafts',   label: 'Drafts'   },
]

const EMPTY_FORM = { category: 'general', title: '', content: '', audienceKey: 'all', target_grade: '', status: 'published' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function relDate(dateStr) {
    if (!dateStr) return ''
    const d    = new Date(dateStr)
    const diff = Math.floor((Date.now() - d) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff < 7)  return `${diff}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function audienceLabel(ann) {
    if (!ann.target_audience || ann.target_audience === 'all') return 'School-wide'
    if (ann.target_grade) return ann.target_grade
    if (ann.target_audience === 'parents') return 'Parents only'
    return ann.target_audience
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeleteModal({ target, onClose, onConfirm }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm modal-confirm" onClick={e => e.stopPropagation()}>
                <h2 className="modal-confirm-title">Delete Announcement?</h2>
                <p className="modal-confirm-desc">
                    "<strong>{target.title}</strong>" will be permanently removed.
                </p>
                <div className="modal-confirm-actions">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary btn-destructive" onClick={onConfirm}>
                        <span className="material-symbols-rounded">delete</span> Delete
                    </button>
                </div>
            </div>
        </div>
    )
}

function AnnCard({ ann, onEdit, onDelete, onPublish }) {
    const cat  = CAT_STYLE[ann.category] || CAT_STYLE.general
    const date = ann.published_at || ann.created_at

    return (
        <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderLeft: `4px solid ${cat.borderColor}`,
            borderRadius: 12,
            padding: '1rem 1.25rem',
            display: 'flex',
            gap: '1rem',
        }}>
            <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: cat.badge,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 2,
            }}>
                <span className="material-symbols-rounded" style={{ color: cat.text, fontSize: '1rem' }}>{cat.icon}</span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                    <span style={{
                        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                        background: cat.badge, color: cat.text, borderRadius: 4, padding: '0.1rem 0.45rem',
                    }}>{ann.category}</span>

                    {ann.status === 'draft' && (
                        <span className="adm-badge pending" style={{ fontSize: '0.68rem' }}>Draft</span>
                    )}

                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        {relDate(date)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        · {audienceLabel(ann)}
                    </span>
                </div>

                <h4 style={{ margin: '0 0 0.3rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)' }}>
                    {ann.title}
                </h4>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--muted-foreground)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {ann.content}
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="adm-btn" onClick={() => onEdit(ann)}>
                        <span className="material-symbols-rounded">edit</span> Edit
                    </button>
                    {ann.status === 'draft' && (
                        <button
                            className="adm-btn"
                            style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
                            onClick={() => onPublish(ann)}
                        >
                            <span className="material-symbols-rounded">send</span> Publish
                        </button>
                    )}
                    <button className="adm-btn danger" onClick={() => onDelete(ann)} title="Delete">
                        <span className="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

function TemplateChips({ templates, onSelect }) {
    if (!templates.length) return null
    return (
        <div style={{ marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Quick Templates
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {templates.map(t => (
                    <button key={t.key} type="button" className="filter-chip" onClick={() => onSelect(t)}>
                        {t.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

function AudienceChips({ options, audienceKey, targetGrade, onChange }) {
    return (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {options.map((o, i) => {
                const active = audienceKey === o.target_audience && (targetGrade || '') === (o.target_grade || '')
                return (
                    <button
                        key={i}
                        type="button"
                        className={`filter-chip${active ? ' active' : ''}`}
                        onClick={() => onChange(o.target_audience, o.target_grade || '')}
                    >
                        {o.label}
                    </button>
                )
            })}
        </div>
    )
}

function AnnForm({ initial, audienceOptions, templates, onSave, onCancel, saving }) {
    const [form,  setForm]  = useState(initial)
    const [error, setError] = useState('')

    function set(key, val) { setForm(f => ({ ...f, [key]: val })); setError('') }

    function applyTemplate(t) {
        setForm(f => ({ ...f, category: t.category || f.category, title: t.title, content: t.content }))
        setError('')
    }

    function handleSubmit(status) {
        if (!form.title.trim())   { setError('Title is required.');   return }
        if (!form.content.trim()) { setError('Content is required.'); return }
        onSave({ ...form, status })
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <TemplateChips templates={templates} onSelect={applyTemplate} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
                <div className="form-group form-group-0">
                    <label className="form-label">Title *</label>
                    <input
                        className="form-input"
                        value={form.title}
                        onChange={e => set('title', e.target.value)}
                        placeholder="Announcement title"
                        autoFocus
                    />
                </div>
                <div className="form-group form-group-0">
                    <label className="form-label">Category</label>
                    <select className="form-input" value={form.category} onChange={e => set('category', e.target.value)}>
                        {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
            </div>

            <div className="form-group form-group-0">
                <label className="form-label">Audience</label>
                <AudienceChips
                    options={audienceOptions}
                    audienceKey={form.audienceKey}
                    targetGrade={form.target_grade}
                    onChange={(key, grade) => setForm(f => ({ ...f, audienceKey: key, target_grade: grade }))}
                />
            </div>

            <div className="form-group form-group-0">
                <label className="form-label">Content *</label>
                <textarea
                    className="form-input"
                    rows={5}
                    value={form.content}
                    onChange={e => set('content', e.target.value)}
                    placeholder="Write your announcement here…"
                />
            </div>

            {error && <p style={{ color: 'var(--destructive)', fontSize: '0.85rem' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
                <button className="btn btn-primary" disabled={saving} onClick={() => handleSubmit('published')}>
                    <span className="material-symbols-rounded">send</span>
                    {saving ? 'Publishing…' : 'Publish'}
                </button>
                <button className="btn btn-outline" disabled={saving} onClick={() => handleSubmit('draft')}>
                    <span className="material-symbols-rounded">save</span>
                    Save Draft
                </button>
                <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminAnnouncements() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [announcements,   setAnnouncements]   = useState([])
    const [draftCount,      setDraftCount]      = useState(0)
    const [urgentCount,     setUrgentCount]     = useState(0)
    const [publishedCount,  setPublishedCount]  = useState(0)
    const [audienceOptions, setAudienceOptions] = useState([
        { label: 'All Classes',  target_audience: 'all',     target_grade: '' },
        { label: 'Parents Only', target_audience: 'parents', target_grade: '' },
    ])
    const [templates,       setTemplates]       = useState([])
    const [loading,         setLoading]         = useState(true)
    const [activeTab,       setActiveTab]       = useState('all')
    const [search,          setSearch]          = useState('')
    const [composing,       setComposing]       = useState(false)
    const [editing,         setEditing]         = useState(null)
    const [saving,          setSaving]          = useState(false)
    const [deleteTarget,    setDeleteTarget]    = useState(null)

    const load = useCallback((tab = activeTab) => {
        const params = tab === 'all' ? {} : { tab }
        return getAdminAnnouncements(params)
            .then(data => {
                const list = Array.isArray(data) ? data : (data?.results ?? [])
                setAnnouncements(list)
                setDraftCount(data?.draft_count ?? list.filter(a => a.status === 'draft').length)
                setUrgentCount(list.filter(a => a.category === 'urgent').length)
                setPublishedCount(list.filter(a => a.status === 'published').length)
            })
            .catch(() => {})
    }, [activeTab])

    useEffect(() => {
        Promise.all([
            load('all'),
            getAdminAudienceOptions().catch(() => null),
            getAnnouncementTemplates().catch(() => []),
        ]).then(([, opts, tmpl]) => {
            if (Array.isArray(opts) && opts.length) setAudienceOptions(opts)
            if (Array.isArray(tmpl) && tmpl.length) setTemplates(tmpl)
        }).finally(() => setLoading(false))
    }, [])

    function switchTab(tab) {
        setActiveTab(tab)
        setSearch('')
        setLoading(true)
        load(tab).finally(() => setLoading(false))
    }

    async function handleSave(form) {
        setSaving(true)
        const payload = {
            title:           form.title.trim(),
            content:         form.content.trim(),
            category:        form.category,
            target_audience: form.audienceKey,
            target_grade:    form.target_grade || '',
            status:          form.status,
        }
        try {
            if (editing) {
                await updateAdminAnnouncement(editing.id, payload)
            } else {
                await createAdminAnnouncement(payload)
            }
            setComposing(false)
            setEditing(null)
            setLoading(true)
            await load(activeTab)
        } catch {}
        finally { setSaving(false); setLoading(false) }
    }

    async function handlePublish(ann) {
        try {
            await updateAdminAnnouncement(ann.id, { status: 'published' })
            setLoading(true)
            await load(activeTab)
        } catch {} finally { setLoading(false) }
    }

    async function handleDeleteConfirm() {
        if (!deleteTarget) return
        try {
            await deleteAdminAnnouncement(deleteTarget.id)
            setLoading(true)
            await load(activeTab)
        } catch {} finally { setDeleteTarget(null); setLoading(false) }
    }

    function startEdit(ann) {
        setEditing(ann)
        setComposing(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const q = search.trim().toLowerCase()
    const visible = q
        ? announcements.filter(a =>
            a.title?.toLowerCase().includes(q) ||
            a.content?.toLowerCase().includes(q) ||
            a.category?.toLowerCase().includes(q)
          )
        : announcements

    const statCards = [
        { icon: 'campaign',      value: loading ? '—' : publishedCount,         label: 'Published',  trend: 'Live announcements',   colorClass: 'info'    },
        { icon: 'draft',         value: loading ? '—' : draftCount,             label: 'Drafts',     trend: 'Saved, not sent',      colorClass: 'warning' },
        { icon: 'priority_high', value: loading ? '—' : urgentCount,            label: 'Urgent',     trend: 'Requires attention',   colorClass: ''        },
        { icon: 'feed',          value: loading ? '—' : announcements.length,   label: 'Total',      trend: 'This view',            colorClass: 'success' },
    ]

    return (
        <>
            {deleteTarget && (
                <DeleteModal
                    target={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={handleDeleteConfirm}
                />
            )}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Announcements"
                        subtitle="Compose and broadcast school-wide notices"
                        {...adminUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        {/* Stats */}
                        <div className="portal-stat-grid">
                            {statCards.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        {/* Compose form */}
                        {composing && (
                            <div className="card" style={{ marginBottom: '1.25rem' }}>
                                <div className="card-header">
                                    <h2 className="card-title">
                                        {editing ? 'Edit Announcement' : 'New Announcement'}
                                    </h2>
                                    <button
                                        className="btn-icon-clean"
                                        onClick={() => { setComposing(false); setEditing(null) }}
                                        title="Close"
                                    >
                                        <span className="material-symbols-rounded">close</span>
                                    </button>
                                </div>
                                <div className="card-content">
                                    <AnnForm
                                        initial={editing ? {
                                            category:     editing.category,
                                            title:        editing.title,
                                            content:      editing.content,
                                            audienceKey:  editing.target_audience || 'all',
                                            target_grade: editing.target_grade || '',
                                            status:       editing.status,
                                        } : EMPTY_FORM}
                                        audienceOptions={audienceOptions}
                                        templates={templates}
                                        onSave={handleSave}
                                        onCancel={() => { setComposing(false); setEditing(null) }}
                                        saving={saving}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Toolbar: tabs + search + compose button */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div className="filter-chips" style={{ marginBottom: 0 }}>
                                {TABS.map(t => (
                                    <button
                                        key={t.key}
                                        className={`filter-chip${activeTab === t.key ? ' active' : ''}`}
                                        onClick={() => switchTab(t.key)}
                                    >
                                        {t.label}
                                        {t.key === 'drafts' && draftCount > 0 && (
                                            <span style={{
                                                marginLeft: '0.3rem', fontSize: '0.68rem', fontWeight: 700,
                                                background: activeTab === t.key ? 'rgba(255,255,255,0.25)' : 'var(--muted)',
                                                color: activeTab === t.key ? '#fff' : 'var(--muted-foreground)',
                                                borderRadius: 10, padding: '0.05rem 0.35rem',
                                            }}>{draftCount}</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {!composing && (
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => { setEditing(null); setComposing(true) }}
                                >
                                    <span className="material-symbols-rounded">add</span>
                                    New Announcement
                                </button>
                            )}
                        </div>

                        {/* Search */}
                        <div className="toolbar-card" style={{ marginBottom: '1rem' }}>
                            <div className="toolbar-search">
                                <span className="material-symbols-rounded">search</span>
                                <input
                                    placeholder="Search by title, content or category…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button className="toolbar-search-clear" onClick={() => setSearch('')}>
                                        <span className="material-symbols-rounded">close</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Feed */}
                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading…</p>
                        ) : visible.length === 0 ? (
                            <EmptyState
                                icon="campaign"
                                title={search ? `No results for "${search}"` : 'No announcements'}
                                desc={search ? 'Try a different search term.' : 'Switch tabs or create a new announcement.'}
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {visible.map(a => (
                                    <AnnCard
                                        key={a.id}
                                        ann={a}
                                        onEdit={startEdit}
                                        onDelete={setDeleteTarget}
                                        onPublish={handlePublish}
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
