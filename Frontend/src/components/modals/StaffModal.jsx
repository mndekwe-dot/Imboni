import { useState, useEffect } from 'react'
import '../../styles/components.css'

export function StaffModal({ staff, onClose, onSave }) {
    const isEditing = !!staff

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const [form, setForm] = useState({
        name:  staff?.name  || '',
        role:  staff?.role  || '',
        email: staff?.email || '',
        ext:   staff?.ext   || '',
        duty:  staff?.duty  || '',
    })

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function handleSave() {
        if (!form.name || !form.role) return
        onSave(form)
        onClose()
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
                            {isEditing ? 'Edit Staff Member' : 'Add Staff Member'}
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
                            <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Ms. J. Kamau" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Role / Dormitory</label>
                            <input className="form-input" name="role" value={form.role} onChange={handleChange} placeholder="e.g. Matron — Kigoma Dormitory" />
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" name="email" value={form.email} onChange={handleChange} placeholder="e.g. j.kamau@imboni.edu" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Extension</label>
                            <input className="form-input" name="ext" value={form.ext} onChange={handleChange} placeholder="e.g. Extension 301" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Duty Hours</label>
                        <input className="form-input" name="duty" value={form.duty} onChange={handleChange} placeholder="e.g. 6:00 PM – 7:00 AM" />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!form.name || !form.role}>
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'person_add'}</span>
                        {isEditing ? ' Save Changes' : ' Add Staff'}
                    </button>
                </div>

            </div>
        </div>
    )
}
