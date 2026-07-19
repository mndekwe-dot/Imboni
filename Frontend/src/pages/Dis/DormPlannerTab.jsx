import { useState, useEffect, useCallback } from 'react'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { Loading } from '../../components/ui/Loading'
import {
    getDormitories, createDormitory, patchDormitory, deleteDormitory,
    getDormRooms, createDormRoom, patchDormRoom, deleteDormRoom,
    generateHousing, commitHousing,
} from '../../api/discipline'

const GENDERS = [
    { value: 'mixed',  label: 'Mixed'  },
    { value: 'male',   label: 'Boys'   },
    { value: 'female', label: 'Girls'  },
]
const GENDER_LABEL = Object.fromEntries(GENDERS.map(g => [g.value, g.label]))

// ── Dormitory + room manager — the bins the generator packs into ─────────────

function DormManager({ dorms, rooms, onCreateDorm, onUpdateDorm, onDeleteDorm,
                       onCreateRoom, onUpdateRoom, onDeleteRoom }) {
    const [dormDraft, setDormDraft] = useState({ name: '', gender: 'mixed' })
    const [roomDraft, setRoomDraft] = useState({ dormitory: '', room_number: '', bed_capacity: 4 })
    const [error, setError] = useState('')

    async function addDorm() {
        if (!dormDraft.name.trim()) { setError('Dormitory name is required'); return }
        try {
            await onCreateDorm({ ...dormDraft, name: dormDraft.name.trim() })
            setDormDraft({ name: '', gender: 'mixed' })
            setError('')
        } catch (e) { setError(e.response?.data?.detail || 'Could not add dormitory') }
    }

    async function addRoom() {
        if (!roomDraft.dormitory || !roomDraft.room_number.trim()) {
            setError('Pick a dormitory and enter a room number'); return
        }
        try {
            await onCreateRoom({ ...roomDraft, room_number: roomDraft.room_number.trim() })
            setRoomDraft({ dormitory: roomDraft.dormitory, room_number: '', bed_capacity: 4 })
            setError('')
        } catch (e) { setError(e.response?.data?.detail || 'Could not add room') }
    }

    return (
        <div className="card mb-5">
            <div className="card-header">
                <h2 className="card-title">Dormitories &amp; Rooms</h2>
                <span className="u-muted u-sm">
                    {dorms.length} dormitor{dorms.length !== 1 ? 'ies' : 'y'} · {rooms.length} room{rooms.length !== 1 ? 's' : ''}
                </span>
            </div>
            <div className="card-content">
                {dorms.length === 0 && (
                    <p className="u-muted u-sm">
                        No dormitories yet. Add one below, give it rooms with a bed
                        capacity, then use Generate to pack boarders into them.
                    </p>
                )}

                {dorms.map(d => (
                    <div key={d.id} className="dorm-block">
                        <div className="dorm-head">
                            <strong>{d.name}</strong>
                            <span className="badge">{GENDER_LABEL[d.gender] || d.gender}</span>
                            <span className="u-muted u-sm">{d.bed_count ?? 0} beds</span>
                            <label className="u-flex u-gap-05 u-items-center u-sm u-muted">
                                <input type="checkbox" checked={d.is_active}
                                       onChange={e => onUpdateDorm(d.id, { is_active: e.target.checked })} />
                                Active
                            </label>
                            <button className="btn-icon-clean" title={`Delete ${d.name}`}
                                    onClick={() => onDeleteDorm(d.id)}>
                                <span className="material-symbols-rounded u-fs-095">delete</span>
                            </button>
                        </div>
                        <div className="dorm-rooms">
                            {rooms.filter(r => String(r.dormitory) === String(d.id)).map(r => (
                                <span key={r.id} className={`dorm-room-chip${r.is_active ? '' : ' is-off'}`}>
                                    {r.room_number} · {r.bed_capacity} beds
                                    <button className="btn-icon-clean" title={`Toggle room ${r.room_number}`}
                                            onClick={() => onUpdateRoom(r.id, { is_active: !r.is_active })}>
                                        <span className="material-symbols-rounded u-fs-085">
                                            {r.is_active ? 'toggle_on' : 'toggle_off'}
                                        </span>
                                    </button>
                                    <button className="btn-icon-clean" title={`Delete room ${r.room_number}`}
                                            onClick={() => onDeleteRoom(r.id)}>
                                        <span className="material-symbols-rounded u-fs-085">close</span>
                                    </button>
                                </span>
                            ))}
                            {rooms.filter(r => String(r.dormitory) === String(d.id)).length === 0 && (
                                <span className="u-muted u-sm">No rooms yet</span>
                            )}
                        </div>
                    </div>
                ))}

                <div className="u-grid u-grid-2 u-gap-1 mt-1">
                    <div className="form-group">
                        <label className="form-label">Add a dormitory</label>
                        <div className="u-flex u-gap-05">
                            <input className="form-input" placeholder="Dormitory name (e.g. Bisoke)"
                                   value={dormDraft.name}
                                   onChange={e => setDormDraft({ ...dormDraft, name: e.target.value })} />
                            <select className="form-select" aria-label="Dormitory gender"
                                    value={dormDraft.gender}
                                    onChange={e => setDormDraft({ ...dormDraft, gender: e.target.value })}>
                                {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                            </select>
                            <button className="btn btn-primary btn-sm" onClick={addDorm}>Add</button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Add a room</label>
                        <div className="u-flex u-gap-05">
                            <select className="form-select" aria-label="Room dormitory"
                                    value={roomDraft.dormitory}
                                    onChange={e => setRoomDraft({ ...roomDraft, dormitory: e.target.value })}>
                                <option value="">Dormitory…</option>
                                {dorms.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <input className="form-input" placeholder="Room no."
                                   value={roomDraft.room_number}
                                   onChange={e => setRoomDraft({ ...roomDraft, room_number: e.target.value })} />
                            <input type="number" min="1" max="100" className="form-input"
                                   aria-label="Bed capacity" value={roomDraft.bed_capacity}
                                   onChange={e => setRoomDraft({ ...roomDraft, bed_capacity: Number(e.target.value) })} />
                            <button className="btn btn-primary btn-sm" onClick={addRoom}>Add</button>
                        </div>
                    </div>
                </div>
                {error && <p className="u-danger u-fs-085 mt-1">{error}</p>}
            </div>
        </div>
    )
}

// ── Generate modal — preview then commit ────────────────────────────────────

function GenerateModal({ dorms, onClose, onCommitted }) {
    const toast = useToast()
    const [selected, setSelected] = useState([])
    const [preview, setPreview] = useState(null)
    const [busy, setBusy] = useState(false)

    function toggleDorm(id) {
        setPreview(null)
        setSelected(s => s.includes(id) ? s.filter(d => d !== id) : [...s, id])
    }

    function payload() {
        return selected.length ? { dormitory_ids: selected } : {}
    }

    async function handlePreview() {
        setBusy(true)
        try {
            const plan = await generateHousing(payload())
            setPreview(plan)
            plan.warnings?.forEach(w => toast.info(w))
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Could not generate an assignment.')
        } finally { setBusy(false) }
    }

    async function handleCommit() {
        setBusy(true)
        try {
            const result = await commitHousing(payload())
            toast.success(`Assigned ${result.updated} student(s) to rooms.`)
            onCommitted()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Could not save the assignment.')
        } finally { setBusy(false) }
    }

    return (
        <Modal
            title="Generate Dormitory Assignment" icon="auto_awesome" onClose={onClose} size="wide"
            footer={
                <div className="modal-confirm-actions u-full">
                    <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
                    {preview
                        ? <button className="btn btn-primary" onClick={handleCommit}
                                  disabled={busy || preview.summary.placed === 0}>
                              Save {preview.summary.placed} assignment(s)
                          </button>
                        : <button className="btn btn-primary" onClick={handlePreview} disabled={busy}>
                              {busy ? 'Generating…' : 'Preview'}
                          </button>}
                </div>
            }
        >
            <div className="form-group">
                <label className="form-label">Dormitories to fill</label>
                <div className="att-mode-bar">
                    {dorms.map(d => (
                        <button key={d.id} type="button"
                                className={`att-mode-btn${selected.includes(d.id) ? ' active' : ''}`}
                                onClick={() => toggleDorm(d.id)}>
                            {d.name}
                        </button>
                    ))}
                </div>
                <p className="u-muted u-fs-085 mt-1">
                    Select none to use every active dormitory. Classes are kept together
                    where a room is big enough; day scholars are skipped.
                </p>
            </div>

            {preview && (
                <div className="mt-1-5">
                    <div className="es-gen-summary">
                        <span className="badge badge-published">{preview.summary.placed} placed</span>
                        {preview.summary.unplaced > 0 &&
                            <span className="badge badge-draft">{preview.summary.unplaced} unplaced</span>}
                        <span className="u-muted u-sm">
                            {preview.summary.students} boarders · {preview.summary.rooms_used}/{preview.summary.rooms} rooms used ·
                            {' '}{preview.summary.free_beds} free bed(s)
                        </span>
                    </div>

                    <h3 className="section-label-sm mt-1-5">Room occupancy</h3>
                    <div className="es-table-wrap">
                        <table className="es-table">
                            <thead>
                                <tr><th>Dormitory</th><th>Room</th><th>Occupancy</th><th>Free</th><th>Classes</th></tr>
                            </thead>
                            <tbody>
                                {preview.rooms.map(r => (
                                    <tr key={r.room_id}>
                                        <td>{r.dormitory}</td>
                                        <td className="es-nowrap">{r.room_number}</td>
                                        <td className="es-nowrap">{r.occupied}/{r.capacity}</td>
                                        <td>{r.free}</td>
                                        <td>{r.groups.length ? r.groups.join(', ') : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {preview.unplaced.length > 0 && (
                        <>
                            <h3 className="section-label-sm mt-1-5">Could not be placed</h3>
                            <div className="es-table-wrap">
                                <table className="es-table">
                                    <thead><tr><th>Student</th><th>Class</th><th>Reason</th></tr></thead>
                                    <tbody>
                                        {preview.unplaced.map(u => (
                                            <tr key={u.boarding_id}>
                                                <td>{u.student_name}</td>
                                                <td>{u.group}</td>
                                                <td className="u-muted">{u.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}
        </Modal>
    )
}

// ── Tab ─────────────────────────────────────────────────────────────────────

export function DormPlannerTab({ onCommitted }) {
    const toast = useToast()
    const [dorms, setDorms] = useState([])
    const [rooms, setRooms] = useState([])
    const [loading, setLoading] = useState(true)
    const [showGenerate, setShowGenerate] = useState(false)

    const load = useCallback(async () => {
        const [d, r] = await Promise.all([getDormitories(), getDormRooms()])
        setDorms(Array.isArray(d) ? d : [])
        setRooms(Array.isArray(r) ? r : [])
    }, [])

    useEffect(() => {
        load()
            .catch(() => toast.error('Could not load dormitories.'))
            .finally(() => setLoading(false))
    }, [load, toast])

    async function handleCreateDorm(data) { await createDormitory(data); await load() }
    async function handleUpdateDorm(id, data) { await patchDormitory(id, data); await load() }
    async function handleDeleteDorm(id) {
        try { await deleteDormitory(id); await load() }
        catch { toast.error('Could not delete dormitory.') }
    }
    async function handleCreateRoom(data) { await createDormRoom(data); await load() }
    async function handleUpdateRoom(id, data) { await patchDormRoom(id, data); await load() }
    async function handleDeleteRoom(id) {
        try { await deleteDormRoom(id); await load() }
        catch { toast.error('Could not delete room.') }
    }

    if (loading) return <Loading />

    const totalBeds = rooms.filter(r => r.is_active).reduce((n, r) => n + (r.bed_capacity || 0), 0)

    return (
        <>
            {showGenerate && (
                <GenerateModal
                    dorms={dorms.filter(d => d.is_active)}
                    onClose={() => setShowGenerate(false)}
                    onCommitted={() => {
                        setShowGenerate(false)
                        onCommitted?.()
                        load().catch(() => toast.error('Could not reload dormitories.'))
                    }}
                />
            )}

            <DormManager
                dorms={dorms} rooms={rooms}
                onCreateDorm={handleCreateDorm} onUpdateDorm={handleUpdateDorm}
                onDeleteDorm={handleDeleteDorm}
                onCreateRoom={handleCreateRoom} onUpdateRoom={handleUpdateRoom}
                onDeleteRoom={handleDeleteRoom}
            />

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">Room Assignment</h2>
                    <div className="es-card-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => setShowGenerate(true)}
                                disabled={rooms.length === 0}>
                            <span className="material-symbols-rounded">auto_awesome</span> Generate
                        </button>
                    </div>
                </div>
                <div className="card-content">
                    {rooms.length === 0 ? (
                        <p className="u-muted u-sm">
                            Add dormitory rooms above, then Generate packs every active
                            boarder into a bed — classes together, rooms filled evenly.
                        </p>
                    ) : (
                        <p className="u-muted u-sm">
                            {totalBeds} bed(s) across {rooms.filter(r => r.is_active).length} active room(s).
                            Generate previews the packing before anything is saved.
                        </p>
                    )}
                </div>
            </div>
        </>
    )
}
