import { useState, useEffect } from 'react'
import '../../styles/components.css'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { classesFromConfig } from '../../utils/classes'
import { useDormitories } from '../../hooks/useDormitories'
import { useTranslation } from 'react-i18next'

const FEE_STATUSES = [
    { value: 'Paid',    labelKey: 'modals.student.feePaid'    },
    { value: 'Partial', labelKey: 'modals.student.feePartial' },
    { value: 'Overdue', labelKey: 'modals.student.feeOverdue' },
]
const STATUSES = [
    { value: 'Active',   labelKey: 'common.active'                  },
    { value: 'On Leave', labelKey: 'modals.student.statusOnLeave'   },
    { value: 'Deferred', labelKey: 'modals.student.statusDeferred'  },
]

export function AdminStudentModal({ student, onClose, onSave, readOnly = false }) {
    const { t } = useTranslation()
    const { config } = useSchoolConfig()
    const allClasses = classesFromConfig(config)
    // The school's own dormitories, not a fixed four hardcoded here.
    const dormitories = useDormitories()
    const isEditing = !!student
    const title = readOnly
        ? t('modals.student.detailsTitle')
        : isEditing ? t('modals.student.editTitle') : t('modals.student.admitTitle')

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
                        <span className="material-symbols-rounded modal-title-icon--admin" aria-hidden="true">
                            {readOnly ? 'person' : isEditing ? 'edit' : 'person_add'}
                        </span>
                        <h2 className="modal-title">{title}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose} aria-label={t('common.close')}>
                        <span className="material-symbols-rounded" aria-hidden="true">close</span>
                    </button>
                </div>

                <div className="modal-body modal-body--stack">
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('common.fullNameRequired')}</label>
                            <input
                                className={`form-input${errors.name ? ' input-error' : ''}`}
                                name="name" value={form.name} onChange={handleChange}
                                placeholder={t('modals.student.egStudentName')}
                                readOnly={readOnly}
                            />
                            {errors.name && <span className="field-error">{errors.name}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('common.admissionNo')}</label>
                            <input
                                className="form-input"
                                name="adm" value={form.adm} onChange={handleChange}
                                placeholder={t('modals.student.egAdmission')}
                                readOnly={readOnly}
                            />
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('common.class')}</label>
                            <select className="form-input" name="class" value={form.class} onChange={handleChange} disabled={readOnly}>
                                {allClasses.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('modals.student.houseDormitory')}</label>
                            <select className="form-input" name="house" value={form.house} onChange={handleChange} disabled={readOnly}>
                                <option value="">{t('modals.student.noDormitory')}</option>
                                {dormitories.map(h => <option key={h.key} value={h.name}>{h.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('modals.student.feeStatus')}</label>
                            <select className="form-input" name="fee" value={form.fee} onChange={handleChange} disabled={readOnly}>
                                {FEE_STATUSES.map(f => <option key={f.value} value={f.value}>{t(f.labelKey)}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('modals.student.enrollmentStatus')}</label>
                            <select className="form-input" name="status" value={form.status} onChange={handleChange} disabled={readOnly}>
                                {STATUSES.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        {readOnly ? t('common.close') : t('common.cancel')}
                    </button>
                    {!readOnly && (
                        <button className="btn btn-primary" onClick={handleSave}>
                            <span className="material-symbols-rounded" aria-hidden="true">{isEditing ? 'save' : 'person_add'}</span>
                            {isEditing ? t('common.saveChanges') : t('modals.student.admitTitle')}
                        </button>
                    )}
                </div>

            </div>
        </div>
    )
}
