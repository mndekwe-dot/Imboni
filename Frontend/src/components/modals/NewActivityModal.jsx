import { useState, useEffect } from 'react'
import '../../styles/components.css'

export function NewActivityModal({ onClose, onSave }) {
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const [form, setForm] = useState({
        name: '',
        cat: 'sports',
        patron: '',
        schedule: '',
        venue: '',
        status: 'draft',
        description: '',
    })

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function handleSave() {
        if (!form.name || !form.patron) return
        onSave(form)
        onClose()
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-lg" onClick={e => e.stopPropagation()}>

                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--discipline, #7c3aed)' }}>add_circle</span>
                        <h2 className="modal-title">New Club / Event</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Club / Event Name</label>
                            <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Science Club" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Category</label>
                            <select className="form-input" name="cat" value={form.cat} onChange={handleChange}>
                                <option value="sports">Sports</option>
                                <option value="arts">Arts</option>
                                <option value="academic">Academic</option>
                                <option value="social">Social</option>
                                <option value="science">Science</option>
                                <option value="event">Event</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Patron Teacher</label>
                            <input className="form-input" name="patron" value={form.patron} onChange={handleChange} placeholder="e.g. Mr. Mwangi" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Meeting Schedule</label>
                            <input className="form-input" name="schedule" value={form.schedule} onChange={handleChange} placeholder="e.g. Tue & Thu, 4:30 PM" />
                        </div>
                    </div>

                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Venue / Location</label>
                            <input className="form-input" name="venue" value={form.venue} onChange={handleChange} placeholder="e.g. Sports Field" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-input" name="status" value={form.status} onChange={handleChange}>
                                <option value="draft">Draft</option>
                                <option value="active">Active</option>
                                <option value="published">Published</option>
                                <option value="suspended">Suspended</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleChange} rows="3" placeholder="Brief description..." />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={!form.name || !form.patron}>
                        <span className="material-symbols-rounded">add_circle</span> Create Club
                    </button>
                </div>

            </div>
        </div>
    )
}
