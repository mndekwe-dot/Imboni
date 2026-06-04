import { useState, useEffect } from 'react'
import '../../styles/components.css'

export function EditActivityModal({ activity, onClose, onSave }) {
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
        } catch { setError('Failed to save. Please try again.') }
        finally   { setSaving(false) }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--discipline, #7c3aed)' }}>edit</span>
                        <h2 className="modal-title">Edit Club / Event</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>

                <div className="modal-body">
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Club / Event Name</label>
                            <input className="form-input" name="name" value={form.name} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Category</label>
                            <select className="form-input" name="category" value={form.category} onChange={handleChange}>
                                <option value="sport">Sports</option>
                                <option value="music">Music</option>
                                <option value="art">Arts &amp; Crafts</option>
                                <option value="debate">Debate</option>
                                <option value="science">Science</option>
                                <option value="community">Community Service</option>
                                <option value="leadership">Leadership</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Meeting Schedule</label>
                            <input className="form-input" name="schedule" value={form.schedule} onChange={handleChange} placeholder="e.g. Tue & Thu, 4:30 PM" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Venue / Location</label>
                            <input className="form-input" name="venue" value={form.venue} onChange={handleChange} placeholder="e.g. Sports Field" />
                        </div>
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Max Members</label>
                            <input className="form-input" type="number" min="1" max="200" name="max_members" value={form.max_members} onChange={handleChange} />
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
                                Active
                            </label>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleChange} rows="3" />
                    </div>
                    {error && <p style={{ color: '#dc2626', fontSize: '0.82rem' }}>{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <span className="material-symbols-rounded">save</span>
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}
