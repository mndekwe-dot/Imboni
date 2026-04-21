import { useState } from 'react'
import { Modal } from './Modal'

/* ─── PeriodManager ─────────────────────────────────────────────────────────
   Modal editor for the periods/time-slots list.
   Renders one editable row per period: label + time string.
   Changes are lifted up immediately via onChange so the timetable re-renders.

   Props:
     periods  — current array of { id, label, time }
     onChange — called with the updated array on every change
     onClose  — called when the user closes the modal
──────────────────────────────────────────────────────────────────────────── */
export function PeriodManager({ periods, onChange, onClose }) {
    /* Track which row (by index) is being deleted — shows a confirm step */
    const [pendingDelete, setPendingDelete] = useState(null)

    /* Update a single field on a single row */
    function updateRow(index, field, value) {
        onChange(periods.map((p, i) => i === index ? { ...p, [field]: value } : p))
    }

    /* Append a blank row at the bottom */
    function addRow() {
        onChange([...periods, { id: `custom_${Date.now()}`, label: 'New Slot', time: '' }])
    }

    /* Remove row — confirmed via inline confirm step */
    function removeRow(index) {
        if (pendingDelete === index) {
            onChange(periods.filter((_, i) => i !== index))
            setPendingDelete(null)
        } else {
            setPendingDelete(index)
        }
    }

    return (
        <Modal title="Manage Time Slots" icon="schedule" onClose={onClose} wide>
            <div className="tt-form">

                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                    <span className="form-label" style={{ margin: 0 }}>Label</span>
                    <span className="form-label" style={{ margin: 0 }}>Time</span>
                    <span style={{ width: '5rem' }}></span>
                </div>

                {/* One row per period */}
                {periods.map((p, i) => (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                        <input
                            className="form-input"
                            value={p.label}
                            onChange={e => updateRow(i, 'label', e.target.value)}
                            placeholder="e.g. Period 1"
                        />
                        <input
                            className="form-input"
                            value={p.time}
                            onChange={e => updateRow(i, 'time', e.target.value)}
                            placeholder="e.g. 8:00 – 8:40"
                        />
                        {/* Two-step delete: first click arms it, second click confirms */}
                        {pendingDelete === i ? (
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button className="btn btn-outline btn-sm" style={{ color: 'var(--destructive)', borderColor: 'var(--destructive)' }} onClick={() => removeRow(i)}>
                                    Confirm
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={() => setPendingDelete(null)}>
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button className="btn btn-outline btn-sm" onClick={() => removeRow(i)} title="Remove row">
                                <span className="material-symbols-rounded icon-sm">delete</span>
                            </button>
                        )}
                    </div>
                ))}

                {/* Add row + Done actions */}
                <div className="tt-form-actions" style={{ justifyContent: 'space-between' }}>
                    <button className="btn btn-outline btn-sm" onClick={addRow}>
                        <span className="material-symbols-rounded icon-sm">add</span> Add Row
                    </button>
                    <button className="btn btn-primary" onClick={onClose}>
                        <span className="material-symbols-rounded icon-sm">check</span> Done
                    </button>
                </div>

            </div>
        </Modal>
    )
}
