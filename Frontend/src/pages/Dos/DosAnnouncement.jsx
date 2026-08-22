import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
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
import { formatDateShort } from '../../utils/date'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
    { value: 'urgent',   labelKey: 'announcements.catUrgent',   icon: 'priority_high' },
    { value: 'academic', labelKey: 'announcements.catAcademic', icon: 'school'        },
    { value: 'event',    labelKey: 'announcements.catEvent',    icon: 'event'         },
    { value: 'general',  labelKey: 'announcements.catGeneral',  icon: 'info'          },
]

const AUDIENCES = [
    { value: 'all',            labelKey: 'announcements.audEveryone',     icon: 'groups'          },
    { value: 'teachers',       labelKey: 'announcements.audTeachers',     icon: 'school'          },
    { value: 'students',       labelKey: 'announcements.audStudents',     icon: 'group'           },
    { value: 'parents',        labelKey: 'announcements.audParents',      icon: 'family_restroom' },
    { value: 'grade_specific', labelKey: 'announcements.audSpecificYear', icon: 'filter_list'     },
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
    category:        'academic',
    target_audience: 'all',
    target_grade:    '',
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
                <div className="ann-avatar">{ann.author ? ann.author.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : 'AN'}</div>
                <div className="ann-item-meta">
                    <div className="ann-item-title">{ann.title || <em>{t('common.untitled')}</em>}</div>
                    <div className="ann-item-sub">
                        {isDraft ? t('common.draft') : t('announcements.sentTo', { audience: audienceLabel(ann.target_audience, t) })}
                        {ann.target_grade ? ` · ${ann.target_grade}` : ''}
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

export function DosAnnouncement() {
    const { t } = useTranslation()
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
        if (!form.title.trim())   { setFormError(t('announcements.titleRequiredError')); return }
        if (!form.content.trim()) { setFormError(t('announcements.contentRequiredError')); return }
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
            setFormError(t('announcements.saveFailed'))
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id) {
        if (!window.confirm(t('announcements.deleteConfirm'))) return
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
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.announcements')}
                        subtitle={t('dos.announcements.subtitle')}
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
                                                <label key={c.value} className={`ann-cat-label ${c.value}${form.category===c.value?' selected':''}`}>
                                                    <input type="radio" name="ann-cat" value={c.value}
                                                        checked={form.category===c.value}
                                                        onChange={set('category')} />
                                                    <span className="material-symbols-rounded">{c.icon}</span> {t(c.labelKey)}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Title */}
                                    <div className="form-group ann-form-group">
                                        <label className="form-label" htmlFor="annTitle">{t('announcements.titleRequired')}</label>
                                        <input type="text" className="form-input" id="annTitle"
                                            placeholder={t('announcements.egDosTitle')}
                                            value={form.title} onChange={set('title')} />
                                    </div>

                                    {/* Audience */}
                                    <div className="form-group ann-form-group">
                                        <label className="form-label">{t('announcements.sendTo')}</label>
                                        <div className="ann-audience-grid">
                                            {AUDIENCES.map(a => (
                                                <label key={a.value} className={`ann-audience-item${form.target_audience===a.value?' selected':''}`}>
                                                    <input type="radio" name="ann-audience" value={a.value}
                                                        checked={form.target_audience===a.value}
                                                        onChange={set('target_audience')} />
                                                    <span className="material-symbols-rounded">{a.icon}</span> {t(a.labelKey)}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Year + class picker — only when grade_specific */}
                                    {form.target_audience === 'grade_specific' && (
                                        <div className="form-group ann-form-group">
                                            {yearNames.length === 0 ? (
                                                <p className="dos-ann-note">
                                                    {t('announcements.noYearGroups')}{' '}
                                                    <strong>{t('announcements.settingsPath')}</strong>.
                                                </p>
                                            ) : (
                                                <>
                                                    {/* Step 1 — pick year */}
                                                    <label className="form-label">{t('common.yearGroup')}</label>
                                                    <div className="es-class-chips dos-chips-mb">
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
                                                            <label className="form-label">{t('common.class')} <span className="dos-optional">{t('announcements.classOptional')}</span></label>
                                                            <div className="es-class-chips">
                                                                <button type="button"
                                                                    className={`es-class-chip-btn${form.target_grade===selectedYear?' active':''}`}
                                                                    onClick={() => setForm(p => ({ ...p, target_grade: selectedYear }))}>
                                                                    {t('announcements.allYear', { year: selectedYear })}
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
                                        <label className="form-label" htmlFor="annContent">{t('announcements.contentRequired')}</label>
                                        <textarea className="form-input es-textarea-v" id="annContent" rows={6}
                                            placeholder={t('announcements.bodyPlaceholderShort')}
                                            value={form.content} onChange={set('content')} />
                                    </div>

                                    {formError && (
                                        <p className="dos-ann-err">{formError}</p>
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
                                    {/* How many are downloaded, not how many are published — the pills
                                        already carry the per-status counts, and mixing a published
                                        count with an all-status total made the two numbers
                                        incomparable. */}
                                    <span className="badge badge-published">{t('announcements.loadedOf', { shown: announcements.length, total })}</span>
                                </div>
                                <div className="card-content">

                                    {/* Filter pills */}
                                    <div className="ann-filter-row">
                                        {FILTERS.map(f => (
                                            <button key={f} className={`ann-filter-pill${activeFilter===f?' active':''}`}
                                                onClick={() => setActiveFilter(f)}>
                                                {t(FILTER_KEYS[f])}
                                                {f !== 'all' && (
                                                    <span className="es-chip-count dos-chip-count-ml">
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

                                            {/* Load more — on every filter, not just All. The counts on
                                                the pills only cover what is downloaded, so gating this to
                                                All left a filtered view with no way to reach the rest. */}
                                            {hasMore && (
                                                <div className="dos-ann-loadmore">
                                                    <button className="btn btn-outline btn-sm" onClick={loadMore} disabled={loadingMore}>
                                                        <span className="material-symbols-rounded icon-sm">expand_more</span>
                                                        {loadingMore
                                                            ? t('common.loading')
                                                            : t('announcements.loadMoreRemaining', { count: total - announcements.length })}
                                                    </button>
                                                </div>
                                            )}

                                            {!hasMore && announcements.length > 0 && (
                                                <p className="dos-ann-allloaded">
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
