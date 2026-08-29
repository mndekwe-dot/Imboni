import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import { formatDate } from '../../utils/date'
import {
    getAdminAnnouncements, createAdminAnnouncement,
    updateAdminAnnouncement, deleteAdminAnnouncement,
    getAdminAudienceOptions, getAnnouncementTemplates,
} from '../../api/admin'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import '../../styles/tables.css'
import { SearchBar } from '../../components/ui/SearchBar'
import '../../styles/announcements.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
    { value: 'general',  labelKey: 'announcements.catGeneral'  },
    { value: 'academic', labelKey: 'announcements.catAcademic' },
    { value: 'event',    labelKey: 'announcements.catEvents'   },
    { value: 'urgent',   labelKey: 'announcements.catUrgent'   },
]

const CAT_STYLE = {
    urgent:   { borderColor: 'var(--destructive)',   badge: 'var(--destructive-light)',   text: 'var(--destructive)',   icon: 'priority_high'  },
    academic: { borderColor: '#3b82f6',              badge: '#dbeafe',                    text: '#2563eb',              icon: 'school'         },
    event:    { borderColor: '#8b5cf6',              badge: '#ede9fe',                    text: '#7c3aed',              icon: 'emoji_events'   },
    general:  { borderColor: 'var(--muted-foreground)', badge: 'var(--muted)',            text: 'var(--muted-foreground)', icon: 'campaign'    },
}

const TABS = [
    { key: 'all',      labelKey: 'common.all'                 },
    { key: 'academic', labelKey: 'announcements.catAcademic'  },
    { key: 'events',   labelKey: 'announcements.catEvents'    },
    { key: 'general',  labelKey: 'announcements.catGeneral'   },
    { key: 'urgent',   labelKey: 'announcements.catUrgent'    },
    { key: 'drafts',   labelKey: 'announcements.tabDrafts'    },
]

