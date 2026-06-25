import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import {
    getDosAnnouncements, createDosAnnouncement,
    updateDosAnnouncement, deleteDosAnnouncement,
} from '../../api/dos'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
    { value: 'urgent',   label: 'Urgent',   icon: 'priority_high' },
    { value: 'academic', label: 'Academic', icon: 'school'         },
    { value: 'event',    label: 'Event',    icon: 'event'          },
    { value: 'general',  label: 'General',  icon: 'info'           },
]

const AUDIENCES = [
    { value: 'all',            label: 'Everyone',           icon: 'groups'          },
    { value: 'teachers',       label: 'All Teachers',       icon: 'school'          },
    { value: 'students',       label: 'All Students',       icon: 'group'           },
    { value: 'parents',        label: 'Parents / Guardians',icon: 'family_restroom' },
    { value: 'grade_specific', label: 'Specific Year',      icon: 'filter_list'     },
]

const FILTERS = ['all', 'published', 'draft', 'archived']

const EMPTY_FORM = {
    title:           '',
    content:         '',
    category:        'academic',
    target_audience: 'all',
    target_grade:    '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoStr) {
    if (!isoStr) return ''
    const diff = Date.now() - new Date(isoStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)   return 'Just now'
    if (m < 60)  return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24)  return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 7)   return `${d}d ago`
    return new Date(isoStr).toLocaleDateString('en-GB', { day:'numeric', month:'short' })
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
                <div className="ann-avatar">{ann.author ? ann.author.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : 'AN'}</div>
                <div className="ann-item-meta">
                    <div className="ann-item-title">{ann.title || <em>Untitled</em>}</div>
                    <div className="ann-item-sub">
                        {isDraft ? 'Draft' : `Sent to: ${audienceLabel(ann.target_audience)}`}
                        {ann.target_grade ? ` · ${ann.target_grade}` : ''}
                        &nbsp;&middot;&nbsp;{time}
                    </div>
                </div>
                <span className={`ann-badge ${ann.category}`}>{cat.label}</span>
                {isArch && <span className="ann-badge general" style={{marginLeft:'.25rem'}}>Archived</span>}
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

