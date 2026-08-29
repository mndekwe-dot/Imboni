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
                <div className="tt-period-row">
                    <span className="form-label">Label</span>
                    <span className="form-label">Time</span>
                    <span className="tt-period-spacer"></span>
                </div>

                {/* One row per period */}
                {periods.map((p, i) => (
                    <div key={p.id} className="tt-period-row">
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
                            placeholder="e.g. 8:00 - 8:40"
                        />
                        {/* Two-step delete: first click arms it, second click confirms */}
                        {pendingDelete === i ? (
                            <div className="tt-period-confirm">
                                <button className="btn btn-outline btn-sm tt-btn-danger" onClick={() => removeRow(i)}>
                                    Confirm
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={() => setPendingDelete(null)}>
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button className="btn btn-outline btn-sm" onClick={() => removeRow(i)} title="Remove row">
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">delete</span>
                            </button>
                        )}
                    </div>
                ))}

                {/* Add row + Done actions */}
                <div className="tt-form-actions tt-form-actions--split">
                    <button className="btn btn-outline btn-sm" onClick={addRow}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span> Add Row
                    </button>
                    <button className="btn btn-primary" onClick={onClose}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">check</span> Done
                    </button>
                </div>

            </div>
        </Modal>
    )
}
