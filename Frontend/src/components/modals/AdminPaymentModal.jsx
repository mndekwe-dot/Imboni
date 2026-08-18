import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate } from '../../utils/date'
import { useCurrency } from '../../hooks/useCurrency'
import '../../styles/components.css'

// The stored value stays English so existing records keep resolving; only
// the label the user reads is translated.
const PAYMENT_TYPES = [
    { value: 'Full Payment', labelKey: 'modals.payment.typeFull'        },
    { value: 'Partial',      labelKey: 'modals.payment.typePartial'     },
    { value: 'Bursary',      labelKey: 'modals.payment.typeBursary'     },
    { value: 'Scholarship',  labelKey: 'modals.payment.typeScholarship' },
]

export function AdminPaymentModal({ onClose, onSave }) {
    const { t } = useTranslation()
    // The school's own currency, not a literal baked into this modal.
    const CURRENCY = useCurrency()
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
        const amountFormatted = form.amount.startsWith(CURRENCY) ? form.amount : `${CURRENCY} ${Number(form.amount.replace(/,/g, '')).toLocaleString()}`
        onSave({
            initials,
            name:      form.studentName,
            adm:       form.adm || '-',
            amount:    amountFormatted,
            date:      formatDate(form.date),
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
                        <span className="material-symbols-rounded modal-title-icon--admin">payments</span>
                        <h2 className="modal-title">{t('modals.payment.title')}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="modal-body modal-body--stack">
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('modals.payment.studentNameRequired')}</label>
                            <input
                                className={`form-input${errors.studentName ? ' input-error' : ''}`}
                                name="studentName" value={form.studentName} onChange={handleChange}
                                placeholder={t('modals.payment.egStudentName')}
                            />
                            {errors.studentName && <span className="field-error">{errors.studentName}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('common.admissionNo')}</label>
                            <input
                                className="form-input"
                                name="adm" value={form.adm} onChange={handleChange}
                                placeholder={t('modals.payment.egAdmission')}
                            />
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('common.amountWithCurrency', { currency: CURRENCY })}</label>
                            <input
                                className={`form-input${errors.amount ? ' input-error' : ''}`}
                                name="amount" value={form.amount} onChange={handleChange}
                                placeholder={t('modals.payment.egAmount')}
                                type="number" min="0"
                            />
                            {errors.amount && <span className="field-error">{errors.amount}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('modals.payment.paymentDate')}</label>
                            <input
                                className="form-input"
                                name="date" value={form.date} onChange={handleChange}
                                type="date"
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('modals.payment.paymentType')}</label>
                        <select className="form-input" name="type" value={form.type} onChange={handleChange}>
                            {PAYMENT_TYPES.map(pt => <option key={pt.value} value={pt.value}>{t(pt.labelKey)}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('modals.payment.notesOptional')}</label>
                        <textarea
                            className="form-input" name="notes" value={form.notes} onChange={handleChange}
                            placeholder={t('modals.payment.notesPlaceholder')} rows={2}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <span className="material-symbols-rounded">add_card</span>
                        {t('modals.payment.record')}
                    </button>
                </div>

            </div>
        </div>
    )
}
