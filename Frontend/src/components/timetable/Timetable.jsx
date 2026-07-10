import { useState } from "react"
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { WeekPicker } from './weekPicker'
import { getThisMonday, getTodayDayIndex } from './dateUtils'
import { DayTabs } from './DaysTabs'
import { TimetableCell } from './TimetableCell'
import { DraggableCell } from './DraggableCell'
import { DAYS, DAY_SHORT, EXTRA_SLOTS, extraSchedules } from '../../data/extraTimetable'
import { PERIODS, academicSchedules } from '../../data/academicTimetable'
import '../../styles/timetable.css'

/* ─── Extracurricular table ─────────────────────────────────────────────────
   slots     — current EXTRA_SLOTS (may be edited by Dis portal)
   schedules — live extracurricular schedule state from the page (or null → uses
               the static import as fallback)
   todayDayIndex — DAYS index of today (0=Mon…6=Sun), or -1 if not current week
─────────────────────────────────────────────────────────────────────────── */
function ExtraTimetable({ weekKey, editable, onEditCell, selectedDay, slots, schedules, todayDayIndex }) {
    const data     = schedules || extraSchedules
    const schedule = data[weekKey] ?? data['default'] ?? {}
    return (
        <div className="tt-wrap">
            <table className="tt-table" data-day={selectedDay}>
                <thead>
                    <tr>
                        <th className="tt-time-head">Time Slot</th>
                        {DAYS.map((day, i) => (
                            <th
                                key={day}
                                className={`tt-day-head tt-col-${i + 1}${i === todayDayIndex ? ' tt-today' : ''}`}
                            >
                                {DAY_SHORT[i]}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {slots.map(slot => (
                        <tr key={slot.id}>
                            <td className="tt-time-cell">
                                <strong>{slot.label}</strong>
                                <span>{slot.time}</span>
                            </td>
                            {DAYS.map((day, i) => (
                                <TimetableCell
                                    key={day}
                                    cell={schedule[slot.id]?.[day]}
                                    editable={editable}
                                    onEdit={(cell) => onEditCell({ slot, day, cell })}
                                    colIndex={i + 1}
                                />
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/* ─── Academic table ────────────────────────────────────────────────────────
   periods   — current PERIODS array (may be edited by DOS portal)
   schedules — live academic schedule state from the page (or null → uses
               the static import as fallback)
   todayDayIndex — DAYS index of today, or -1 if not current week
─────────────────────────────────────────────────────────────────────────── */
function AcademicTimetable({ classId, editable, onEditCell, selectedDay, periods, schedules, todayDayIndex, onMoveSlot }) {
    // A small drag threshold so a click on a cell/edit button never starts a drag.
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
    const [activeCell, setActiveCell] = useState(null)   // lesson being dragged (for the overlay)
    const schedule = (schedules || academicSchedules)[classId]

    if (!schedule) {
        return <p style={{ color: 'var(--muted-foreground)', padding: '1rem' }}>No timetable found for {classId}.</p>
    }

    /* Mon–Sat only — Sunday excluded from academic schedule */
    const academicDays     = DAYS.slice(0, 6)
    const academicDayShort = DAY_SHORT.slice(0, 6)
    const dragEnabled = typeof onMoveSlot === 'function'

    function handleDragStart(event) {
        setActiveCell(event.active.data.current?.cell ?? null)
    }

    function handleDragEnd(event) {
        setActiveCell(null)
        const { active, over } = event
        if (!over) return
        const from = active.data.current   // { cell, day, periodIndex }
        const to   = over.data.current     // { day, periodIndex }
        if (!from || !to) return
        if (from.day === to.day && from.periodIndex === to.periodIndex) return
        onMoveSlot({
            cell: from.cell,
            fromDay: from.day, fromPeriodIndex: from.periodIndex,
            toDay: to.day, toPeriodIndex: to.periodIndex,
        })
    }

    const table = (
        <table className="tt-table" data-day={selectedDay}>
            <thead>
                <tr>
                    <th className="tt-time-head">Period</th>
                    {academicDays.map((day, i) => (
                        <th
                            key={day}
                            className={`tt-day-head tt-col-${i + 1}${i === todayDayIndex ? ' tt-today' : ''}`}
                        >
                            {academicDayShort[i]}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {periods.map((period, periodIndex) => (
                    <tr key={period.id}>
                        <td className="tt-time-cell">
                            <strong>{period.label}</strong>
                            <span>{period.time}</span>
                        </td>
                        {academicDays.map((day, i) => {
                            const raw = schedule[day]?.[periodIndex] ?? null
                            const cell = raw ? { type: raw.type || 'academic', ...raw } : null
                            if (dragEnabled) {
                                return (
                                    <DraggableCell
                                        key={day}
                                        cell={cell}
                                        day={day}
                                        periodIndex={periodIndex}
                                        colIndex={i + 1}
                                        editable={editable}
                                        onEdit={(c) => onEditCell({ period, day, cell: c })}
                                    />
                                )
                            }
                            return (
                                <TimetableCell
                                    key={day}
                                    cell={cell}
                                    editable={editable}
                                    onEdit={(c) => onEditCell({ period, day, cell: c })}
                                    colIndex={i + 1}
                                />
                            )
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    )

    return (
        <div className="tt-wrap">
            {dragEnabled
                ? (
                    <DndContext
                        sensors={sensors}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragCancel={() => setActiveCell(null)}
                    >
                        {table}
                        <DragOverlay>
                            {activeCell ? (
                                <div className="tt-drag-overlay">
                                    <div className="tt-subject">{activeCell.subject}</div>
                                    {activeCell.teacher && <div className="tt-teacher">{activeCell.teacher}</div>}
                                    {activeCell.room && <div className="tt-room">{activeCell.room}</div>}
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                )
                : table}
        </div>
    )
}

/* ─── Legend (extracurricular only) ─────────────────────────────────────── */
function TimetableLegend({ type }) {
    if (type === 'academic') return null
    return (
        <div className="tt-legend">
            <span className="tt-legend-item tt-sport">Sports</span>
            <span className="tt-legend-item tt-arts">Arts</span>
            <span className="tt-legend-item tt-academic">Academic Clubs</span>
            <span className="tt-legend-item tt-social">Boarding</span>
            <span className="tt-legend-item tt-dining">Dining</span>
        </div>
    )
}

/* ─── Main Timetable component ──────────────────────────────────────────────
   Props:
     type       'academic' | 'extracurricular'
     classId    required for academic
     editable   true = edit buttons visible (DOS, Dis portals)
     onEditCell called with { period/slot, day, cell } on edit click
     periods    optional override for PERIODS rows (DOS passes its own state)
     slots      optional override for EXTRA_SLOTS rows (Dis passes its own state)
     schedules  optional live schedule state from the page; null = use static data
─────────────────────────────────────────────────────────────────────────── */
export function Timetable({
    type = 'extracurricular',
    classId,
    editable = false,
    onEditCell,
    periods      = PERIODS,
    slots        = EXTRA_SLOTS,
    schedules    = null,
    weekKey      = 'default',
    onWeekChange = null,
    currentMonday: controlledMonday = null,
    onMoveSlot   = null,
}) {
    const [internalMonday, setInternalMonday] = useState(() => getThisMonday())
    const currentMonday = controlledMonday ?? internalMonday
    const [selectedDay, setSelectedDay] = useState(0)

    /* -1 when not on the current week — disables today highlight */
    const todayDayIndex = getTodayDayIndex(currentMonday)

    function handleWeekChange(monday) {
        if (!controlledMonday) setInternalMonday(monday)
        if (onWeekChange) onWeekChange(monday)
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <WeekPicker currentMonday={currentMonday} onChange={handleWeekChange} />
                <TimetableLegend type={type} />
            </div>

            <DayTabs selected={selectedDay} onChange={setSelectedDay} />

            {type === 'extracurricular' ? (
                <ExtraTimetable
                    weekKey={weekKey}
                    editable={editable}
                    onEditCell={onEditCell}
                    selectedDay={selectedDay}
                    slots={slots}
                    schedules={schedules}
                    todayDayIndex={todayDayIndex}
                />
            ) : (
                <AcademicTimetable
                    classId={classId}
                    editable={editable}
                    onEditCell={onEditCell}
                    selectedDay={selectedDay}
                    periods={periods}
                    schedules={schedules}
                    todayDayIndex={todayDayIndex}
                    onMoveSlot={onMoveSlot}
                />
            )}
        </div>
    )
}
