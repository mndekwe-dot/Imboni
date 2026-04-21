import { useState, useEffect } from 'react'
import '../../styles/components.css'

const PAYMENT_TYPES = ['Full Payment', 'Partial', 'Bursary', 'Scholarship']

export function AdminPaymentModal({ onClose, onSave }) {
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const today = new Date().toISOString().split('T')[0]

    const [form, setForm] = useState({
        studentName: '',
        adm:         '',
        amount:      '',
        date:        today,
        type:        'Full Payment',
        notes:       '',
    })
    const [errors, setErrors] = useState({})

    function handleChange(e) {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    }

    function validate() {
        const e = {}
        if (!form.studentName.trim()) e.studentName = 'Student name is required'
        if (!form.amount.trim())      e.amount       = 'Amount is required'
        return e
    }

    function handleSave() {
        const e = validate()
        if (Object.keys(e).length) { setErrors(e); return }
        const typeClassMap = { 'Full Payment': 'paid', Partial: 'partial', Bursary: 'info', Scholarship: 'info' }
        const initials = form.studentName.trim().split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
        const amountFormatted = form.amount.startsWith('KES') ? form.amount : `KES ${Number(form.amount.replace(/,/g, '')).toLocaleString()}`
        onSave({
            initials,
            name:      form.studentName,
            adm:       form.adm || '—',
            amount:    amountFormatted,
            date:      new Date(form.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            type:      form.type,
            typeClass: typeClassMap[form.type] || 'paid',
        })
        onClose()
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>

                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--admin, #4f46e5)' }}>payments</span>
                        <h2 className="modal-title">Record New Payment</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Student Name *</label>
                            <input
                                className={`form-input${errors.studentName ? ' input-error' : ''}`}
                                name="studentName" value={form.studentName} onChange={handleChange}
                                placeholder="e.g. Aisha Kamau"
                            />
                            {errors.studentName && <span style={{ color: 'var(--destructive)', fontSize: '0.75rem' }}>{errors.studentName}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Admission No.</label>
                            <input
                                className="form-input"
                                name="adm" value={form.adm} onChange={handleChange}
                                placeholder="e.g. ADM-2026-001"
                            />
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Amount (KES) *</label>
                            <input
                                className={`form-input${errors.amount ? ' input-error' : ''}`}
                                name="amount" value={form.amount} onChange={handleChange}
                                placeholder="e.g. 58000"
                                type="number" min="0"
                            />
                            {errors.amount && <span style={{ color: 'var(--destructive)', fontSize: '0.75rem' }}>{errors.amount}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Payment Date</label>
                            <input
                                className="form-input"
                                name="date" value={form.date} onChange={handleChange}
                                type="date"
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Payment Type</label>
                        <select className="form-input" name="type" value={form.type} onChange={handleChange}>
                            {PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Notes (optional)</label>
                        <textarea
                            className="form-input" name="notes" value={form.notes} onChange={handleChange}
                            placeholder="Any additional details..." rows={2}
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <span className="material-symbols-rounded">add_card</span>
                        Record Payment
                    </button>
                </div>

            </div>
        </div>
    )
}
