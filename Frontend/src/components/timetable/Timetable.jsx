import { useState, useMemo } from "react"
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { WeekPicker } from './weekPicker'
import { getThisMonday, getTodayDayIndex, getNow } from './dateUtils'
import { DayTabs } from './DaysTabs'
import { TimetableCell } from './TimetableCell'
import { DraggableCell } from './DraggableCell'
import { assignSubjectTones, homeRoomOf, currentPeriodIndex, shortTeacher } from './timetableDisplay'
import { DAYS, DAY_SHORT, EXTRA_SLOTS, extraSchedules } from '../../data/extraTimetable'
import { PERIODS, academicSchedules } from '../../data/academicTimetable'
import '../../styles/timetable.css'

/* A day column heading. Today is filled with the portal accent, and carries a
   dot + screen-reader text as well, so the state is not signalled by colour alone. */
function DayHead({ label, colIndex, isToday }) {
    return (
        <th
            className={`tt-day-head tt-col-${colIndex}${isToday ? ' tt-today' : ''}`}
            scope="col"
            aria-current={isToday ? 'date' : undefined}
        >
            {label}
            {isToday && <><span className="tt-today-dot" aria-hidden="true" /><span className="sr-only"> (today)</span></>}
        </th>
    )
}

/* The row label: the time is what people look up, so it leads; "Period 4" is
   already implied by the row's position and follows as the smaller line. */
function PeriodHead({ label, time, isNow }) {
    return (
        <th className={`tt-time-cell${isNow ? ' tt-now-row' : ''}`} scope="row">
            <strong>{time}</strong>
            <span>{label}</span>
            {isNow && <span className="tt-now-tag">Now</span>}
        </th>
    )
}

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
                        <th className="tt-time-head" scope="col">Time Slot</th>
                        {DAYS.map((day, i) => (
                            <DayHead key={day} label={DAY_SHORT[i]} colIndex={i + 1} isToday={i === todayDayIndex} />
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {slots.map(slot => (
                        <tr key={slot.id}>
                            <PeriodHead label={slot.label} time={slot.time} />
                            {DAYS.map((day, i) => (
                                <TimetableCell
                                    key={day}
                                    cell={schedule[slot.id]?.[day]}
                                    editable={editable}
                                    onEdit={(cell) => onEditCell({ slot, day, cell })}
                                    colIndex={i + 1}
                                    today={i === todayDayIndex}
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

    /* Subject → colour band, and the room the class normally sits in. Both are
       derived from the whole week, so they must not be recomputed per cell. */
    const tones = useMemo(
        () => assignSubjectTones(
            Object.values(schedule || {}).flat().map(c => c && c.type !== 'break' ? c.subject : null),
        ),
        [schedule],
    )
    const homeRoom = useMemo(() => homeRoomOf(schedule), [schedule])

    /* The period running right now — only meaningful while looking at today. */
    const now = getNow()
    const nowIndex = todayDayIndex >= 0
        ? currentPeriodIndex(periods, now.getHours() * 60 + now.getMinutes())
        : -1

    if (!schedule) {
        return <p className="tt-note">No timetable found for {classId}.</p>
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
                    <th className="tt-time-head" scope="col">Period</th>
                    {academicDays.map((day, i) => (
                        <DayHead key={day} label={academicDayShort[i]} colIndex={i + 1} isToday={i === todayDayIndex} />
                    ))}
                </tr>
            </thead>
            <tbody>
                {periods.map((period, periodIndex) => {
                    const cells = academicDays.map(day => {
                        const raw = schedule[day]?.[periodIndex] ?? null
                        return raw ? { type: raw.type || 'academic', ...raw } : null
                    })
                    const isNow = periodIndex === nowIndex

                    /* A break is one band across the whole day, not six identical
                       cells each repeating the word. Detected from the data rather
                       than the period id, so a DOS-edited period list still works. */
                    if (cells.length && cells.every(c => c && c.type === 'break')) {
                        return (
                            <tr key={period.id} className="tt-break-band">
                                {/* No label here — the band alongside already says BREAK,
                                    and a second line would set the row's height. */}
                                <PeriodHead time={period.time} isNow={isNow} />
                                <td className="tt-cell tt-break" colSpan={academicDays.length}>
                                    {period.label || 'Break'}
                                </td>
                            </tr>
                        )
                    }

                    return (
                        <tr key={period.id}>
                            <PeriodHead label={period.label} time={period.time} isNow={isNow} />
                            {cells.map((cell, i) => {
                                const shared = {
                                    cell,
                                    colIndex: i + 1,
                                    editable,
                                    tone: cell ? tones.get(cell.subject) : null,
                                    homeRoom,
                                    today: i === todayDayIndex,
                                    isNow,
                                }
                                const day = academicDays[i]
                                if (dragEnabled) {
                                    return (
                                        <DraggableCell
                                            key={day} {...shared}
                                            day={day}
                                            periodIndex={periodIndex}
                                            onEdit={(c) => onEditCell({ period, day, cell: c })}
                                        />
                                    )
                                }
                                return (
                                    <TimetableCell
                                        key={day} {...shared}
                                        onEdit={(c) => onEditCell({ period, day, cell: c })}
                                    />
                                )
                            })}
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )

    return (
        <>
            {homeRoom && (
                <p className="tt-meta">
                    Home room <strong>{homeRoom}</strong> — only lessons taught elsewhere show a room.
                </p>
            )}
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
                                        {activeCell.teacher && <div className="tt-teacher">{shortTeacher(activeCell.teacher)}</div>}
                                        {activeCell.room && <div className="tt-room">{activeCell.room}</div>}
                                    </div>
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    )
                    : table}
            </div>
        </>
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
            <div className="tt-legend-row">
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
