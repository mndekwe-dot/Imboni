import { useState, useEffect } from 'react'
import '../../styles/components.css'

function slugify(name) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function DormitoryModal({ dormitory, onClose, onSave }) {
    const isEditing = !!dormitory

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const [form, setForm] = useState({
        name:        dormitory?.name        || '',
        gender:      dormitory?.gender      || 'Girls',
        staff:       dormitory?.staff       || '',
        totalRooms:  dormitory?.totalRooms  || 30,
        bedsPerRoom: dormitory?.bedsPerRoom || 8,
    })

    const [chambers, setChambers] = useState(
        dormitory?.chambers
            ? dormitory.chambers.map((c, i) => ({ id: i, ...c }))
            : []
    )

    const [newChamber, setNewChamber] = useState({ name: '', roomStart: '', roomEnd: '' })
    const [chamberError, setChamberError] = useState('')

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function addChamber() {
        const start = Number(newChamber.roomStart)
        const end   = Number(newChamber.roomEnd)
        if (!newChamber.name.trim())         { setChamberError('Chamber name is required.'); return }
        if (!start || !end || start > end)   { setChamberError('Room range is invalid.'); return }
        if (end > Number(form.totalRooms))   { setChamberError(`Room end cannot exceed total rooms (${form.totalRooms}).`); return }
        setChambers(prev => [...prev, { id: Date.now(), name: newChamber.name.trim(), roomStart: start, roomEnd: end }])
        setNewChamber({ name: '', roomStart: '', roomEnd: '' })
        setChamberError('')
    }

    function removeChamber(id) {
        setChambers(prev => prev.filter(c => c.id !== id))
    }

    function handleSave() {
        if (!form.name.trim() || !form.staff.trim()) return
        const key = isEditing ? dormitory.key : slugify(form.name) || `dorm-${Date.now()}`
        onSave({
            key,
            name:        form.name.trim(),
            gender:      form.gender,
            staff:       form.staff.trim(),
            totalRooms:  Number(form.totalRooms),
            bedsPerRoom: Number(form.bedsPerRoom),
            chambers:    chambers.map(c => ({ name: c.name, roomStart: c.roomStart, roomEnd: c.roomEnd })),
        })
        onClose()
    }

    const canSave = form.name.trim() && form.staff.trim() && Number(form.totalRooms) > 0 && Number(form.bedsPerRoom) > 0

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>

                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--discipline, #7c3aed)' }}>
                            {isEditing ? 'edit' : 'add_home'}
                        </span>
                        <h2 className="modal-title">
                            {isEditing ? 'Edit Dormitory' : 'Add Dormitory'}
                        </h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="modal-body">

                    {/* ── Basic info ── */}
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Dormitory Name</label>
                            <input
                                className="form-input"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                placeholder="e.g. Kigoma"
                                disabled={isEditing}
                            />
                            {isEditing && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Name cannot be changed after creation</span>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Gender</label>
                            <select className="form-input" name="gender" value={form.gender} onChange={handleChange}>
                                <option value="Girls">Girls</option>
                                <option value="Boys">Boys</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Matron / Patron</label>
                        <input
                            className="form-input"
                            name="staff"
                            value={form.staff}
                            onChange={handleChange}
                            placeholder="e.g. Mrs. Mukamana"
                        />
                    </div>

                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Total Rooms</label>
                            <input
                                className="form-input"
                                type="number"
                                name="totalRooms"
                                min={1}
                                value={form.totalRooms}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Beds Per Room</label>
                            <input
                                className="form-input"
                                type="number"
                                name="bedsPerRoom"
                                min={1}
                                max={20}
                                value={form.bedsPerRoom}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    {/* ── Chambers ── */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>meeting_room</span>
                            Chambers ({chambers.length})
                        </div>

                        {/* Existing chambers */}
                        {chambers.length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', fontStyle: 'italic', marginBottom: '0.75rem' }}>
                                No chambers yet — add one below.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                {chambers.map(ch => (
                                    <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--muted)', borderRadius: 'var(--radius-sm)', padding: '0.45rem 0.75rem' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>meeting_room</span>
                                        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.85rem' }}>{ch.name}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Rooms {ch.roomStart}–{ch.roomEnd}</span>
                                        <button
                                            className="btn-icon-clean"
                                            onClick={() => removeChamber(ch.id)}
                                            title="Remove chamber"
                                        >
                                            <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--destructive)' }}>delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add new chamber */}
                        <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.1rem' }}>Add Chamber</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <input
                                        className="form-input"
                                        placeholder="Chamber name (e.g. Chamber A)"
                                        value={newChamber.name}
                                        onChange={e => setNewChamber(p => ({ ...p, name: e.target.value }))}
                                        style={{ fontSize: '0.82rem' }}
                                    />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <input
                                        className="form-input"
                                        type="number"
                                        placeholder="Room from"
                                        min={1}
                                        value={newChamber.roomStart}
                                        onChange={e => setNewChamber(p => ({ ...p, roomStart: e.target.value }))}
                                        style={{ fontSize: '0.82rem' }}
                                    />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <input
                                        className="form-input"
                                        type="number"
                                        placeholder="Room to"
                                        min={1}
                                        value={newChamber.roomEnd}
                                        onChange={e => setNewChamber(p => ({ ...p, roomEnd: e.target.value }))}
                                        style={{ fontSize: '0.82rem' }}
                                    />
                                </div>
                            </div>
                            {chamberError && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--destructive)' }}>{chamberError}</span>
                            )}
                            <button
                                className="btn btn-outline btn-sm"
                                style={{ alignSelf: 'flex-start' }}
                                onClick={addChamber}
                            >
                                <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>add</span> Add Chamber
                            </button>
                        </div>
                    </div>

                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'add_home'}</span>
                        {isEditing ? ' Save Changes' : ' Add Dormitory'}
                    </button>
                </div>

            </div>
        </div>
    )
}
