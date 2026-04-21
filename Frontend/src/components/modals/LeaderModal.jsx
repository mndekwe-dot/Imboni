import { useState, useEffect } from 'react'
import '../../styles/components.css'

export function LeaderModal({ leader, onClose, onSave, students = [] }) {
    const isEditing = !!leader

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const [form, setForm] = useState({
        adm: leader?.adm || '',
        name: leader?.name || '',
        role: leader?.role || '',
        form: leader?.form || '',
        house: leader?.house || '',
        badge: leader?.badge || '',
        appointed: leader?.appointed || '',
    })

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function handleSave() {
        if (!form.name || !form.role) return
        onSave(form)
        onClose()
    }
    function handleAdmChange(e) {
        const value = e.target.value
        setForm(prev => ({ ...prev, adm: value }))

        // Search the student database
        const found = students.find(s => s.adm === value)
        if (found) {
            // Auto-fill all related fields
            setForm(prev => ({
                ...prev,
                adm: found.adm,
                name: found.name,
                form: found.classChip,
                house: found.house,
            }))
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>

                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--discipline, #7c3aed)' }}>
                            {isEditing ? 'edit' : 'person_add'}
                        </span>
                        <h2 className="modal-title">
                            {isEditing ? 'Edit Student Leader' : 'Add Student Leader'}
                        </h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Amina Odhiambo" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Role</label>
                            <input className="form-input" name="role" value={form.role} onChange={handleChange} placeholder="e.g. Head Girl" />
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Form</label>
                            <input className="form-input" name="form" value={form.form} onChange={handleChange} placeholder="e.g. S4A" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Dormitory</label>
                            <input className="form-input" name="house" value={form.house} onChange={handleChange} placeholder="e.g. Kigoma" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Badge</label>
                        <input className="form-input" name="badge" value={form.badge} onChange={handleChange} placeholder="e.g. Head Prefect" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">ADM Number</label>
                        <input className="form-input" name="adm" value={form.adm} onChange={handleAdmChange} placeholder="e.g. 2024-S4-001" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Appointed Date</label>
                        <input className="form-input" name="appointed" type="date" value={form.appointed} onChange={handleChange} />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!form.name || !form.role}>
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'person_add'}</span>
                        {isEditing ? ' Save Changes' : ' Add Student Leader'}
                    </button>
                </div>

            </div>
        </div>
    )
}
