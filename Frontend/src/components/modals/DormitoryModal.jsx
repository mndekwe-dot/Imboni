import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '../../styles/components.css'

function slugify(name) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function DormitoryModal({ dormitory, onClose, onSave }) {
    const { t } = useTranslation()
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
            <div className="modal-box modal-box-sm dmod-box" onClick={e => e.stopPropagation()}>

                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded dmod-title-icon" aria-hidden="true">
                            {isEditing ? 'edit' : 'add_home'}
                        </span>
                        <h2 className="modal-title">
                            {isEditing ? t('modals.dormitory.editTitle') : t('modals.dormitory.addTitle')}
                        </h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose} aria-label={t('common.close')}>
                        <span className="material-symbols-rounded" aria-hidden="true">close</span>
                    </button>
                </div>

                <div className="modal-body">

                    {/* ── Basic info ── */}
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('modals.dormitory.dormitoryName')}</label>
                            <input
                                className="form-input"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                placeholder={t('modals.dormitory.egName')}
                                disabled={isEditing}
                            />
                            {isEditing && (
                                <span className="dmod-hint">{t('modals.dormitory.nameLocked')}</span>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('dis.settings.gender')}</label>
                            <select className="form-input" name="gender" value={form.gender} onChange={handleChange}>
                                <option value="Girls">{t('common.girls')}</option>
                                <option value="Boys">{t('common.boys')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t('modals.dormitory.matronPatron')}</label>
                        <input
                            className="form-input"
                            name="staff"
                            value={form.staff}
                            onChange={handleChange}
                            placeholder={t('modals.dormitory.egMatron')}
                        />
                    </div>

                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('modals.dormitory.totalRooms')}</label>
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
                            <label className="form-label">{t('modals.dormitory.bedsPerRoom')}</label>
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
                    <div className="dmod-section">
                        <div className="dmod-section-title">
                            <span className="material-symbols-rounded" aria-hidden="true">meeting_room</span>
                            {t('modals.dormitory.chambers', { count: chambers.length })}
                        </div>

                        {/* Existing chambers */}
                        {chambers.length === 0 ? (
                            <p className="dmod-empty">
                                {t('modals.dormitory.noChambers')}
                            </p>
                        ) : (
                            <div className="dmod-list">
                                {chambers.map(ch => (
                                    <div key={ch.id} className="dmod-row">
                                        <span className="material-symbols-rounded dmod-row-icon" aria-hidden="true">meeting_room</span>
                                        <span className="dmod-row-name">{ch.name}</span>
                                        <span className="dmod-row-meta">{t('modals.dormitory.roomRange', { from: ch.roomStart, to: ch.roomEnd })}</span>
                                        <button
                                            className="btn-icon-clean"
                                            onClick={() => removeChamber(ch.id)}
                                            title={t('modals.dormitory.removeChamber')}
                                        >
                                            <span className="material-symbols-rounded dmod-row-delete" aria-hidden="true">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add new chamber */}
                        <div className="dmod-add">
                            <div className="dmod-add-title">{t('modals.dormitory.addChamber')}</div>
                            <div className="dmod-add-grid">
                                <div className="form-group">
                                    <input
                                        className="form-input"
                                        placeholder={t('modals.dormitory.chamberNamePlaceholder')}
                                        value={newChamber.name}
                                        onChange={e => setNewChamber(p => ({ ...p, name: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <input
                                        className="form-input"
                                        type="number"
                                        placeholder={t('modals.dormitory.roomFrom')}
                                        min={1}
                                        value={newChamber.roomStart}
                                        onChange={e => setNewChamber(p => ({ ...p, roomStart: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <input
                                        className="form-input"
                                        type="number"
                                        placeholder={t('modals.dormitory.roomTo')}
                                        min={1}
                                        value={newChamber.roomEnd}
                                        onChange={e => setNewChamber(p => ({ ...p, roomEnd: e.target.value }))}
                                    />
                                </div>
                            </div>
                            {chamberError && (
                                <span className="dmod-add-error">{chamberError}</span>
                            )}
                            <button
                                className="btn btn-outline btn-sm dmod-add-btn"
                                onClick={addChamber}
                            >
                                <span className="material-symbols-rounded" aria-hidden="true">add</span> {t('modals.dormitory.addChamber')}
                            </button>
                        </div>
                    </div>

                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
                        <span className="material-symbols-rounded" aria-hidden="true">{isEditing ? 'save' : 'add_home'}</span>
                        {isEditing ? t('common.saveChanges') : t('modals.dormitory.addTitle')}
                    </button>
                </div>

            </div>
        </div>
    )
}
