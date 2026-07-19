import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { Loading } from '../../components/ui/Loading'
import {
    getTerms, getDiningSittings, createDiningSitting, updateDiningSitting,
    deleteDiningSitting, getDiningPlan, generateDiningPlan, commitDiningPlan,
} from '../../api/dos'

const MEALS = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch',     label: 'Lunch' },
    { value: 'supper',    label: 'Supper' },
]
const MEAL_LABEL = Object.fromEntries(MEALS.map(m => [m.value, m.label]))

// ── Sitting manager ──────────────────────────────────────────────────────────

function SittingManager({ sittings, onCreate, onUpdate, onDelete }) {
    const [draft, setDraft] = useState({
        name: '', meal: 'lunch', start_time: '', end_time: '', capacity: 100,
    })
    const [error, setError] = useState('')

    async function add() {
        if (!draft.name.trim() || !draft.start_time || !draft.end_time) {
            setError('Name, start and end time are required'); return
        }
        if (!draft.capacity || draft.capacity < 1) { setError('Capacity must be at least 1'); return }
        try {
            await onCreate({ ...draft, name: draft.name.trim(), order: sittings.length + 1 })
            setDraft({ name: '', meal: 'lunch', start_time: '', end_time: '', capacity: 100 })
            setError('')
        } catch (e) { setError(e.response?.data?.detail || 'Could not add sitting') }
    }

    return (
        <div className="card mb-5">
            <div className="card-header">
                <h2 className="card-title">Dining Sittings</h2>
                <span className="u-muted u-sm">{sittings.length} sitting{sittings.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="card-content">
                {sittings.length === 0 && (
                    <p className="u-muted u-sm">
                        No sittings yet. Add one below. The planner seats whole classes into
                        sittings without exceeding the seats available.
                    </p>
                )}
                {sittings.map(s => (
                    <div key={s.id} className="dset-lesson-row">
                        <span className="dset-lesson-name">{s.name}</span>
                        <span className="es-room-chip">{MEAL_LABEL[s.meal] || s.meal}</span>
                        <span className="u-muted u-sm">{s.start_time?.slice(0,5)}-{s.end_time?.slice(0,5)}</span>
                        <span className="es-room-chip">{s.capacity} seats</span>
                        <label className="u-flex u-gap-05 u-items-center u-sm u-muted">
                            <input type="checkbox" checked={s.is_active}
                                   onChange={e => onUpdate(s.id, { is_active: e.target.checked })} />
                            Active
                        </label>
                        <button className="btn-icon-clean dos-danger-text" title="Delete sitting"
                                onClick={() => onDelete(s.id)}>
                            <span className="material-symbols-rounded u-fs-095">delete</span>
                        </button>
                    </div>
                ))}

                <div className="dset-lesson-add mt-1">
                    <input className="form-input dset-input-lesson" placeholder="Sitting name (e.g. Lunch 1)"
                           value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                    <select className="form-select" aria-label="Meal" value={draft.meal}
                            onChange={e => setDraft({ ...draft, meal: e.target.value })}>
                        {MEALS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <input type="time" className="form-input" aria-label="Start time"
                           value={draft.start_time} onChange={e => setDraft({ ...draft, start_time: e.target.value })} />
                    <input type="time" className="form-input" aria-label="End time"
                           value={draft.end_time} onChange={e => setDraft({ ...draft, end_time: e.target.value })} />
                    <input type="number" min="1" className="form-input dset-input-narrow"
                           aria-label="Capacity" value={draft.capacity}
                           onChange={e => setDraft({ ...draft, capacity: Number(e.target.value) })} />
                    <button className="btn btn-primary btn-sm" onClick={add}>Add</button>
                </div>
                {error && <p className="u-danger u-fs-085 mt-1">{error}</p>}
            </div>
        </div>
    )
}

// ── Generate modal ───────────────────────────────────────────────────────────

function GenerateModal({ onClose, onCommitted }) {
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
                const current = list.find(t => t.is_current) || list[0]
                if (current) setForm(f => ({ ...f, term_id: String(current.id) }))
            })
            .catch(() => toast.error('Could not load academic terms.'))
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
            toast.error(err.response?.data?.detail || 'Could not generate a dining plan.')
        } finally { setBusy(false) }
    }

    async function handleCommit() {
        setBusy(true)
        try {
            const result = await commitDiningPlan(form)
            toast.success(`Saved ${result.created} seating(s).`)
            onCommitted()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Could not save the dining plan.')
        } finally { setBusy(false) }
    }

    const canRun = form.term_id && form.meals.length > 0 && !busy

    return (
        <Modal
            title="Generate Dining Plan" icon="auto_awesome" onClose={onClose} size="wide"
            footer={
                <div className="modal-confirm-actions u-full">
                    <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
                    {preview
                        ? <button className="btn btn-primary" onClick={handleCommit}
                                  disabled={busy || preview.summary.seated === 0}>
                              Save {preview.summary.seated} seating(s)
                          </button>
                        : <button className="btn btn-primary" onClick={handlePreview} disabled={!canRun}>
                              {busy ? 'Generating…' : 'Preview'}
                          </button>}
                </div>
            }
        >
            <div className="u-grid u-grid-2 u-gap-1">
                <div className="form-group">
                    <label className="form-label">Academic Term *</label>
                    <select className="form-select" value={form.term_id}
                            onChange={e => update('term_id', e.target.value)}>
                        <option value="">Select term…</option>
                        {terms.map(t => <option key={t.id} value={t.id}>{t.name} ({t.year})</option>)}
                    </select>
                </div>
                <div className="form-group u-col-span-all">
                    <label className="form-label">Meals to plan *</label>
                    <div className="att-mode-bar">
                        {MEALS.map(m => (
                            <button key={m.value} type="button"
                                    className={`att-mode-btn${form.meals.includes(m.value) ? ' active' : ''}`}
                                    onClick={() => toggleMeal(m.value)}>
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {preview && (
                <div className="mt-1-5">
                    <div className="es-gen-summary">
                        <span className="badge badge-published">{preview.summary.seated} seated</span>
                        {preview.summary.unassigned > 0 &&
                            <span className="badge badge-draft">{preview.summary.unassigned} unseated</span>}
                        <span className="u-muted u-sm">
                            {preview.summary.classes} classes · {preview.summary.students} students ·
                            {' '}{preview.summary.sittings} sittings
                        </span>
                    </div>

                    <h3 className="section-label-sm mt-1-5">Hall occupancy</h3>
                    <div className="es-table-wrap">
                        <table className="es-table">
                            <thead>
                                <tr><th>Sitting</th><th>Meal</th><th>Seated</th><th>Capacity</th><th>Free</th></tr>
                            </thead>
                            <tbody>
                                {preview.occupancy.map(o => (
                                    <tr key={o.sitting_id}>
                                        <td>{o.sitting_name}</td>
                                        <td>{MEAL_LABEL[o.meal] || o.meal}</td>
                                        <td>{o.seated}</td>
                                        <td>{o.capacity}</td>
                                        <td className="u-muted">{o.free}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <h3 className="section-label-sm mt-1-5">Seating</h3>
                    <div className="es-table-wrap">
                        <table className="es-table">
                            <thead>
                                <tr><th>Meal</th><th>Sitting</th><th>Time</th><th>Class</th><th>Students</th></tr>
                            </thead>
                            <tbody>
                                {preview.assignments.map((a, i) => (
                                    <tr key={i}>
                                        <td>{MEAL_LABEL[a.meal] || a.meal}</td>
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
                            <h3 className="section-label-sm mt-1-5">Could not seat</h3>
                            <ul className="u-sm u-danger">
                                {preview.unassigned.map((u, i) => (
                                    <li key={i}>{u.class_name} ({MEAL_LABEL[u.meal] || u.meal}): {u.reason}</li>
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
            .catch(() => toast.error('Could not load dining plan.'))
            .finally(() => setLoading(false))
    }, [load, toast])

    async function handleCreate(data) { await createDiningSitting(data); await load() }
    async function handleUpdate(id, data) { await updateDiningSitting(id, data); await load() }
    async function handleDelete(id) {
        try { await deleteDiningSitting(id); await load() }
        catch { toast.error('Could not delete sitting.') }
    }

    if (loading) return <Loading />

    const byMeal = plan.reduce((acc, r) => {
        (acc[r.meal] = acc[r.meal] || []).push(r)
        return acc
    }, {})
    const orderedMeals = MEALS.map(m => m.value).filter(m => byMeal[m]?.length)

    return (
        <>
            {showGenerate && (
                <GenerateModal
                    onClose={() => setShowGenerate(false)}
                    onCommitted={() => {
                        setShowGenerate(false)
                        load().catch(() => toast.error('Could not reload dining plan.'))
                    }}
                />
            )}

            <SittingManager sittings={sittings} onCreate={handleCreate}
                            onUpdate={handleUpdate} onDelete={handleDelete} />

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Dining Plan</h2>
                    <div className="es-card-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => setShowGenerate(true)}>
                            <span className="material-symbols-rounded">auto_awesome</span> Generate
                        </button>
                    </div>
                </div>
                <div className="card-content">
                    {orderedMeals.length === 0 ? (
                        <p className="u-muted u-sm">
                            No dining plan saved yet. Configure sittings above, then use Generate
                            to seat classes without overfilling the hall.
                        </p>
                    ) : orderedMeals.map(meal => (
                        <div key={meal} className="mb-5">
                            <h3 className="section-label-sm">{MEAL_LABEL[meal] || meal}</h3>
                            <div className="es-table-wrap">
                                <table className="es-table">
                                    <thead>
                                        <tr><th>Sitting</th><th>Time</th><th>Class</th></tr>
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
