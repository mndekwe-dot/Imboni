import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { SkeletonTable } from '../../components/ui/Skeleton'
import {
    getTerms, getDiningSittings, createDiningSitting, updateDiningSitting,
    deleteDiningSitting, getDiningPlan, generateDiningPlan, commitDiningPlan,
} from '../../api/dos'

const MEALS = [
    { value: 'breakfast', labelKey: 'dos.dining.mealBreakfast' },
    { value: 'lunch',     labelKey: 'dos.dining.mealLunch'     },
    { value: 'supper',    labelKey: 'dos.dining.mealSupper'    },
]
const MEAL_KEY = Object.fromEntries(MEALS.map(m => [m.value, m.labelKey]))

// ── Sitting manager ──────────────────────────────────────────────────────────

function SittingManager({ sittings, onCreate, onUpdate, onDelete }) {
    const { t } = useTranslation()
    const [draft, setDraft] = useState({
        name: '', meal: 'lunch', start_time: '', end_time: '', capacity: 100,
    })
    const [error, setError] = useState('')

    async function add() {
        if (!draft.name.trim() || !draft.start_time || !draft.end_time) {
            setError(t('dos.dining.nameTimesRequired')); return
        }
        if (!draft.capacity || draft.capacity < 1) { setError(t('dos.dining.capacityMin')); return }
        try {
            await onCreate({ ...draft, name: draft.name.trim(), order: sittings.length + 1 })
            setDraft({ name: '', meal: 'lunch', start_time: '', end_time: '', capacity: 100 })
            setError('')
        } catch (e) { setError(e.response?.data?.detail || t('dos.dining.addSittingFailed')) }
    }

    return (
        <div className="card mb-5">
            <div className="card-header">
                <h2 className="card-title">{t('dos.dining.sittings')}</h2>
                <span className="u-muted u-sm">{sittings.length} sitting{sittings.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="card-content">
                {sittings.length === 0 && (
                    <p className="u-muted u-sm">
                        {t('dos.dining.noSittings')}
                    </p>
                )}
                {sittings.map(s => (
                    <div key={s.id} className="dset-lesson-row">
                        <span className="dset-lesson-name">{s.name}</span>
                        <span className="es-room-chip">{MEAL_KEY[s.meal] ? t(MEAL_KEY[s.meal]) : s.meal}</span>
                        <span className="u-muted u-sm">{s.start_time?.slice(0,5)}-{s.end_time?.slice(0,5)}</span>
                        <span className="es-room-chip">{t('dos.dining.seatCount', { count: s.capacity })}</span>
                        <label className="u-flex u-gap-05 u-items-center u-sm u-muted">
                            <input type="checkbox" checked={s.is_active}
                                   onChange={e => onUpdate(s.id, { is_active: e.target.checked })} />
                            {t('common.active')}
                        </label>
                        <button className="btn-icon-clean dos-danger-text" title={t('dos.dining.deleteSitting')}
                                onClick={() => onDelete(s.id)}>
                            <span className="material-symbols-rounded u-fs-095">delete</span>
                        </button>
                    </div>
                ))}

                <div className="dset-lesson-add mt-1">
                    <input className="form-input dset-input-lesson" placeholder={t('dos.dining.namePlaceholder')}
                           value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                    <select className="form-select" aria-label={t('common.meal')} value={draft.meal}
                            onChange={e => setDraft({ ...draft, meal: e.target.value })}>
                        {MEALS.map(m => <option key={m.value} value={m.value}>{t(m.labelKey)}</option>)}
                    </select>
                    <input type="time" className="form-input" aria-label={t('common.startTime')}
                           value={draft.start_time} onChange={e => setDraft({ ...draft, start_time: e.target.value })} />
                    <input type="time" className="form-input" aria-label={t('common.endTime')}
                           value={draft.end_time} onChange={e => setDraft({ ...draft, end_time: e.target.value })} />
                    <input type="number" min="1" className="form-input dset-input-narrow"
                           aria-label={t('common.capacity')} value={draft.capacity}
                           onChange={e => setDraft({ ...draft, capacity: Number(e.target.value) })} />
                    <button className="btn btn-primary btn-sm" onClick={add}>{t('common.add')}</button>
                </div>
                {error && <p className="u-danger u-fs-085 mt-1">{error}</p>}
            </div>
        </div>
    )
}

// ── Generate modal ───────────────────────────────────────────────────────────

function GenerateModal({ onClose, onCommitted }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [terms, setTerms] = useState([])
    const [form, setForm] = useState({ term_id: '', meals: ['lunch'] })
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

    function toggleMeal(meal) {
        const next = form.meals.includes(meal)
            ? form.meals.filter(m => m !== meal)
            : [...form.meals, meal]
        update('meals', next)
    }

    async function handlePreview() {
        setBusy(true)
        try {
            const plan = await generateDiningPlan(form)
            setPreview(plan)
            plan.warnings?.forEach(w => toast.info(w))
        } catch (err) {
            toast.error(err.response?.data?.detail || t('dos.dining.generateFailed'))
        } finally { setBusy(false) }
    }

    async function handleCommit() {
        setBusy(true)
        try {
            const result = await commitDiningPlan(form)
            toast.success(t('dos.dining.saved', { count: result.created }))
            onCommitted()
        } catch (err) {
            toast.error(err.response?.data?.detail || t('dos.dining.saveFailed'))
        } finally { setBusy(false) }
    }

    const canRun = form.term_id && form.meals.length > 0 && !busy

    return (
        <Modal
            title={t('dos.dining.generateTitle')} icon="auto_awesome" onClose={onClose} size="wide"
            footer={
                <div className="modal-confirm-actions u-full">
                    <button className="btn btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
                    {preview
                        ? <button className="btn btn-primary" onClick={handleCommit}
                                  disabled={busy || preview.summary.seated === 0}>
                              {t('dos.dining.saveSeatings', { count: preview.summary.seated })}
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
                <div className="form-group u-col-span-all">
                    <label className="form-label">{t('dos.dining.mealsToPlan')}</label>
                    <div className="att-mode-bar">
                        {MEALS.map(m => (
                            <button key={m.value} type="button"
                                    className={`att-mode-btn${form.meals.includes(m.value) ? ' active' : ''}`}
                                    onClick={() => toggleMeal(m.value)}>
                                {t(m.labelKey)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {preview && (
                <div className="mt-1-5">
                    <div className="es-gen-summary">
                        <span className="badge badge-published">{t('dos.dining.seated', { count: preview.summary.seated })}</span>
                        {preview.summary.unassigned > 0 &&
                            <span className="badge badge-draft">{t('dos.dining.unseated', { count: preview.summary.unassigned })}</span>}
                        <span className="u-muted u-sm">
                            {t('dos.dining.summary', {
                                classes: preview.summary.classes,
                                students: preview.summary.students,
                                sittings: preview.summary.sittings,
                            })}
                        </span>
                    </div>

                    <h3 className="section-label-sm mt-1-5">{t('dos.dining.hallOccupancy')}</h3>
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('dos.dining.sitting')}</th>
                                    <th>{t('common.meal')}</th>
                                    <th>{t('dos.dining.seatedCol')}</th>
                                    <th>{t('common.capacity')}</th>
                                    <th>{t('common.free')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.occupancy.map(o => (
                                    <tr key={o.sitting_id}>
                                        <td>{o.sitting_name}</td>
                                        <td>{MEAL_KEY[o.meal] ? t(MEAL_KEY[o.meal]) : o.meal}</td>
                                        <td>{o.seated}</td>
                                        <td>{o.capacity}</td>
                                        <td className="u-muted">{o.free}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <h3 className="section-label-sm mt-1-5">{t('dos.dining.seating')}</h3>
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('common.meal')}</th>
                                    <th>{t('dos.dining.sitting')}</th>
                                    <th>{t('common.time')}</th>
                                    <th>{t('common.class')}</th>
                                    <th>{t('landing.chip.students')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.assignments.map((a, i) => (
                                    <tr key={i}>
                                        <td>{MEAL_KEY[a.meal] ? t(MEAL_KEY[a.meal]) : a.meal}</td>
                                        <td>{a.sitting_name}</td>
                                        <td className="es-nowrap">{a.start_time}-{a.end_time}</td>
                                        <td>{a.class_name}</td>
                                        <td>{a.students}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {preview.unassigned.length > 0 && (
                        <>
                            <h3 className="section-label-sm mt-1-5">{t('dos.dining.couldNotSeat')}</h3>
                            <ul className="u-sm u-danger">
                                {preview.unassigned.map((u, i) => (
                                    <li key={i}>{u.class_name} ({MEAL_KEY[u.meal] ? t(MEAL_KEY[u.meal]) : u.meal}): {u.reason}</li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </Modal>
    )
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export function DiningPlannerTab() {
    const { t } = useTranslation()
    const toast = useToast()
    const [sittings, setSittings] = useState([])
    const [plan, setPlan] = useState([])
    const [loading, setLoading] = useState(true)
    const [showGenerate, setShowGenerate] = useState(false)

    const load = useCallback(async () => {
        const [s, p] = await Promise.all([getDiningSittings(), getDiningPlan()])
        setSittings(Array.isArray(s) ? s : [])
        setPlan(Array.isArray(p) ? p : [])
    }, [])

    useEffect(() => {
        load()
            .catch(() => toast.error(t('dos.dining.loadFailed')))
            .finally(() => setLoading(false))
    }, [load, toast])

    async function handleCreate(data) { await createDiningSitting(data); await load() }
    async function handleUpdate(id, data) { await updateDiningSitting(id, data); await load() }
    async function handleDelete(id) {
        try { await deleteDiningSitting(id); await load() }
        catch { toast.error(t('dos.dining.deleteSittingFailed')) }
    }

    if (loading) return <SkeletonTable rows={6} cols={4} />

    const byMeal = plan.reduce((acc, r) => {
        (acc[r.meal] = acc[r.meal] || []).push(r)
        return acc
    }, {})
    const orderedMeals = MEALS.map(m => m.value).filter(m => byMeal[m]?.length)

    // The planner seats classes into sittings that are switched on, so opening
    // Generate with none active leads to exactly one outcome: an error toast
    // after the user has picked a term and meals. Gate the button and say why.
    const hasActiveSitting = sittings.some(s => s.is_active)

    return (
        <>
            {showGenerate && (
                <GenerateModal
                    onClose={() => setShowGenerate(false)}
                    onCommitted={() => {
                        setShowGenerate(false)
                        load().catch(() => toast.error(t('dos.dining.reloadFailed')))
                    }}
                />
            )}

            <SittingManager sittings={sittings} onCreate={handleCreate}
                            onUpdate={handleUpdate} onDelete={handleDelete} />

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">{t('dos.dining.planTitle')}</h2>
                    <div className="es-card-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => setShowGenerate(true)}
                                disabled={!hasActiveSitting}
                                title={hasActiveSitting ? undefined : t('dos.dining.generateNeedsSittings')}>
                            <span className="material-symbols-rounded">auto_awesome</span> {t('dos.examSchedule.generate')}
                        </button>
                    </div>
                </div>
                <div className="card-content">
                    {orderedMeals.length === 0 ? (
                        <p className="u-muted u-sm">
                            {t('dos.dining.noPlan')}
                        </p>
                    ) : orderedMeals.map(meal => (
                        <div key={meal} className="mb-5">
                            <h3 className="section-label-sm">{MEAL_KEY[meal] ? t(MEAL_KEY[meal]) : meal}</h3>
                            <div className="data-table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>{t('dos.dining.sitting')}</th>
                                            <th>{t('common.time')}</th>
                                            <th>{t('common.class')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {byMeal[meal].map(r => (
                                            <tr key={r.id}>
                                                <td>{r.sitting_name}</td>
                                                <td className="es-nowrap">{r.start_time}-{r.end_time}</td>
                                                <td>{r.class_name}</td>
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
