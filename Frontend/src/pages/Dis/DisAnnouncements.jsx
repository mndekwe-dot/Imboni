import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardContent } from '../../components/layout/DashboardContent'
import {
    getDisAnnouncements, createDisAnnouncement,
    updateDisAnnouncement, deleteDisAnnouncement,
} from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { disNavItems, disSecondaryItems } from './disNav'
import { formatDateShort } from '../../utils/date'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
    { value: 'urgent',   labelKey: 'announcements.catUrgent',   icon: 'priority_high' },
    { value: 'academic', labelKey: 'announcements.catAcademic', icon: 'gavel'         },
    { value: 'event',    labelKey: 'announcements.catEvent',    icon: 'emoji_events'  },
    { value: 'general',  labelKey: 'announcements.catGeneral',  icon: 'info'          },
]

const AUDIENCES = [
    { value: 'all',      labelKey: 'announcements.audEveryone', icon: 'groups'          },
    { value: 'students', labelKey: 'announcements.audStudents', icon: 'group'           },
    { value: 'teachers', labelKey: 'announcements.audTeachers', icon: 'badge'           },
    { value: 'parents',  labelKey: 'announcements.audParents',  icon: 'family_restroom' },
]

const FILTERS = ['all', 'published', 'draft', 'archived']

const FILTER_KEYS = {
    all:       'announcements.filterAll',
    published: 'announcements.filterPublished',
    draft:     'announcements.filterDraft',
    archived:  'announcements.filterArchived',
}


