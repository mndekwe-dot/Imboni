import { useState, useEffect } from 'react'
import '../../styles/components.css'

export function NewActivityModal({ onClose, onSave }) {
    const [form, setSaving_form] = useState({
        name: '', category: 'sport', schedule: '', venue: '',
        max_members: 30, description: '', is_active: true,
    })
    const [saving, setSaving] = useState(false)
    const [error,  setError]  = useState(null)

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    function handleChange(e) {
        const { name, value, type, checked } = e.target
        setSaving_form(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }

    async function handleSave() {
        if (!form.name) return
        setSaving(true); setError(null)
        try {
            await onSave({
                name:        form.name,
                category:    form.category,
                schedule:    form.schedule,
                venue:       form.venue,
                max_members: parseInt(form.max_members) || 30,
                description: form.description,
            })
        } catch { setError('Failed to create. Please try again.') }
        finally   { setSaving(false) }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--discipline, #7c3aed)' }}>add_circle</span>
                        <h2 className="modal-title">New Club / Event</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>

                <div className="modal-body">
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Club / Event Name *</label>
                            <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Science Club" />
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
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleChange} rows="3" placeholder="Brief description…" />
                    </div>
                    {error && <p style={{ color: '#dc2626', fontSize: '0.82rem' }}>{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name}>
                        <span className="material-symbols-rounded">add_circle</span>
                        {saving ? 'Creating…' : 'Create Club'}
                    </button>
                </div>
            </div>
        </div>
    )
}
