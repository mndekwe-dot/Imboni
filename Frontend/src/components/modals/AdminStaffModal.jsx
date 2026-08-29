import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '../../styles/components.css'

// Values stay English — they are what the record stores. Only labels move.
const DEPARTMENTS = [
    { value: 'Academic', labelKey: 'modals.staff.deptAcademic' },
    { value: 'Welfare',  labelKey: 'modals.staff.deptWelfare'  },
    { value: 'Admin',    labelKey: 'modals.staff.deptAdmin'    },
]
const CONTRACTS = [
    { value: 'Full-Time', labelKey: 'modals.staff.contractFullTime' },
    { value: 'Part-Time', labelKey: 'modals.staff.contractPartTime' },
]
const STATUSES = [
    { value: 'Active',   labelKey: 'common.active'                },
    { value: 'On Leave', labelKey: 'modals.staff.statusOnLeave'   },
    { value: 'Inactive', labelKey: 'modals.staff.statusInactive'  },
]

export function AdminStaffModal({ staff, onClose, onSave }) {
    const { t } = useTranslation()
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
                        <span className="material-symbols-rounded modal-title-icon--admin" aria-hidden="true">
                            {isEditing ? 'edit' : 'person_add'}
                        </span>
                        <h2 className="modal-title">
                            {isEditing ? t('modals.staff.editTitle') : t('modals.staff.addTitle')}
                        </h2>
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
                                placeholder={t('modals.staff.egStaffName')}
                            />
                            {errors.name && <span className="field-error">{errors.name}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('modals.staff.staffId')}</label>
                            <input
                                className="form-input"
                                name="id" value={form.id} onChange={handleChange}
                                placeholder={t('modals.staff.egStaffId')}
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('modals.staff.roleRequired')}</label>
                        <input
                            className={`form-input${errors.role ? ' input-error' : ''}`}
                            name="role" value={form.role} onChange={handleChange}
                            placeholder={t('modals.staff.egRole')}
                        />
                        {errors.role && <span className="field-error">{errors.role}</span>}
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('common.department')}</label>
                            <select className="form-input" name="dept" value={form.dept} onChange={handleChange}>
                                {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{t(d.labelKey)}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('modals.staff.contractType')}</label>
                            <select className="form-input" name="contract" value={form.contract} onChange={handleChange}>
                                {CONTRACTS.map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('common.status')}</label>
                        <select className="form-input" name="status" value={form.status} onChange={handleChange}>
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
                        </select>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <span className="material-symbols-rounded" aria-hidden="true">{isEditing ? 'save' : 'person_add'}</span>
                        {isEditing ? 'Save Changes' : 'Add Staff'}
                    </button>
                </div>

            </div>
        </div>
    )
}
