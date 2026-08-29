import { useDraggable, useDroppable } from '@dnd-kit/core'
import { shortTeacher } from './timetableDisplay'

/**
 * DraggableCell — an academic timetable <td> that can be dragged (when it holds
 * a lesson) or dropped onto (when it's empty). Used only by the DOS academic
 * grid when drag-to-move is enabled; every other timetable keeps TimetableCell.
 *
 * A filled cell is a drag source; an empty cell is a drop target. Dropping a
 * lesson on an empty cell moves it there (the page then PATCHes the slot's
 * day/time, which runs the same teacher/room conflict check as manual edits).
 *
 * Presentation (subject tone, room suppression, today/now emphasis) mirrors
 * TimetableCell — the two must stay visually identical, since the same grid
 * switches between them depending on whether drag is enabled.
 */
export function DraggableCell({ cell, day, periodIndex, colIndex, editable, onEdit, tone, homeRoom, today, isNow }) {
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
    const stateClass = `tt-col-${colIndex}${today ? ' tt-today-col' : ''}${isNow ? ' tt-now-row' : ''}`

    if (!filled) {
        return (
            <td
                ref={setRef}
                className={`tt-cell tt-empty ${stateClass}${drop.isOver ? ' tt-drop-over' : ''}`}
            >
                {cell?.label || '-'}
            </td>
        )
    }

    const toneClass = tone ? ` tt-lesson tt-tone-${tone}` : ''
    const room = cell.room && cell.room !== homeRoom ? cell.room : null

    // The drag activator is an explicit grip handle, NOT the whole cell — so
    // grabbing the text can't start a text-selection instead of a drag, and the
    // draggable affordance is visible. The <td> is still the draggable node
    // (for measurement); only the handle carries the pointer listeners.
    return (
        <td
            ref={setRef}
            className={`tt-cell tt-${cell.type || 'academic'} ${stateClass} tt-draggable${toneClass}${drag.isDragging ? ' tt-dragging' : ''}`}
        >
            <button
                type="button"
                ref={drag.setActivatorNodeRef}
                className="tt-drag-handle"
                title="Drag to move this lesson"
                aria-label="Drag to move this lesson"
                {...drag.attributes}
                {...drag.listeners}
            >
                <span className="material-symbols-rounded" aria-hidden="true">drag_indicator</span>
            </button>

            <div className="tt-subject" title={cell.subject}>{cell.subject}</div>
            {(cell.teacher || room) && (
                <div className="tt-cell-meta">
                    {cell.teacher &&
                        <span className="tt-teacher" title={cell.teacher}>{shortTeacher(cell.teacher)}</span>}
                    {room && <span className="tt-room">{room}</span>}
                </div>
            )}
            {editable && (
                <button
                    className="tt-cell-edit-btn"
                    title={`Edit ${cell.subject}`}
                    aria-label={`Edit ${cell.subject}`}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => onEdit(cell)}
                >
                    <span className="material-symbols-rounded tt-icon-xs" aria-hidden="true">edit</span>
                </button>
            )}
        </td>
    )
}
