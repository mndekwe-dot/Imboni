import { useState, useEffect } from 'react'
import '../../styles/components.css'

const DEPARTMENTS = ['Academic', 'Welfare', 'Admin']
const CONTRACTS   = ['Full-Time', 'Part-Time']
const STATUSES    = ['Active', 'On Leave', 'Inactive']

export function AdminStaffModal({ staff, onClose, onSave }) {
    const isEditing = !!staff

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const [form, setForm] = useState({
        name:     staff?.name     || '',
        id:       staff?.id       || '',
        role:     staff?.role     || '',
        dept:     staff?.dept     || 'Academic',
        contract: staff?.contract || 'Full-Time',
        status:   staff?.status   || 'Active',
    })
    const [errors, setErrors] = useState({})

    function handleChange(e) {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    }

    function validate() {
        const e = {}
        if (!form.name.trim()) e.name = 'Full name is required'
        if (!form.role.trim()) e.role = 'Role is required'
        return e
    }

    function handleSave() {
        const e = validate()
        if (Object.keys(e).length) { setErrors(e); return }
        const contractClass = form.contract === 'Full-Time' ? 'fulltime' : 'parttime'
        const statusClass   = form.status === 'Active' ? 'active' : form.status === 'On Leave' ? 'pending' : 'inactive'
        const initials      = form.name.trim().split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
        onSave({ ...form, initials, contractClass, statusClass })
        onClose()
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>

                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--admin, #4f46e5)' }}>
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

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Full Name *</label>
                            <input
                                className={`form-input${errors.name ? ' input-error' : ''}`}
                                name="name" value={form.name} onChange={handleChange}
                                placeholder="e.g. Ms. Grace Mwangi"
                            />
                            {errors.name && <span style={{ color: 'var(--destructive)', fontSize: '0.75rem' }}>{errors.name}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Staff ID</label>
                            <input
                                className="form-input"
                                name="id" value={form.id} onChange={handleChange}
                                placeholder="e.g. STF-009"
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Role / Position *</label>
                        <input
                            className={`form-input${errors.role ? ' input-error' : ''}`}
                            name="role" value={form.role} onChange={handleChange}
                            placeholder="e.g. Mathematics Teacher"
                        />
                        {errors.role && <span style={{ color: 'var(--destructive)', fontSize: '0.75rem' }}>{errors.role}</span>}
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Department</label>
                            <select className="form-input" name="dept" value={form.dept} onChange={handleChange}>
                                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Contract Type</label>
                            <select className="form-input" name="contract" value={form.contract} onChange={handleChange}>
                                {CONTRACTS.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Status</label>
                        <select className="form-input" name="status" value={form.status} onChange={handleChange}>
                            {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'person_add'}</span>
                        {isEditing ? 'Save Changes' : 'Add Staff'}
                    </button>
                </div>

            </div>
        </div>
    )
}