export function DosAnnouncement() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const { config } = useSchoolConfig()

    // Build year → classes lookup from school config
    // e.g. { S1: ['S1A','S1B','S1C'], S4: ['S4MPG','S4PCB'] }
    const yearClassMap = (config || []).reduce((acc, sec) => {
        ;(sec.years || []).forEach(yr => {
            acc[yr.name] = (yr.streams || []).map(s => `${yr.name}${s}`)
        })
        return acc
    }, {})
    const yearNames = Object.keys(yearClassMap)

    const [selectedYear, setSelectedYear] = useState('')

    // ── Announcements state ──
    const [announcements, setAnnouncements] = useState([])
    const [total,         setTotal]         = useState(0)
    const [hasMore,       setHasMore]       = useState(false)
    const [loadingMore,   setLoadingMore]   = useState(false)
    const [loading,       setLoading]       = useState(true)
    const [activeFilter,  setActiveFilter]  = useState('all')
    const PAGE = 50

    // ── Form state ──
    const [form,        setForm]        = useState(EMPTY_FORM)
    const [editingId,   setEditingId]   = useState(null)
    const [saving,      setSaving]      = useState(false)
    const [formError,   setFormError]   = useState('')

    // ── Fetch (first page) ──
    function fetchPage(offset = 0, append = false) {
        if (offset === 0) setLoading(true); else setLoadingMore(true)
        getDosAnnouncements({ limit: PAGE, offset })
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

    // ── Derived ──
    const filtered = announcements.filter(a => {
        if (activeFilter === 'all') return true
        return a.status === activeFilter
    })

    const countByStatus = s => announcements.filter(a => a.status === s).length

    // ── Form handlers ──
    const set = f => e => {
        const val = e.target.value
        setForm(p => ({ ...p, [f]: val }))
        if (f === 'target_audience' && val !== 'grade_specific') {
            setSelectedYear('')
            setForm(p => ({ ...p, target_audience: val, target_grade: '' }))
        }
    }

    function loadForEdit(ann) {
        setEditingId(ann.id)
        setForm({
            title:           ann.title,
            content:         ann.content,
            category:        ann.category,
            target_audience: ann.target_audience,
            target_grade:    ann.target_grade || '',
        })
        // pre-select the year if target_grade is a class like "S1A"
        const grade = ann.target_grade || ''
        const matchedYear = yearNames.find(y => grade === y || grade.startsWith(y))
        setSelectedYear(matchedYear || '')
        setFormError('')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    function handleClear() {
        setForm(EMPTY_FORM)
        setEditingId(null)
        setSelectedYear('')
        setFormError('')
    }

    async function handleSave(status) {
        if (!form.title.trim())   { setFormError('Title is required.'); return }
        if (!form.content.trim()) { setFormError('Content is required.'); return }
        setFormError('')
        setSaving(true)
        try {
            const payload = { ...form, status }
            if (editingId) {
                await updateDosAnnouncement(editingId, payload)
            } else {
                await createDosAnnouncement(payload)
            }
            handleClear()
            reload()
        } catch(e) {
            setFormError('Failed to save. Please try again.')
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Delete this announcement?')) return
        try {
            await deleteDosAnnouncement(id)
            setAnnouncements(prev => prev.filter(a => a.id !== id))
        } catch(e) { console.error(e) }
    }

    async function handlePublish(id) {
        try {
            const updated = await updateDosAnnouncement(id, { status: 'published' })
            setAnnouncements(prev => prev.map(a => a.id === id ? updated : a))
        } catch(e) { console.error(e) }
    }

    async function handleArchive(id) {
        try {
            const updated = await updateDosAnnouncement(id, { status: 'archived' })
            setAnnouncements(prev => prev.map(a => a.id === id ? updated : a))
        } catch(e) { console.error(e) }
    }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Announcements"
                        subtitle="Compose and broadcast school-wide announcements"
                        {...sessionUser}
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
                                                <label key={c.value} className={`ann-cat-label ${c.value}${form.category===c.value?' selected':''}`}>
                                                    <input type="radio" name="ann-cat" value={c.value}
                                                        checked={form.category===c.value}
                                                        onChange={set('category')} />
                                                    <span className="material-symbols-rounded">{c.icon}</span> {c.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <div className="form-group ann-form-group">
                                        <label className="form-label" htmlFor="annTitle">Announcement Title *</label>
                                        <input type="text" className="form-input" id="annTitle"
                                            placeholder="e.g. Mid-Term Exam Schedule Revision"
                                            value={form.title} onChange={set('title')} />
                                    </div>

                                    {/* Audience */}
                                    <div className="form-group ann-form-group">
                                        <label className="form-label">Send To</label>
                                        <div className="ann-audience-grid">
                                            {AUDIENCES.map(a => (
                                                <label key={a.value} className={`ann-audience-item${form.target_audience===a.value?' selected':''}`}>
                                                    <input type="radio" name="ann-audience" value={a.value}
                                                        checked={form.target_audience===a.value}
                                                        onChange={set('target_audience')} />
                                                    <span className="material-symbols-rounded">{a.icon}</span> {a.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Year + class picker — only when grade_specific */}
                                    {form.target_audience === 'grade_specific' && (
                                        <div className="form-group ann-form-group">
                                            {yearNames.length === 0 ? (
                                                <p style={{fontSize:'.8rem',color:'var(--muted-foreground)'}}>
                                                    No year groups found. Please configure them in
                                                    <strong> School Settings → Sections</strong>.
                                                </p>
                                            ) : (
                                                <>
                                                    {/* Step 1 — pick year */}
                                                    <label className="form-label">Year Group</label>
                                                    <div className="es-class-chips" style={{marginBottom:'.65rem'}}>
                                                        {yearNames.map(y => (
                                                            <button key={y} type="button"
                                                                className={`es-class-chip-btn${selectedYear===y?' active':''}`}
                                                                onClick={() => {
                                                                    setSelectedYear(y)
                                                                    setForm(p => ({ ...p, target_grade: y }))
                                                                }}>
                                                                {y}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Step 2 — pick class within that year */}
                                                    {selectedYear && (yearClassMap[selectedYear]||[]).length > 0 && (
                                                        <>
                                                            <label className="form-label">Class <span style={{color:'var(--muted-foreground)',fontWeight:400}}>(optional — leave on year to target all)</span></label>
                                                            <div className="es-class-chips">
                                                                <button type="button"
                                                                    className={`es-class-chip-btn${form.target_grade===selectedYear?' active':''}`}
                                                                    onClick={() => setForm(p => ({ ...p, target_grade: selectedYear }))}>
                                                                    All {selectedYear}
                                                                </button>
                                                                {(yearClassMap[selectedYear]||[]).map(cls => (
                                                                    <button key={cls} type="button"
                                                                        className={`es-class-chip-btn${form.target_grade===cls?' active':''}`}
                                                                        onClick={() => setForm(p => ({ ...p, target_grade: cls }))}>
                                                                        {cls}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Content */}
                                    <div className="form-group ann-content-group">
                                        <label className="form-label" htmlFor="annContent">Announcement Content *</label>
                                        <textarea className="form-input" id="annContent" rows={6}
                                            placeholder="Type the full announcement details here..."
                                            value={form.content} onChange={set('content')}
                                            style={{resize:'vertical'}} />
                                    </div>

                                    {formError && (
                                        <p style={{color:'#ef4444',fontSize:'.85rem',marginBottom:'.75rem'}}>{formError}</p>
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
                                            <button key={f} className={`ann-filter-pill${activeFilter===f?' active':''}`}
                                                onClick={() => setActiveFilter(f)}>
                                                {f.charAt(0).toUpperCase()+f.slice(1)}
                                                {f !== 'all' && (
                                                    <span className="es-chip-count" style={{marginLeft:'.3rem'}}>
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

                                            {/* Load more */}
                                            {hasMore && activeFilter === 'all' && (
                                                <div style={{textAlign:'center',padding:'.75rem 0'}}>
                                                    <button className="btn btn-outline btn-sm" onClick={loadMore} disabled={loadingMore}>
                                                        <span className="material-symbols-rounded icon-sm">expand_more</span>
                                                        {loadingMore ? 'Loading…' : `Load more (${total - announcements.length} remaining)`}
                                                    </button>
                                                </div>
                                            )}

                                            {!hasMore && announcements.length > 0 && (
                                                <p style={{textAlign:'center',fontSize:'.75rem',color:'var(--muted-foreground)',padding:'.5rem 0'}}>
                                                    All {total} announcement{total!==1?'s':''} loaded
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