const EMPTY_FORM = { category: 'general', title: '', content: '', audienceKey: 'all', target_grade: '', status: 'published' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function relDate(dateStr, t) {
    if (!dateStr) return ''
    const d    = new Date(dateStr)
    const diff = Math.floor((Date.now() - d) / 86400000)
    if (diff === 0) return t('common.today')
    if (diff === 1) return t('common.yesterday')
    if (diff < 7)  return t('common.daysAgo', { count: diff })
    return formatDate(d)
}

function audienceLabel(ann, t) {
    if (!ann.target_audience || ann.target_audience === 'all') return t('announcements.schoolWide')
    if (ann.target_grade) return ann.target_grade
    if (ann.target_audience === 'parents') return t('announcements.parentsOnly')
    return ann.target_audience
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeleteModal({ target, onClose, onConfirm }) {
    const { t } = useTranslation()
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm modal-confirm" onClick={e => e.stopPropagation()}>
                <h2 className="modal-confirm-title">{t('announcements.deleteTitle')}</h2>
                <p className="modal-confirm-desc">
                    {t('announcements.deleteDesc', { title: target.title })}
                </p>
                <div className="modal-confirm-actions">
                    <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary btn-destructive" onClick={onConfirm}>
                        <span className="material-symbols-rounded" aria-hidden="true">delete</span> {t('common.delete')}
                    </button>
                </div>
            </div>
        </div>
    )
}

function AnnCard({ ann, onEdit, onDelete, onPublish }) {
    const { t } = useTranslation()
    const cat  = CAT_STYLE[ann.category] || CAT_STYLE.general
    const date = ann.published_at || ann.created_at

    return (
        <div
            className="adm-ann-card"
            style={{ '--cat-accent': cat.borderColor, '--cat-badge': cat.badge, '--cat-text': cat.text }}
        >
            <div className="adm-ann-icon">
                <span className="material-symbols-rounded" aria-hidden="true">{cat.icon}</span>
            </div>

            <div className="adm-ann-body">
                <div className="adm-ann-meta">
                    <span className="adm-ann-cat">{ann.category}</span>

                    {ann.status === 'draft' && (
                        <span className="adm-badge pending u-fs-068">{t('common.draft')}</span>
                    )}

                    <span className="adm-ann-time">
                        {relDate(date, t)}
                    </span>
                    <span className="adm-ann-time">
                        · {audienceLabel(ann, t)}
                    </span>
                </div>

                <h4 className="adm-ann-title">
                    {ann.title}
                </h4>
                <p className="adm-ann-text">
                    {ann.content}
                </p>

                <div className="adm-ann-actions">
                    <button className="adm-btn" onClick={() => onEdit(ann)}>
                        <span className="material-symbols-rounded" aria-hidden="true">edit</span> {t('common.edit')}
                    </button>
                    {ann.status === 'draft' && (
                        <button
                            className="adm-btn primary"
                            onClick={() => onPublish(ann)}
                        >
                            <span className="material-symbols-rounded" aria-hidden="true">send</span> {t('common.publish')}
                        </button>
                    )}
                    <button className="adm-btn danger" onClick={() => onDelete(ann)} title={t('common.delete')}>
                        <span className="material-symbols-rounded" aria-hidden="true">delete</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

function TemplateChips({ templates, onSelect }) {
    const { t } = useTranslation()
    if (!templates.length) return null
    return (
        <div className="u-mb-sm">
            <p className="adm-eyebrow">
                {t('announcements.quickTemplates')}
            </p>
            <div className="adm-chip-row">
                {templates.map(tmpl => (
                    <button key={tmpl.key} type="button" className="filter-chip" onClick={() => onSelect(tmpl)}>
                        {tmpl.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

function AudienceChips({ options, audienceKey, targetGrade, onChange }) {
    return (
        <div className="adm-chip-row">
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
    const { t } = useTranslation()
    const [form,  setForm]  = useState(initial)
    const [error, setError] = useState('')

    function set(key, val) { setForm(f => ({ ...f, [key]: val })); setError('') }

    function applyTemplate(tmpl) {
        setForm(f => ({ ...f, category: tmpl.category || f.category, title: tmpl.title, content: tmpl.content }))
        setError('')
    }

    function handleSubmit(status) {
        if (!form.title.trim())   { setError(t('announcements.titleRequiredError')); return }
        if (!form.content.trim()) { setError(t('announcements.contentRequiredError')); return }
        onSave({ ...form, status })
    }

    return (
        <div className="u-stack-1">
            <TemplateChips templates={templates} onSelect={applyTemplate} />

            <div className="adm-title-grid">
                <div className="form-group form-group-0">
                    <label className="form-label">{t('common.titleRequired')}</label>
                    <input
                        className="form-input"
                        value={form.title}
                        onChange={e => set('title', e.target.value)}
                        placeholder={t('announcements.titlePlaceholderPlain')}
                        autoFocus
                    />
                </div>
                <div className="form-group form-group-0">
                    <label className="form-label">{t('common.category')}</label>
                    <select className="form-input" value={form.category} onChange={e => set('category', e.target.value)}>
                        {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
                    </select>
                </div>
            </div>

            <div className="form-group form-group-0">
                <label className="form-label">{t('announcements.audience')}</label>
                <AudienceChips
                    options={audienceOptions}
                    audienceKey={form.audienceKey}
                    targetGrade={form.target_grade}
                    onChange={(key, grade) => setForm(f => ({ ...f, audienceKey: key, target_grade: grade }))}
                />
            </div>

            <div className="form-group form-group-0">
                <label className="form-label">{t('common.contentRequired')}</label>
                <textarea
                    className="form-input"
                    rows={5}
                    value={form.content}
                    onChange={e => set('content', e.target.value)}
                    placeholder={t('announcements.bodyPlaceholderLong')}
                />
            </div>

            {error && <p className="form-error-text">{error}</p>}

            <div className="u-row-sm u-wrap u-pt-xs">
                <button className="btn btn-primary" disabled={saving} onClick={() => handleSubmit('published')}>
                    <span className="material-symbols-rounded" aria-hidden="true">send</span>
                    {saving ? t('announcements.publishing') : t('common.publish')}
                </button>
                <button className="btn btn-outline" disabled={saving} onClick={() => handleSubmit('draft')}>
                    <span className="material-symbols-rounded" aria-hidden="true">save</span>
                    {t('announcements.saveDraft')}
                </button>
                <button className="btn btn-secondary" onClick={onCancel}>{t('common.cancel')}</button>
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminAnnouncements() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const toast = useToast()
    const [announcements,   setAnnouncements]   = useState([])
    const [draftCount,      setDraftCount]      = useState(0)
    const [urgentCount,     setUrgentCount]     = useState(0)
    const [publishedCount,  setPublishedCount]  = useState(0)
    const [audienceOptions, setAudienceOptions] = useState([
        { label: t('announcements.allClasses'),        target_audience: 'all',     target_grade: '' },
        { label: t('announcements.parentsOnlyOption'), target_audience: 'parents', target_grade: '' },
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
            .catch(e => toast.error(errorMessage(e, t('announcements.loadFailed'))))
    }, [activeTab, t])

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
            toast.success(editing ? t('announcements.updated') : t('announcements.created'))
            setLoading(true)
            await load(activeTab)
        } catch (e) {
            toast.error(errorMessage(e, t('announcements.saveFailedAdmin')))
        }
        finally { setSaving(false); setLoading(false) }
    }

    async function handlePublish(ann) {
        try {
            await updateAdminAnnouncement(ann.id, { status: 'published' })
            toast.success(t('announcements.publishedToast'))
            setLoading(true)
            await load(activeTab)
        } catch (e) {
            toast.error(errorMessage(e, t('announcements.publishFailed')))
        } finally { setLoading(false) }
    }

    async function handleDeleteConfirm() {
        if (!deleteTarget) return
        try {
            await deleteAdminAnnouncement(deleteTarget.id)
            toast.success(t('announcements.deletedToast'))
            setLoading(true)
            await load(activeTab)
        } catch (e) {
            toast.error(errorMessage(e, t('announcements.deleteFailed')))
        } finally { setDeleteTarget(null); setLoading(false) }
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
        { icon: 'campaign',      value: loading ? '-' : publishedCount,       label: t('common.published'),          trend: t('announcements.statPublishedTrend'), colorClass: 'info'    },
        { icon: 'draft',         value: loading ? '-' : draftCount,           label: t('announcements.tabDrafts'),   trend: t('announcements.statDraftsTrend'),    colorClass: 'warning' },
        { icon: 'priority_high', value: loading ? '-' : urgentCount,          label: t('announcements.catUrgent'),   trend: t('announcements.statUrgentTrend'),    colorClass: ''        },
        { icon: 'feed',          value: loading ? '-' : announcements.length, label: t('common.total'),              trend: t('announcements.statTotalTrend'),     colorClass: 'success' },
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

            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.announcements')}
                        subtitle={t('admin.announcements.subtitle')}
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
                            <div className="card u-mb-lg">
                                <div className="card-header">
                                    <h2 className="card-title">
                                        {editing ? t('announcements.editTitle') : t('announcements.newAnnouncementTitle')}
                                    </h2>
                                    <button
                                        className="btn-icon-clean"
                                        onClick={() => { setComposing(false); setEditing(null) }}
                                        title={t('common.close')}
                                    >
                                        <span className="material-symbols-rounded" aria-hidden="true">close</span>
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
                        <div className="u-row-between u-mb">
                            <div className="filter-chips u-mb-0">
                                {TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        className={`filter-chip${activeTab === tab.key ? ' active' : ''}`}
                                        onClick={() => switchTab(tab.key)}
                                    >
                                        {t(tab.labelKey)}
                                        {tab.key === 'drafts' && draftCount > 0 && (
                                            <span className={`adm-tab-count${activeTab === tab.key ? ' on' : ''}`}>{draftCount}</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {!composing && (
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => { setEditing(null); setComposing(true) }}
                                >
                                    <span className="material-symbols-rounded" aria-hidden="true">add</span>
                                    {t('announcements.newAnnouncementTitle')}
                                </button>
                            )}
                        </div>

                        {/* Search */}
                        <div className="toolbar-card u-mb">
                            <SearchBar
                                value={search}
                                onChange={setSearch}
                                placeholder={t('announcements.searchPlaceholder')}
                            />
                        </div>

                        {/* Feed */}
                        {loading ? (
                            <p className="u-muted u-pad">{t('common.loading')}</p>
                        ) : visible.length === 0 ? (
                            <EmptyState
                                icon="campaign"
                                title={search ? t('announcements.noResults', { query: search }) : t('announcements.noneTitle')}
                                desc={search ? t('announcements.trySearch') : t('announcements.switchTabs')}
                            />
                        ) : (
                            <div className="u-stack-sm">
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
