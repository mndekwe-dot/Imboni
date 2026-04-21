import { useState, useEffect } from 'react'
import '../../styles/components.css'

const DORMITORIES = [
    { key: 'kigoma',    name: 'Kigoma',    gender: 'Girls' },
    { key: 'europe',    name: 'Europe',    gender: 'Girls' },
    { key: 'qatar',     name: 'Qatar',     gender: 'Boys'  },
    { key: 'samiyonga', name: 'Samiyonga', gender: 'Boys'  },
]

export function DormitoryCaptainModal({ captain, onClose, onSave }) {
    const isEditing = !!captain

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const [form, setForm] = useState({
        dormKey:  captain?.dormKey  || '',
        name:     captain?.name     || '',
        adm:      captain?.adm      || '',
        form:     captain?.form     || '',
        since:    captain?.since    || '',
        conduct:  captain?.conduct  || 'Clean record',
    })

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function handleSave() {
        if (!form.dormKey || !form.name) return
        const dorm = DORMITORIES.find(d => d.key === form.dormKey)
        onSave({ ...form, gender: dorm?.gender })
        onClose()
    }

    const selectedDorm = DORMITORIES.find(d => d.key === form.dormKey)

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>

                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--discipline, #7c3aed)' }}>
                            {isEditing ? 'edit' : 'person_add'}
                        </span>
                        <h2 className="modal-title">
                            {isEditing ? 'Edit Dormitory Captain' : 'Add Dormitory Captain'}
                        </h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="modal-body">

                    <div className="form-group">
                        <label className="form-label">Dormitory</label>
                        <select
                            className="form-input"
                            name="dormKey"
                            value={form.dormKey}
                            onChange={handleChange}
                            disabled={isEditing}
                        >
                            <option value="">— Select dormitory —</option>
                            <optgroup label="Girls Dormitories">
                                {DORMITORIES.filter(d => d.gender === 'Girls').map(d => (
                                    <option key={d.key} value={d.key}>{d.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Boys Dormitories">
                                {DORMITORIES.filter(d => d.gender === 'Boys').map(d => (
                                    <option key={d.key} value={d.key}>{d.name}</option>
                                ))}
                            </optgroup>
                        </select>
                        {selectedDorm && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.25rem', display: 'block' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '0.85rem', verticalAlign: 'middle' }}>
                                    {selectedDorm.gender === 'Girls' ? 'female' : 'male'}
                                </span>
                                {' '}{selectedDorm.gender} dormitory
                            </span>
                        )}
                    </div>

                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Captain Name</label>
                            <input
                                className="form-input"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                placeholder="e.g. Grace Auma"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">ADM Number</label>
                            <input
                                className="form-input"
                                name="adm"
                                value={form.adm}
                                onChange={handleChange}
                                placeholder="e.g. 2024-F3-001"
                            />
                        </div>
                    </div>

                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Form / Class</label>
                            <input
                                className="form-input"
                                name="form"
                                value={form.form}
                                onChange={handleChange}
                                placeholder="e.g. S3A"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Appointed Since</label>
                            <input
                                className="form-input"
                                name="since"
                                type="date"
                                value={form.since}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Conduct Record</label>
                        <select className="form-input" name="conduct" value={form.conduct} onChange={handleChange}>
                            <option value="Clean record">Clean record</option>
                            <option value="1 conduct issue">1 conduct issue</option>
                            <option value="2 conduct issues">2 conduct issues</option>
                            <option value="Under review">Under review</option>
                        </select>
                    </div>

                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={!form.dormKey || !form.name}
                    >
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'person_add'}</span>
                        {isEditing ? ' Save Changes' : ' Add Captain'}
                    </button>
                </div>

            </div>
        </div>
    )
}
