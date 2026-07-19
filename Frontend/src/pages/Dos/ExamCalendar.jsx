import { useState, useMemo } from 'react'

/*
  Drag-and-drop exam rescheduling.

  Rows are dates (every day between the first and last exam, so an exam can be
  moved onto a currently-empty day); columns are the distinct time slots already
  in use. Dragging a card onto a cell PATCHes its date/time via `onReschedule`.

  The class-clash rule from the generator is enforced here too: a class cannot
  sit two exams at once, so dropping onto a cell that already holds an exam for
  the same class is refused rather than silently creating a conflict.

  This is a pointer-only enhancement; the table view remains the accessible way
  to edit an exam.
*/

const MAX_DAYS = 45   // guard against a stray far-future date exploding the grid

function toKey(date, start) { return `${date}|${start}` }

/* All date maths is done in UTC. Parsing "2026-08-10T00:00:00" gives *local*
   midnight, and toISOString() then converts to UTC — which rolls the date back
   a day everywhere east of Greenwich (Rwanda is UTC+2). Keeping everything on
   Date.UTC makes the grid line up with the plain YYYY-MM-DD keys we compare. */

function parseUTC(iso) {
    const [y, m, d] = String(iso).split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(Date.UTC(y, m - 1, d))
}

function formatDayLabel(iso) {
    const d = parseUTC(iso)
    if (!d) return iso
    return d.toLocaleDateString(undefined, {
        weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    })
}

function addDays(iso, n) {
    const d = parseUTC(iso)
    if (!d) return iso
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString().slice(0, 10)
}

function daysBetween(fromIso, toIso) {
    const a = parseUTC(fromIso)
    const b = parseUTC(toIso)
    if (!a || !b) return 0
    return Math.round((b - a) / 86400000)
}

export function ExamCalendar({ exams, onReschedule }) {
    const [dragId, setDragId] = useState(null)
    const [overCell, setOverCell] = useState(null)
    const [notice, setNotice] = useState('')

    const { dates, slots, cells } = useMemo(() => {
        const dated = exams.filter(e => e.exam_date && e.start_time)
        if (dated.length === 0) return { dates: [], slots: [], cells: {} }

        const allDates = dated.map(e => e.exam_date).sort()
        const first = allDates[0]
        const last = allDates[allDates.length - 1]
        const span = daysBetween(first, last)
        const dayCount = Math.min(Math.max(span, 0), MAX_DAYS - 1)
        const dateRows = Array.from({ length: dayCount + 1 }, (_, i) => addDays(first, i))

        // Distinct time slots, chronological.
        const slotMap = new Map()
        for (const e of dated) {
            if (!slotMap.has(e.start_time)) {
                slotMap.set(e.start_time, { start: e.start_time, end: e.end_time })
            }
        }
        const slotList = [...slotMap.values()].sort((a, b) => a.start.localeCompare(b.start))

        const cellMap = {}
        for (const e of dated) {
            const k = toKey(e.exam_date, e.start_time)
            ;(cellMap[k] = cellMap[k] || []).push(e)
        }
        return { dates: dateRows, slots: slotList, cells: cellMap }
    }, [exams])

    if (dates.length === 0) {
        return <p className="u-muted u-sm">No dated exams to lay out yet.</p>
    }

    function handleDrop(date, slot) {
        setOverCell(null)
        const exam = exams.find(e => String(e.id) === String(dragId))
        setDragId(null)
        if (!exam) return
        if (exam.exam_date === date && exam.start_time === slot.start) return   // no move

        // Same-class clash guard (the generator's hard constraint).
        const occupants = cells[toKey(date, slot.start)] || []
        const clash = occupants.find(
            o => o.class_id && exam.class_id && String(o.class_id) === String(exam.class_id),
        )
        if (clash) {
            setNotice(`${exam.class_name || 'That class'} already sits ${clash.subject} in this slot.`)
            return
        }

        setNotice('')
        onReschedule(exam.id, {
            exam_date: date,
            start_time: slot.start,
            end_time: slot.end,
        })
    }

    return (
        <>
            <p className="u-muted u-sm mb-1">
                Drag an exam onto another day or time slot to reschedule it.
            </p>
            {notice && <p className="u-danger u-fs-085 mb-1" role="status">{notice}</p>}

            <div className="es-table-wrap">
                <table className="es-table exam-cal">
                    <thead>
                        <tr>
                            <th>Day</th>
                            {slots.map(s => (
                                <th key={s.start} className="es-nowrap">
                                    {s.start?.slice(0, 5)}-{s.end?.slice(0, 5)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {dates.map(date => (
                            <tr key={date}>
                                <td className="es-nowrap exam-cal-day">{formatDayLabel(date)}</td>
                                {slots.map(slot => {
                                    const key = toKey(date, slot.start)
                                    const occupants = cells[key] || []
                                    const isOver = overCell === key
                                    return (
                                        <td
                                            key={slot.start}
                                            className={`exam-cal-cell${isOver ? ' is-over' : ''}`}
                                            onDragOver={e => { e.preventDefault(); setOverCell(key) }}
                                            onDragLeave={() => setOverCell(c => (c === key ? null : c))}
                                            onDrop={() => handleDrop(date, slot)}
                                        >
                                            {occupants.map(e => (
                                                <div
                                                    key={e.id}
                                                    className={`exam-cal-card${String(e.id) === String(dragId) ? ' is-dragging' : ''}`}
                                                    draggable
                                                    onDragStart={() => { setDragId(e.id); setNotice('') }}
                                                    onDragEnd={() => { setDragId(null); setOverCell(null) }}
                                                    title={`${e.subject} (${e.class_name || 'All classes'})`}
                                                >
                                                    <span className="exam-cal-subject">{e.subject}</span>
                                                    {e.class_name && (
                                                        <span className="exam-cal-class">{e.class_name}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    )
}
