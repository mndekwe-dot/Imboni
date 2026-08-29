import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { SkeletonTable } from '../../components/ui/Skeleton'
import {
    getTerms, getDutyPosts, createDutyPost, updateDutyPost, deleteDutyPost,
    getDutyRoster, generateDutyRoster, commitDutyRoster,
} from '../../api/dos'

const DAYS = [
    { value: 'monday',    labelKey: 'common.mon' },
    { value: 'tuesday',   labelKey: 'common.tue' },
    { value: 'wednesday', labelKey: 'common.wed' },
    { value: 'thursday',  labelKey: 'common.thu' },
    { value: 'friday',    labelKey: 'common.fri' },
    { value: 'saturday',  labelKey: 'common.sat' },
    { value: 'sunday',    labelKey: 'common.sun' },
]
const DAY_KEY = Object.fromEntries(DAYS.map(d => [d.value, d.labelKey]))
const WEEKDAYS = DAYS.slice(0, 5).map(d => d.value)

// ── Post manager — the duties the generator rotates staff through ────────────

function PostManager({ posts, onCreate, onUpdate, onDelete }) {
    const { t } = useTranslation()
    const [draft, setDraft] = useState({ name: '', start_time: '', end_time: '', staff_required: 1 })
    const [error, setError] = useState('')

    async function add() {
        if (!draft.name.trim() || !draft.start_time || !draft.end_time) {
            setError(t('dos.duty.nameTimesRequired')); return
        }
        try {
            await onCreate({ ...draft, name: draft.name.trim(), order: posts.length + 1 })
            setDraft({ name: '', start_time: '', end_time: '', staff_required: 1 })
            setError('')
        } catch (e) { setError(e.response?.data?.detail || t('dos.duty.addPostFailed')) }
    }

    return (
        <div className="card mb-5">
            <div className="card-header">
                <h2 className="card-title">{t('dos.duty.posts')}</h2>
                <span className="u-muted u-sm">{t('dos.duty.postCount', { count: posts.length })}</span>
            </div>
            <div className="card-content">
                {posts.length === 0 && (
                    <p className="u-muted u-sm">
                        {t('dos.duty.noPosts')}
                    </p>
                )}
                {posts.map(p => (
                    <div key={p.id} className="dset-lesson-row">
                        <span className="dset-lesson-name">{p.name}</span>
                        <span className="u-muted u-sm">{p.start_time?.slice(0,5)}-{p.end_time?.slice(0,5)}</span>
                        <span className="es-room-chip">{t('dos.duty.staffCount', { count: p.staff_required })}</span>
                        <label className="u-flex u-gap-05 u-items-center u-sm u-muted">
                            <input type="checkbox" checked={p.is_active}
                                   onChange={e => onUpdate(p.id, { is_active: e.target.checked })} />
                            {t('common.active')}
                        </label>
                        <button className="btn-icon-clean dos-danger-text" title={t('dos.duty.deletePost')}
                                onClick={() => onDelete(p.id)}>
                            <span className="material-symbols-rounded u-fs-095" aria-hidden="true">delete</span>
                        </button>
                    </div>
                ))}

                <div className="dset-lesson-add mt-1">
                    <input className="form-input dset-input-lesson" placeholder={t('dos.duty.namePlaceholder')}
                           value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                    <input type="time" className="form-input" aria-label={t('common.startTime')}
                           value={draft.start_time} onChange={e => setDraft({ ...draft, start_time: e.target.value })} />
                    <input type="time" className="form-input" aria-label={t('common.endTime')}
                           value={draft.end_time} onChange={e => setDraft({ ...draft, end_time: e.target.value })} />
                    <input type="number" min="1" max="20" className="form-input dset-input-narrow"
                           aria-label={t('dos.duty.staffRequired')} value={draft.staff_required}
                           onChange={e => setDraft({ ...draft, staff_required: Number(e.target.value) })} />
                    <button className="btn btn-primary btn-sm" onClick={add}>{t('common.add')}</button>
                </div>
                {error && <p className="u-danger u-fs-085 mt-1">{error}</p>}
            </div>
        </div>
    )
}

