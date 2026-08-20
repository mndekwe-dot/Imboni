import { shortTeacher } from './timetableDisplay'

/**
 * TimetableCell — renders a single <td> inside the timetable grid.
 *
 * Handles four cell states in order:
 *   1. null / undefined  → empty dash (no data at all)
 *   2. type === 'empty'  → labelled empty slot (e.g. "Free Period")
 *   3. type === 'break'  → break row (e.g. morning tea, lunch)
 *   4. normal lesson     → shows subject, optional teacher & room, optional edit button
 *
 * The tt-col-{colIndex} class lets CSS show/hide columns on mobile
 * based on the selected day tab (data-day attribute on the table).
 *
 * Props:
 *   cell      {object|null}  Cell data from timetable data array
 *   editable  {boolean}      True for Discipline Master, Admin, DOS portals
 *   onEdit    {function}     Called with the cell object when edit button is clicked
 *   colIndex  {number}       Day column index (0 = Mon) used for mobile CSS targeting
 *   tone      {number|null}  Subject colour band 1..N (academic only — the
 *                            extracurricular grid colours by activity type
 *                            instead, and has a legend explaining it)
 *   homeRoom  {string|null}  The class's usual room; matching rooms are hidden
 *                            so only the exceptions (labs, halls) show
 *   today     {boolean}      This column is today — tints the column through
 *   isNow     {boolean}      This row is the period running right now
 */
export function TimetableCell({ cell, editable, onEdit, colIndex, tone, homeRoom, today, isNow }) {

    /* Classes shared by every state so today/now emphasis reaches all of them. */
    const stateClass = `tt-col-${colIndex}${today ? ' tt-today-col' : ''}${isNow ? ' tt-now-row' : ''}`

    /* No data — render an empty dash placeholder */
    if (!cell) {
        return <td className={`tt-cell tt-empty ${stateClass}`}>{'-'}</td>
    }

    /* Explicitly empty slot (e.g. free period with optional label) */
    if (cell.type === 'empty') {
        return <td className={`tt-cell tt-empty ${stateClass}`}>{cell.label || '-'}</td>
    }

    /* Break row — matches either by type field or legacy subject string */
    if (cell.type === 'break' || cell.subject === 'Break') {
        return <td className={`tt-cell tt-break ${stateClass}`}>Break</td>
    }

    /* A tone means "colour this by subject" — the academic grid. Without one the
       cell keeps its activity-type colour, which the extracurricular legend explains. */
    const toneClass = tone ? ` tt-lesson tt-tone-${tone}` : ''

    /* Only show a room that differs from the class's usual one. */
    const room = cell.room && cell.room !== homeRoom ? cell.room : null

    return (
        <td className={`tt-cell tt-${cell.type} ${stateClass}${toneClass}`}>

            {/* Subject name — always shown */}
            <div className="tt-subject" title={cell.subject}>
                {cell.subject}
            </div>

            {/* Teacher and room share one line: the teacher truncates, the room
                is short and never should. Skipped entirely when both are absent,
                which keeps a bare cell to a single line. */}
            {(cell.teacher || room) && (
                <div className="tt-cell-meta">
                    {cell.teacher &&
                        <span className="tt-teacher" title={cell.teacher}>
                            {shortTeacher(cell.teacher)}
                        </span>
                    }
                    {room && <span className="tt-room">{room}</span>}
                </div>
            )}

            {/* Edit button — only shown in editable portals (Admin, DOS, Disc. Master) */}
            {editable && (
                <button
                    className="tt-cell-edit-btn"
                    title={`Edit ${cell.subject}`}
                    aria-label={`Edit ${cell.subject}`}
                    onClick={() => onEdit(cell)}
                >
                    <span className="material-symbols-rounded tt-icon-xs">
                        edit
                    </span>
                </button>
            )}

        </td>
    )
}
