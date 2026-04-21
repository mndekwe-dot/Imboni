import { useState } from "react";
import { Modal } from './Modal'
import { DAYS, EXTRA_SLOTS } from '../../data/extraTimetable'
import { PERIODS } from '../../data/academicTimetable'

/* periods/slots default to the imported data constants so callers that don't
   manage their own period state get the right options without passing anything */
export function TimetableEditForm({ type, editingSlot, onSave, onDelete, onCancel, periods = PERIODS, slots = EXTRA_SLOTS }) {
    const [form, setForm] = useState({
        day: editingSlot?.day || '',
        slotId: editingSlot?.slot?.id || editingSlot?.period?.id || '',
        subject: editingSlot?.cell?.subject || '',
        teacher: editingSlot?.cell?.teacher || '',
        room: editingSlot?.cell?.room || '',
        cellType: editingSlot?.cell?.type || 'academic',
    })

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const title = editingSlot?.cell ? 'Edit Slot' : 'Add Slot'

    return (
        <Modal title={title} icon="edit_calendar" onClose={onCancel}>
            <div className="tt-form">
                <div className="tt-form-row">
                    {/* Day selector — same for both types */}
                    <div className="form-group">
                        <label className="form-label">Day</label>
                        <select className="form-input" name="day" value={form.day} onChange={handleChange}>
                            <option value="">Select day</option>
                            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    {/* Period (academic) or Time Slot (extracurricular) */}
                    <div className="form-group">
                        <label className="form-label">{type === 'academic' ? 'Period' : 'Time Slot'}</label>
                        <select className="form-input" name="slotId" value={form.slotId} onChange={handleChange}>
                            <option value="">Select {type === 'academic' ? 'period' : 'slot'}</option>
                            {type === 'academic'
                                ? periods.map(p => <option key={p.id} value={p.id}>{p.label} ({p.time})</option>)
                                : slots.map(s => <option key={s.id} value={s.id}>{s.label} ({s.time})</option>)
                            }
                        </select>
                    </div>

                    {/* Activity Type only needed for extracurricular — academic is always 'academic' */}
                    {type === 'extracurricular' && (
                        <div className="form-group">
                            <label className="form-label">Activity Type</label>
                            <select className="form-input" name="cellType" value={form.cellType} onChange={handleChange}>
                                <option value="sports">Sports</option>
                                <option value="academic">Academic Club</option>
                                <option value="arts">Arts</option>
                                <option value="social">Social / Community</option>
                                <option value="boarding">Boarding / Dormitory</option>
                                <option value="dining">Dining</option>
                                <option value="empty">Empty / Free</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="tt-form-row">
                    {/* Label changes based on type */}
                    <div className="form-group">
                        <label className="form-label">{type === 'academic' ? 'Subject' : 'Activity Name'}</label>
                        <input
                            type="text"
                            className="form-input"
                            name="subject"
                            value={form.subject}
                            onChange={handleChange}
                            placeholder={type === 'academic' ? 'e.g. Mathematics' : 'e.g. Football Training'}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{type === 'academic' ? 'Teacher' : 'Staff in Charge'}</label>
                        <input
                            type="text"
                            className="form-input"
                            name="teacher"
                            value={form.teacher}
                            onChange={handleChange}
                            placeholder="e.g. Ms. Grace Mwangi"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Venue / Room</label>
                        <input
                            type="text"
                            className="form-input"
                            name="room"
                            value={form.room}
                            onChange={handleChange}
                            placeholder="e.g. Room 12, Lab 1"
                        />
                    </div>
                </div>

                <div className="tt-form-actions">
                    <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
                    {/* Delete button only shown when editing an existing slot, not when adding */}
                    {editingSlot?.cell && (
                        <button className="btn btn-outline" style={{ color: 'var(--destructive)', borderColor: 'var(--destructive)' }} onClick={() => onDelete(editingSlot)}>
                            <span className="material-symbols-rounded icon-sm">delete</span> Delete
                        </button>
                    )}
                    {/* Passes the whole form object up to the parent to handle saving */}
                    <button className="btn btn-primary" onClick={() => onSave(form)}>
                        <span className="material-symbols-rounded icon-sm">save</span> Save
                    </button>
                </div>
            </div>
        </Modal>
    )
}
