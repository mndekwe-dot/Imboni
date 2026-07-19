import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { Loading } from '../../components/ui/Loading'
import {
    getTerms, getDutyPosts, createDutyPost, updateDutyPost, deleteDutyPost,
    getDutyRoster, generateDutyRoster, commitDutyRoster,
} from '../../api/dos'

const DAYS = [
    { value: 'monday',    label: 'Mon' },
    { value: 'tuesday',   label: 'Tue' },
    { value: 'wednesday', label: 'Wed' },
    { value: 'thursday',  label: 'Thu' },
    { value: 'friday',    label: 'Fri' },
    { value: 'saturday',  label: 'Sat' },
    { value: 'sunday',    label: 'Sun' },
]
const DAY_LABEL = Object.fromEntries(DAYS.map(d => [d.value, d.label]))
const WEEKDAYS = DAYS.slice(0, 5).map(d => d.value)

// ── Post manager — the duties the generator rotates staff through ────────────

function PostManager({ posts, onCreate, onUpdate, onDelete }) {
    const [draft, setDraft] = useState({ name: '', start_time: '', end_time: '', staff_required: 1 })
    const [error, setError] = useState('')

    async function add() {
        if (!draft.name.trim() || !draft.start_time || !draft.end_time) {
            setError('Name, start and end time are required'); return
        }
        try {
            await onCreate({ ...draft, name: draft.name.trim(), order: posts.length + 1 })
            setDraft({ name: '', start_time: '', end_time: '', staff_required: 1 })
            setError('')
        } catch (e) { setError(e.response?.data?.detail || 'Could not add duty post') }
    }

    return (
        <div className="card mb-5">
            <div className="card-header">
                <h2 className="card-title">Duty Posts</h2>
                <span className="u-muted u-sm">{posts.length} post{posts.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="card-content">
                {posts.length === 0 && (
                    <p className="u-muted u-sm">
                        No duty posts yet. Add one below. The generator rotates staff through
                        every active post on each selected day.
                    </p>
                )}
                {posts.map(p => (
                    <div key={p.id} className="dset-lesson-row">
                        <span className="dset-lesson-name">{p.name}</span>
                        <span className="u-muted u-sm">{p.start_time?.slice(0,5)}-{p.end_time?.slice(0,5)}</span>
                        <span className="es-room-chip">{p.staff_required} staff</span>
                        <label className="u-flex u-gap-05 u-items-center u-sm u-muted">
                            <input type="checkbox" checked={p.is_active}
                                   onChange={e => onUpdate(p.id, { is_active: e.target.checked })} />
                            Active
                        </label>
                        <button className="btn-icon-clean dos-danger-text" title="Delete duty post"
                                onClick={() => onDelete(p.id)}>
                            <span className="material-symbols-rounded u-fs-095">delete</span>
                        </button>
                    </div>
                ))}

                <div className="dset-lesson-add mt-1">
                    <input className="form-input dset-input-lesson" placeholder="Duty name (e.g. Break Supervision)"
                           value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                    <input type="time" className="form-input" aria-label="Start time"
                           value={draft.start_time} onChange={e => setDraft({ ...draft, start_time: e.target.value })} />
                    <input type="time" className="form-input" aria-label="End time"
                           value={draft.end_time} onChange={e => setDraft({ ...draft, end_time: e.target.value })} />
                    <input type="number" min="1" max="20" className="form-input dset-input-narrow"
                           aria-label="Staff required" value={draft.staff_required}
                           onChange={e => setDraft({ ...draft, staff_required: Number(e.target.value) })} />
                    <button className="btn btn-primary btn-sm" onClick={add}>Add</button>
                </div>
                {error && <p className="u-danger u-fs-085 mt-1">{error}</p>}
            </div>
        </div>
    )
}

// ── Generate modal — preview then commit ─────────────────────────────────────

function GenerateModal({ onClose, onCommitted }) {
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
                const current = list.find(t => t.is_current) || list[0]
                if (current) setForm(f => ({ ...f, term_id: String(current.id) }))
            })
            .catch(() => toast.error('Could not load academic terms.'))
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
            toast.error(err.response?.data?.detail || 'Could not generate a roster.')
        } finally { setBusy(false) }
    }

    async function handleCommit() {
        setBusy(true)
        try {
            const result = await commitDutyRoster(form)
            toast.success(`Saved ${result.created} duty assignment(s).`)
            onCommitted()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Could not save the roster.')
        } finally { setBusy(false) }
    }

    const canRun = form.term_id && form.days.length > 0 && !busy

    return (
        <Modal
            title="Generate Duty Roster" icon="auto_awesome" onClose={onClose} size="wide"
            footer={
                <div className="modal-confirm-actions u-full">
                    <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
                    {preview
                        ? <button className="btn btn-primary" onClick={handleCommit}
                                  disabled={busy || preview.summary.filled === 0}>
                              Save {preview.summary.filled} assignment(s)
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
                <div className="form-group">
                    <label className="form-label">Max duties per person per day</label>
                    <input type="number" min="1" max="10" className="form-input" value={form.max_per_day}
                           onChange={e => update('max_per_day', Number(e.target.value))} />
                </div>
                <div className="form-group u-col-span-all">
                    <label className="form-label">Days to cover *</label>
                    <div className="att-mode-bar">
                        {DAYS.map(d => (
                            <button key={d.value} type="button"
                                    className={`att-mode-btn${form.days.includes(d.value) ? ' active' : ''}`}
                                    onClick={() => toggleDay(d.value)}>
                                {d.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {preview && (
                <div className="mt-1-5">
                    <div className="es-gen-summary">
                        <span className="badge badge-published">{preview.summary.filled} filled</span>
                        {preview.summary.unfilled > 0 &&
                            <span className="badge badge-draft">{preview.summary.unfilled} unfilled</span>}
                        <span className="u-muted u-sm">
                            {preview.summary.staff} staff · {preview.summary.posts} posts ·
                            load spread {preview.summary.spread}
                        </span>
                    </div>

                    <div className="es-table-wrap mt-1">
                        <table className="es-table">
                            <thead>
                                <tr><th>Day</th><th>Duty</th><th>Time</th><th>Staff</th></tr>
                            </thead>
                            <tbody>
                                {preview.assignments.map((a, i) => (
                                    <tr key={i}>
                                        <td className="es-nowrap">{DAY_LABEL[a.day] || a.day}</td>
                                        <td>{a.post_name}</td>
                                        <td className="es-nowrap">{a.start_time}-{a.end_time}</td>
                                        <td>{a.staff_name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <h3 className="section-label-sm mt-1-5">Workload</h3>
                    <div className="es-table-wrap">
                        <table className="es-table">
                            <thead><tr><th>Staff</th><th>Duties</th></tr></thead>
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
            .catch(() => toast.error('Could not load duty roster.'))
            .finally(() => setLoading(false))
    }, [load, toast])

    async function handleCreate(data) { await createDutyPost(data); await load() }
    async function handleUpdate(id, data) { await updateDutyPost(id, data); await load() }
    async function handleDelete(id) {
        try { await deleteDutyPost(id); await load() }
        catch { toast.error('Could not delete duty post.') }
    }

    if (loading) return <Loading />

    // Group the saved roster by day for display.
    const byDay = roster.reduce((acc, r) => {
        (acc[r.day] = acc[r.day] || []).push(r)
        return acc
    }, {})
    const orderedDays = DAYS.map(d => d.value).filter(d => byDay[d]?.length)

    return (
        <>
            {showGenerate && (
                <GenerateModal
                    onClose={() => setShowGenerate(false)}
                    onCommitted={() => {
                        setShowGenerate(false)
                        load().catch(() => toast.error('Could not reload roster.'))
                    }}
                />
            )}

            <PostManager posts={posts} onCreate={handleCreate}
                         onUpdate={handleUpdate} onDelete={handleDelete} />

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Duty Roster</h2>
                    <div className="es-card-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => setShowGenerate(true)}>
                            <span className="material-symbols-rounded">auto_awesome</span> Generate
                        </button>
                    </div>
                </div>
                <div className="card-content">
                    {orderedDays.length === 0 ? (
                        <p className="u-muted u-sm">
                            No roster saved yet. Configure duty posts above, then use Generate to
                            rotate staff through them fairly.
                        </p>
                    ) : orderedDays.map(day => (
                        <div key={day} className="mb-5">
                            <h3 className="section-label-sm">{DAY_LABEL[day] || day}</h3>
                            <div className="es-table-wrap">
                                <table className="es-table">
                                    <thead>
                                        <tr><th>Duty</th><th>Time</th><th>Staff</th><th>Role</th></tr>
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
