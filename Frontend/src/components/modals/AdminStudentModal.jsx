import { useState, useEffect } from 'react'
import '../../styles/components.css'

const CLASSES = ['S1A', 'S1B', 'S1C', 'S2A', 'S2B', 'S2C', 'S3A', 'S3B', 'S4A', 'S4B', 'S5A', 'S5B', 'S6A', 'S6B']
const HOUSES  = ['Kigoma', 'Qatar', 'Europe', 'Samiyonga']
const FEE_STATUSES = ['Paid', 'Partial', 'Overdue']
const STATUSES     = ['Active', 'On Leave', 'Deferred']

export function AdminStudentModal({ student, onClose, onSave, readOnly = false }) {
    const isEditing = !!student
    const title = readOnly ? 'Student Details' : isEditing ? 'Edit Student' : 'Admit Student'

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const [form, setForm] = useState({
        name:      student?.name   || '',
        adm:       student?.adm    || '',
        class:     student?.class  || 'S1A',
        house:     student?.house  || 'Kigoma',
        fee:       student?.fee    || 'Paid',
        status:    student?.status || 'Active',
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
        return e
    }

    function handleSave() {
        const e = validate()
        if (Object.keys(e).length) { setErrors(e); return }
        const feeClassMap  = { Paid: 'paid', Partial: 'partial', Overdue: 'overdue' }
        const statClassMap = { Active: 'active', 'On Leave': 'pending', Deferred: 'inactive' }
        const initials = form.name.trim().split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
        onSave({ ...form, initials, feeClass: feeClassMap[form.fee], statusClass: statClassMap[form.status] })
        onClose()
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>

                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--admin, #4f46e5)' }}>
                            {readOnly ? 'person' : isEditing ? 'edit' : 'person_add'}
                        </span>
                        <h2 className="modal-title">{title}</h2>
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
                                placeholder="e.g. Aisha Kamau"
                                readOnly={readOnly}
                            />
                            {errors.name && <span style={{ color: 'var(--destructive)', fontSize: '0.75rem' }}>{errors.name}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Admission No.</label>
                            <input
                                className="form-input"
                                name="adm" value={form.adm} onChange={handleChange}
                                placeholder="e.g. ADM-2026-009"
                                readOnly={readOnly}
                            />
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Class</label>
                            <select className="form-input" name="class" value={form.class} onChange={handleChange} disabled={readOnly}>
                                {CLASSES.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">House / Dormitory</label>
                            <select className="form-input" name="house" value={form.house} onChange={handleChange} disabled={readOnly}>
                                {HOUSES.map(h => <option key={h}>{h}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Fee Status</label>
                            <select className="form-input" name="fee" value={form.fee} onChange={handleChange} disabled={readOnly}>
                                {FEE_STATUSES.map(f => <option key={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Enrollment Status</label>
                            <select className="form-input" name="status" value={form.status} onChange={handleChange} disabled={readOnly}>
                                {STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        {readOnly ? 'Close' : 'Cancel'}
                    </button>
                    {!readOnly && (
                        <button className="btn btn-primary" onClick={handleSave}>
                            <span className="material-symbols-rounded">{isEditing ? 'save' : 'person_add'}</span>
                            {isEditing ? 'Save Changes' : 'Admit Student'}
                        </button>
                    )}
                </div>

            </div>
        </div>
    )
}
