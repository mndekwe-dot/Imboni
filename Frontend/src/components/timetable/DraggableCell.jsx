import { useDraggable, useDroppable } from '@dnd-kit/core'

/**
 * DraggableCell — an academic timetable <td> that can be dragged (when it holds
 * a lesson) or dropped onto (when it's empty). Used only by the DOS academic
 * grid when drag-to-move is enabled; every other timetable keeps TimetableCell.
 *
 * A filled cell is a drag source; an empty cell is a drop target. Dropping a
 * lesson on an empty cell moves it there (the page then PATCHes the slot's
 * day/time, which runs the same teacher/room conflict check as manual edits).
 */
export function DraggableCell({ cell, day, periodIndex, colIndex, editable, onEdit }) {
    const filled = !!(cell && cell._id)

    // Both hooks run every render (stable order); `disabled` picks the role.
    const drag = useDraggable({
        id: `drag-${day}-${periodIndex}`,
        data: { cell, day, periodIndex },
        disabled: !filled,
    })
    const drop = useDroppable({
        id: `drop-${day}-${periodIndex}`,
        data: { day, periodIndex },
        disabled: filled,
    })

    const setRef = (node) => { drag.setNodeRef(node); drop.setNodeRef(node) }

    if (!filled) {
        return (
            <td
                ref={setRef}
                className={`tt-cell tt-empty tt-col-${colIndex}${drop.isOver ? ' tt-drop-over' : ''}`}
            >
                {cell?.label || '—'}
            </td>
        )
    }

    // No transform on the <td> itself — table cells don't move reliably. A
    // DragOverlay (in AcademicTimetable) renders the floating copy that follows
    // the cursor; the source cell just dims via .tt-dragging.
    return (
        <td
            ref={setRef}
            className={`tt-cell tt-${cell.type || 'academic'} tt-col-${colIndex} tt-draggable${drag.isDragging ? ' tt-dragging' : ''}`}
            {...drag.attributes}
            {...drag.listeners}
        >
            <div className="tt-subject">{cell.subject}</div>
            {cell.teacher && <div className="tt-teacher">{cell.teacher}</div>}
            {cell.room && <div className="tt-room">{cell.room}</div>}
            {editable && (
                <button
                    className="tt-cell-edit-btn"
                    // Stop the pointerdown from starting a drag so the edit
                    // button stays clickable inside a draggable cell.
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => onEdit(cell)}
                >
                    <span className="material-symbols-rounded" style={{ fontSize: '0.7rem' }}>edit</span>
                </button>
            )}
        </td>
    )
}