const EMPTY_FORM = {
    title:           '',
    content:         '',
    category:        'general',
    target_audience: 'all',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoStr, t) {
    if (!isoStr) return ''
    const diff = Date.now() - new Date(isoStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return t('common.justNow')
    if (m < 60) return t('common.minutesAgo', { count: m })
    const h = Math.floor(m / 60)
    if (h < 24) return t('common.hoursAgo', { count: h })
    const d = Math.floor(h / 24)
    if (d < 7)  return t('common.daysAgo', { count: d })
    return formatDateShort(isoStr)
}

function audienceLabel(val, t) {
    const found = AUDIENCES.find(a => a.value === val)
    return found ? t(found.labelKey) : val
}

// ── Announcement item ─────────────────────────────────────────────────────────

function AnnouncementItem({ ann, onEdit, onDelete, onPublish, onArchive }) {
    const { t }   = useTranslation()
    const cat     = CATEGORIES.find(c => c.value === ann.category) || CATEGORIES[3]
    const isDraft = ann.status === 'draft'
    const isArch  = ann.status === 'archived'
    const time    = isDraft
        ? t('announcements.lastEdited', { time: timeAgo(ann.updated_at, t) })
        : timeAgo(ann.published_at || ann.created_at, t)

    return (
        <div className="ann-item">
            <div className="ann-item-header">
                <div className="ann-avatar">
                    {ann.author ? ann.author.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'DI'}
                </div>
                <div className="ann-item-meta">
                    <div className="ann-item-title">{ann.title || <em>{t('common.untitled')}</em>}</div>
                    <div className="ann-item-sub">
                        {isDraft ? t('common.draft') : t('announcements.sentTo', { audience: audienceLabel(ann.target_audience, t) })}
                        &nbsp;&middot;&nbsp;{time}
                    </div>
                </div>
                <span className={`ann-badge ${ann.category}`}>{t(cat.labelKey)}</span>
                {isArch && <span className="ann-badge general ann-badge-inline">{t('common.archived')}</span>}
            </div>
            <p className="ann-excerpt">{ann.content}</p>
            <div className="ann-item-footer">
                <span className="ann-views">
                    <span className="material-symbols-rounded">{isDraft ? 'draft' : 'visibility'}</span>
                    {isDraft ? t('common.draft') : t('common.published')}
                </span>
                <div className="ann-item-actions">
                    <button className="ann-icon-btn" title={t('common.edit')} onClick={() => onEdit(ann)}>
                        <span className="material-symbols-rounded">edit</span>
                    </button>
                    {isDraft && (
                        <button className="ann-icon-btn" title={t('common.publish')} onClick={() => onPublish(ann.id)}>
                            <span className="material-symbols-rounded">publish</span>
                        </button>
                    )}
                    {!isArch && !isDraft && (
                        <button className="ann-icon-btn" title={t('common.archive')} onClick={() => onArchive(ann.id)}>
                            <span className="material-symbols-rounded">archive</span>
                        </button>
                    )}
                    <button className="ann-icon-btn danger" title={t('common.delete')} onClick={() => onDelete(ann.id)}>
                        <span className="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DisAnnouncements() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
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
        if (!form.title.trim())   { setFormError(t('announcements.titleRequiredError')); return }
        if (!form.content.trim()) { setFormError(t('announcements.contentRequiredError')); return }
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
            setFormError(t('announcements.saveFailed'))
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id) {
        if (!window.confirm(t('announcements.deleteConfirm'))) return
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
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.announcements')}
                        subtitle={t('dis.announcements.subtitle')}
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
                                        {editingId ? t('announcements.editTitle') : t('announcements.createTitle')}
                                    </h2>
                                    {editingId && (
                                        <button className="btn btn-outline btn-sm" onClick={handleClear}>
                                            <span className="material-symbols-rounded icon-sm">close</span> {t('announcements.cancelEdit')}
                                        </button>
                                    )}
                                </div>
                                <div className="card-content">

                                    {/* Category */}
                                    <div className="form-group ann-form-group">
                                        <label className="form-label">{t('common.category')}</label>
                                        <div className="ann-category-row">
                                            {CATEGORIES.map(c => (
                                                <label key={c.value} className={`ann-cat-label ${c.value}${form.category === c.value ? ' selected' : ''}`}>
                                                    <input type="radio" name="dis-cat" value={c.value}
                                                        checked={form.category === c.value}
                                                        onChange={set('category')} />
                                                    <span className="material-symbols-rounded">{c.icon}</span> {t(c.labelKey)}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <div className="form-group ann-form-group">
                                        <label className="form-label" htmlFor="disTitle">{t('announcements.titleRequired')}</label>
                                        <input type="text" className="form-input" id="disTitle"
                                            placeholder={t('announcements.egDisTitle')}
                                            value={form.title} onChange={set('title')} />
                                    </div>

                                    {/* Audience */}
                                    <div className="form-group ann-form-group">
                                        <label className="form-label">{t('announcements.sendTo')}</label>
                                        <div className="ann-audience-grid">
                                            {AUDIENCES.map(a => (
                                                <label key={a.value} className={`ann-audience-item${form.target_audience === a.value ? ' selected' : ''}`}>
                                                    <input type="radio" name="dis-audience" value={a.value}
                                                        checked={form.target_audience === a.value}
                                                        onChange={set('target_audience')} />
                                                    <span className="material-symbols-rounded">{a.icon}</span> {t(a.labelKey)}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="form-group ann-content-group">
                                        <label className="form-label" htmlFor="disContent">{t('announcements.contentRequired')}</label>
                                        <textarea className="form-input ann-textarea" id="disContent" rows={6}
                                            placeholder={t('announcements.bodyPlaceholderShort')}
                                            value={form.content} onChange={set('content')} />
                                    </div>

                                    {formError && (
                                        <p className="ann-form-error">{formError}</p>
                                    )}

                                    {/* Actions */}
                                    <div className="ann-form-actions">
                                        <button type="button" className="btn btn-outline" onClick={handleClear} disabled={saving}>
                                            {t('common.clear')}
                                        </button>
                                        <button type="button" className="btn btn-secondary" onClick={() => handleSave('draft')} disabled={saving}>
                                            <span className="material-symbols-rounded">draft</span>
                                            {saving ? t('common.saving') : t('announcements.saveDraft')}
                                        </button>
                                        <button type="button" className="btn btn-primary" onClick={() => handleSave('published')} disabled={saving}>
                                            <span className="material-symbols-rounded">send</span>
                                            {saving ? t('announcements.publishing') : (editingId ? t('announcements.updateAndPublish') : t('announcements.publishNow'))}
                                        </button>
                                    </div>

                                </div>
                            </div>

                            {/* ── RIGHT: Recent Broadcasts ── */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">{t('announcements.recentBroadcasts')}</h2>
                                    <span className="badge badge-published">{t('announcements.loadedOf', { shown: countByStatus('published'), total })}</span>
                                </div>
                                <div className="card-content">

                                    {/* Filter pills */}
                                    <div className="ann-filter-row">
                                        {FILTERS.map(f => (
                                            <button key={f} className={`ann-filter-pill${activeFilter === f ? ' active' : ''}`}
                                                onClick={() => setActiveFilter(f)}>
                                                {t(FILTER_KEYS[f])}
                                                {f !== 'all' && (
                                                    <span className="es-chip-count ann-chip-count-gap">
                                                        {countByStatus(f)}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                    {/* List */}
                                    {loading ? (
                                        <p className="empty-note padded">{t('announcements.loading')}</p>
                                    ) : filtered.length === 0 ? (
                                        <div className="list-empty">
                                            <span className="material-symbols-rounded list-empty-icon">campaign</span>
                                            <p>{activeFilter === 'all'
                                                ? t('announcements.noneYet')
                                                : t('announcements.noneOfStatus', { status: t(FILTER_KEYS[activeFilter]).toLowerCase() })}</p>
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
                                                <div className="ann-load-more">
                                                    <button className="btn btn-outline btn-sm" onClick={loadMore} disabled={loadingMore}>
                                                        <span className="material-symbols-rounded icon-sm">expand_more</span>
                                                        {loadingMore
                                                            ? t('common.loading')
                                                            : t('announcements.loadMoreRemaining', { count: total - announcements.length })}
                                                    </button>
                                                </div>
                                            )}

                                            {!hasMore && announcements.length > 0 && (
                                                <p className="ann-all-loaded">
                                                    {t('announcements.allLoaded', { count: total })}
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