// ── Generate modal — preview then commit ─────────────────────────────────────

function GenerateModal({ onClose, onCommitted }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [terms, setTerms] = useState([])
    const [form, setForm] = useState({ term_id: '', days: WEEKDAYS, max_per_day: 1 })
    const [preview, setPreview] = useState(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        getTerms()
            .then(data => {
                const list = Array.isArray(data) ? data : (data?.results || [])
                setTerms(list)
                const current = list.find(term => term.is_current) || list[0]
                if (current) setForm(f => ({ ...f, term_id: String(current.id) }))
            })
            .catch(() => toast.error(t('dos.examSchedule.loadTermsFailed')))
    }, [toast])

    function update(field, value) {
        setForm(f => ({ ...f, [field]: value }))
        setPreview(null)
    }

    function toggleDay(day) {
        const next = form.days.includes(day)
            ? form.days.filter(d => d !== day)
            : [...form.days, day]
        update('days', next)
    }

    async function handlePreview() {
        setBusy(true)
        try {
            const plan = await generateDutyRoster(form)
            setPreview(plan)
            plan.warnings?.forEach(w => toast.info(w))
        } catch (err) {
            toast.error(err.response?.data?.detail || t('dos.duty.generateFailed'))
        } finally { setBusy(false) }
    }

    async function handleCommit() {
        setBusy(true)
        try {
            const result = await commitDutyRoster(form)
            toast.success(t('dos.duty.saved', { count: result.created }))
            onCommitted()
        } catch (err) {
            toast.error(err.response?.data?.detail || t('dos.duty.saveFailed'))
        } finally { setBusy(false) }
    }

    const canRun = form.term_id && form.days.length > 0 && !busy

    return (
        <Modal
            title={t('dos.duty.generateTitle')} icon="auto_awesome" onClose={onClose} size="wide"
            footer={
                <div className="modal-confirm-actions u-full">
                    <button className="btn btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
                    {preview
                        ? <button className="btn btn-primary" onClick={handleCommit}
                                  disabled={busy || preview.summary.filled === 0}>
                              {t('dos.duty.saveAssignments', { count: preview.summary.filled })}
                          </button>
                        : <button className="btn btn-primary" onClick={handlePreview} disabled={!canRun}>
                              {busy ? t('common.generating') : t('dos.examSchedule.preview')}
                          </button>}
                </div>
            }
        >
            <div className="u-grid u-grid-2 u-gap-1">
                <div className="form-group">
                    <label className="form-label">{t('dos.examSchedule.academicTermRequired')}</label>
                    <select className="form-select" value={form.term_id}
                            onChange={e => update('term_id', e.target.value)}>
                        <option value="">{t('dos.examSchedule.selectTerm')}</option>
                        {terms.map(term => <option key={term.id} value={term.id}>{term.name} ({term.year})</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">{t('dos.duty.maxPerDay')}</label>
                    <input type="number" min="1" max="10" className="form-input" value={form.max_per_day}
                           onChange={e => update('max_per_day', Number(e.target.value))} />
                </div>
                <div className="form-group u-col-span-all">
                    <label className="form-label">{t('dos.duty.daysToCover')}</label>
                    <div className="att-mode-bar">
                        {DAYS.map(d => (
                            <button key={d.value} type="button"
                                    className={`att-mode-btn${form.days.includes(d.value) ? ' active' : ''}`}
                                    onClick={() => toggleDay(d.value)}>
                                {t(d.labelKey)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {preview && (
                <div className="mt-1-5">
                    <div className="es-gen-summary">
                        <span className="badge badge-published">{t('dos.duty.filled', { count: preview.summary.filled })}</span>
                        {preview.summary.unfilled > 0 &&
                            <span className="badge badge-draft">{t('dos.duty.unfilled', { count: preview.summary.unfilled })}</span>}
                        <span className="u-muted u-sm">
                            {t('dos.duty.summary', {
                                staff: preview.summary.staff,
                                posts: preview.summary.posts,
                                spread: preview.summary.spread,
                            })}
                        </span>
                    </div>

                    <div className="data-table-wrap mt-1">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('common.day')}</th>
                                    <th>{t('dos.duty.duty')}</th>
                                    <th>{t('common.time')}</th>
                                    <th>{t('common.staff')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.assignments.map((a, i) => (
                                    <tr key={i}>
                                        <td className="es-nowrap">{DAY_KEY[a.day] ? t(DAY_KEY[a.day]) : a.day}</td>
                                        <td>{a.post_name}</td>
                                        <td className="es-nowrap">{a.start_time}-{a.end_time}</td>
                                        <td>{a.staff_name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <h3 className="section-label-sm mt-1-5">{t('dos.duty.workload')}</h3>
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead><tr><th>{t('common.staff')}</th><th>{t('dos.duty.duties')}</th></tr></thead>
                            <tbody>
                                {preview.load.map(l => (
                                    <tr key={l.staff_id}><td>{l.staff_name}</td><td>{l.duties}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Modal>
    )
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export function DutyRosterTab() {
    const { t } = useTranslation()
    const toast = useToast()
    const [posts, setPosts] = useState([])
    const [roster, setRoster] = useState([])
    const [loading, setLoading] = useState(true)
    const [showGenerate, setShowGenerate] = useState(false)

    const load = useCallback(async () => {
        const [p, r] = await Promise.all([getDutyPosts(), getDutyRoster()])
        setPosts(Array.isArray(p) ? p : [])
        setRoster(Array.isArray(r) ? r : [])
    }, [])

    useEffect(() => {
        load()
            .catch(() => toast.error(t('dos.duty.loadFailed')))
            .finally(() => setLoading(false))
    }, [load, toast])

    async function handleCreate(data) { await createDutyPost(data); await load() }
    async function handleUpdate(id, data) { await updateDutyPost(id, data); await load() }
    async function handleDelete(id) {
        try { await deleteDutyPost(id); await load() }
        catch { toast.error(t('dos.duty.deletePostFailed')) }
    }

    if (loading) return <SkeletonTable rows={6} cols={4} />

    // Group the saved roster by day for display.
    const byDay = roster.reduce((acc, r) => {
        (acc[r.day] = acc[r.day] || []).push(r)
        return acc
    }, {})
    const orderedDays = DAYS.map(d => d.value).filter(d => byDay[d]?.length)

    // Same reasoning as the dining planner: the generator rotates staff through
    // active posts, so with none active Generate can only end in an error toast.
    const hasActivePost = posts.some(p => p.is_active)

    return (
        <>
            {showGenerate && (
                <GenerateModal
                    onClose={() => setShowGenerate(false)}
                    onCommitted={() => {
                        setShowGenerate(false)
                        load().catch(() => toast.error(t('dos.duty.reloadFailed')))
                    }}
                />
            )}

            <PostManager posts={posts} onCreate={handleCreate}
                         onUpdate={handleUpdate} onDelete={handleDelete} />

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">{t('dos.duty.rosterTitle')}</h2>
                    <div className="es-card-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => setShowGenerate(true)}
                                disabled={!hasActivePost}
                                title={hasActivePost ? undefined : t('dos.duty.generateNeedsPosts')}>
                            <span className="material-symbols-rounded" aria-hidden="true">auto_awesome</span> {t('dos.examSchedule.generate')}
                        </button>
                    </div>
                </div>
                <div className="card-content">
                    {orderedDays.length === 0 ? (
                        <p className="u-muted u-sm">
                            {t('dos.duty.noRoster')}
                        </p>
                    ) : orderedDays.map(day => (
                        <div key={day} className="mb-5">
                            <h3 className="section-label-sm">{DAY_KEY[day] ? t(DAY_KEY[day]) : day}</h3>
                            <div className="data-table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>{t('dos.duty.duty')}</th>
                                            <th>{t('common.time')}</th>
                                            <th>{t('common.staff')}</th>
                                            <th>{t('common.role')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {byDay[day].map(r => (
                                            <tr key={r.id}>
                                                <td>{r.post_name}</td>
                                                <td className="es-nowrap">{r.start_time}-{r.end_time}</td>
                                                <td>{r.staff_name}</td>
                                                <td className="u-muted u-capitalize">{r.staff_role}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}
