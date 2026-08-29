import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '../../styles/components.css'

export function EditActivityModal({ activity, onClose, onSave }) {
    const { t } = useTranslation()
    const [form, setForm] = useState({
        name:        activity.name        || '',
        category:    activity.category    || 'sports',
        schedule:    activity.schedule    || '',
        venue:       activity.venue       || '',
        max_members: activity.max_members || 30,
        description: activity.description || '',
        is_active:   activity.is_active   ?? true,
    })
    const [saving, setSaving] = useState(false)
    const [error,  setError]  = useState(null)

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    function handleChange(e) {
        const { name, value, type, checked } = e.target
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }

    async function handleSave() {
        setSaving(true); setError(null)
        try {
            await onSave({
                name:        form.name,
                category:    form.category,
                schedule:    form.schedule,
                venue:       form.venue,
                max_members: parseInt(form.max_members) || 30,
                description: form.description,
                is_active:   form.is_active,
            })
        } catch { setError(t('common.genericSaveFailed')) }
        finally   { setSaving(false) }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded modal-title-icon--discipline" aria-hidden="true">edit</span>
                        <h2 className="modal-title">{t('modals.activity.editTitle')}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose} aria-label={t('common.close')}><span className="material-symbols-rounded" aria-hidden="true">close</span></button>
                </div>

                <div className="modal-body">
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('modals.activity.name')}</label>
                            <input className="form-input" name="name" value={form.name} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('common.category')}</label>
                            <select className="form-input" name="category" value={form.category} onChange={handleChange}>
                                <option value="sport">{t('dos.leaders.catSport')}</option>
                                <option value="music">{t('dos.leaders.catMusic')}</option>
                                <option value="art">{t('dos.leaders.catArt')}</option>
                                <option value="debate">{t('dos.leaders.catDebate')}</option>
                                <option value="science">{t('dos.leaders.catScience')}</option>
                                <option value="community">{t('dos.leaders.catCommunity')}</option>
                                <option value="leadership">{t('dos.leaders.catLeadership')}</option>
                                <option value="other">{t('dos.leaders.catOther')}</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('modals.activity.meetingSchedule')}</label>
                            <input className="form-input" name="schedule" value={form.schedule} onChange={handleChange} placeholder={t('modals.activity.egSchedule')} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('modals.activity.venueLocation')}</label>
                            <input className="form-input" name="venue" value={form.venue} onChange={handleChange} placeholder={t('modals.activity.egVenue')} />
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('modals.activity.maxMembers')}</label>
                            <input className="form-input" type="number" min="1" max="200" name="max_members" value={form.max_members} onChange={handleChange} />
                        </div>
                        <div className="form-group form-group--end">
                            <label className="form-check-label">
                                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
                                {t('common.active')}
                            </label>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('common.description')}</label>
                        <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleChange} rows="3" />
                    </div>
                    {error && <p className="dmod-error">{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <span className="material-symbols-rounded" aria-hidden="true">save</span>
                        {saving ? t('common.saving') : t('common.saveChanges')}
                    </button>
                </div>
            </div>
        </div>
    )
}
