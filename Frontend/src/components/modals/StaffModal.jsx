import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '../../styles/components.css'

export function StaffModal({ staff, onClose, onSave }) {
    const { t } = useTranslation()
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
                        <span className="material-symbols-rounded modal-title-icon--discipline" aria-hidden="true">
                            {isEditing ? 'edit' : 'person_add'}
                        </span>
                        <h2 className="modal-title">
                            {isEditing ? t('modals.disStaff.editTitle') : t('modals.disStaff.addTitle')}
                        </h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose} aria-label={t('common.close')}>
                        <span className="material-symbols-rounded" aria-hidden="true">close</span>
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('modals.disStaff.fullName')}</label>
                            <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder={t('modals.disStaff.egName')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('modals.disStaff.roleDormitory')}</label>
                            <input className="form-input" name="role" value={form.role} onChange={handleChange} placeholder={t('modals.disStaff.egRole')} />
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('common.email')}</label>
                            <input className="form-input" name="email" value={form.email} onChange={handleChange} placeholder={t('modals.disStaff.egEmail')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('modals.disStaff.extension')}</label>
                            <input className="form-input" name="ext" value={form.ext} onChange={handleChange} placeholder={t('modals.disStaff.egExt')} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('modals.disStaff.dutyHours')}</label>
                        <input className="form-input" name="duty" value={form.duty} onChange={handleChange} placeholder={t('modals.disStaff.egDuty')} />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!form.name || !form.role}>
                        <span className="material-symbols-rounded" aria-hidden="true">{isEditing ? 'save' : 'person_add'}</span>
                        {isEditing ? t('common.saveChanges') : t('modals.disStaff.addButton')}
                    </button>
                </div>

            </div>
        </div>
    )
}
