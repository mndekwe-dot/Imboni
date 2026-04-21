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
 */
export function TimetableCell({ cell, editable, onEdit, colIndex }) {

    /* No data — render an empty dash placeholder */
    if (!cell) {
        return <td className={`tt-cell tt-empty tt-col-${colIndex}`}>&mdash;</td>
    }

    /* Explicitly empty slot (e.g. free period with optional label) */
    if (cell.type === 'empty') {
        return <td className={`tt-cell tt-empty tt-col-${colIndex}`}>{cell.label || '—'}</td>
    }

    /* Break row — matches either by type field or legacy subject string */
    if (cell.type === 'break' || cell.subject === 'Break') {
        return <td className={`tt-cell tt-break tt-col-${colIndex}`}>Break</td>
    }

    /* Normal lesson cell */
    return (
        <td className={`tt-cell tt-${cell.type} tt-col-${colIndex}`}>

            {/* Subject name — always shown */}
            <div className="tt-subject">
                {cell.subject}
            </div>

            {/* Teacher name — only shown when present (extracurricular may omit) */}
            {cell.teacher &&
                <div className="tt-teacher">
                    {cell.teacher}
                </div>
            }

            {/* Room / venue — only shown when present */}
            {cell.room &&
                <div className="tt-room">
                    {cell.room}
                </div>
            }

            {/* Edit button — only shown in editable portals (Admin, DOS, Disc. Master) */}
            {editable && (
                <button
                    className="tt-cell-edit-btn"
                    onClick={() => onEdit(cell)}
                >
                    <span
                        className="material-symbols-rounded"
                        style={{ fontSize: '0.7rem' }}>
                        edit
                    </span>
                </button>
            )}

        </td>
    )
}
