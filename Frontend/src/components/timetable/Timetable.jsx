import { useState, useMemo } from "react"
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { addDays, isSameDay, startOfDay } from 'date-fns'
import { getThisMonday, getTodayDayIndex, getNow } from './dateUtils'
import { DayTabs } from './DaysTabs'
import { TimetableToolbar } from './TimetableToolbar'
import { useStoredState, useCalendarShortcuts } from './calendarControls'
import { TimetableAgenda } from './TimetableAgenda'
import {
    VIEWS, dayIndexOf, mondayOf, snapToVisible, step, visibleDaysFor,
} from './timetableNav'
import { TimetableCell } from './TimetableCell'
import { DraggableCell } from './DraggableCell'
import { assignSubjectTones, homeRoomOf, currentPeriodIndex, shortTeacher } from './timetableDisplay'
import { teacherSlotsToSchedule } from './teacherSchedule'
import { DAYS, DAY_SHORT, EXTRA_SLOTS, extraSchedules } from '../../data/extraTimetable'
import { PERIODS, academicSchedules } from '../../data/academicTimetable'
import '../../styles/timetable.css'

/* The academic grid looks a schedule up by class id. A teacher's week is not
   any one class's, so it is filed under a key no class can collide with. */
const TEACHER_KEY = '__teacher__'

/* How someone likes to look at a timetable is theirs, not the page's: it is
   remembered in this browser and follows them between portals. */
const VIEW_STORE    = 'imboni_tt_view'
const WEEKEND_STORE = 'imboni_tt_weekends'

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
function ExtraTimetable({ weekKey, editable, onEditCell, selectedDay, slots, schedules, todayDayIndex, days, view, monday }) {
    const data     = schedules || extraSchedules
    const schedule = data[weekKey] ?? data['default'] ?? {}

    if (view === 'schedule') {
        return (
            <TimetableAgenda
                rows={slots}
                cellAt={(dayName, _i, slot) => schedule[slot.id]?.[dayName]}
                days={days}
                monday={monday}
                todayDayIndex={todayDayIndex}
                emptyKey="timetable.nothingScheduled"
            />
        )
    }

    return (
        <div className="tt-wrap">
            <table className="tt-table" data-day={selectedDay} data-view={view}>
                <thead>
                    <tr>
                        <th className="tt-time-head" scope="col">Time Slot</th>
                        {days.map(i => (
                            <DayHead key={DAYS[i]} label={DAY_SHORT[i]} colIndex={i + 1} isToday={i === todayDayIndex} />
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {slots.map(slot => (
                        <tr key={slot.id}>
                            <PeriodHead label={slot.label} time={slot.time} />
                            {days.map(i => (
                                <TimetableCell
                                    key={DAYS[i]}
                                    cell={schedule[slot.id]?.[DAYS[i]]}
                                    editable={editable}
                                    onEdit={(cell) => onEditCell({ slot, day: DAYS[i], cell })}
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
function AcademicTimetable({ classId, editable, onEditCell, selectedDay, periods, schedules, todayDayIndex, onMoveSlot, days, view, monday }) {
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

    /* The day columns on screen: Mon–Sat, Mon–Fri with weekends hidden, or the
       one day in Day view. Sunday is never in the academic week. */
    const academicDays = days.map(i => DAYS[i])
    const dragEnabled = typeof onMoveSlot === 'function'

    const homeRoomNote = homeRoom && (
        <p className="tt-meta">
            Home room <strong>{homeRoom}</strong> — only lessons taught elsewhere show a room.
        </p>
    )

    if (view === 'schedule') {
        return (
            <>
                {homeRoomNote}
                <TimetableAgenda
                    rows={periods}
                    cellAt={(dayName, periodIndex) => {
                        const raw = schedule[dayName]?.[periodIndex] ?? null
                        return raw ? { type: raw.type || 'academic', ...raw } : null
                    }}
                    days={days}
                    monday={monday}
                    todayDayIndex={todayDayIndex}
                    nowIndex={nowIndex}
                    tones={tones}
                    homeRoom={homeRoom}
                />
            </>
        )
    }

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
        <table className="tt-table" data-day={selectedDay} data-view={view}>
            <thead>
                <tr>
                    <th className="tt-time-head" scope="col">Period</th>
                    {days.map(i => (
                        <DayHead key={DAYS[i]} label={DAY_SHORT[i]} colIndex={i + 1} isToday={i === todayDayIndex} />
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
                            {cells.map((cell, pos) => {
                                const dayIdx = days[pos]
                                const shared = {
                                    cell,
                                    colIndex: dayIdx + 1,
                                    editable,
                                    tone: cell ? tones.get(cell.subject) : null,
                                    homeRoom,
                                    today: dayIdx === todayDayIndex,
                                    isNow,
                                }
                                const day = academicDays[pos]
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
            {homeRoomNote}
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
    /* The legend explains the activity-type colours, which only the
       extracurricular grid uses. The academic grid — and the teacher's, which
       is the same grid — colours by subject and names it in the cell. */
    if (type !== 'extracurricular') return null
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
     type       'academic' | 'extracurricular' | 'teacher'

     'teacher' renders the academic grid from a teacher's own live timetable
     rows (`teacherSlots`) instead of the static class-keyed data. It is the
     same grid every other portal gets — the teacher's data is simply pivoted
     into the shape it reads. See teacherSchedule.js.
     classId    required for academic
     editable   true = edit buttons visible (DOS, Dis portals)
     onEditCell called with { period/slot, day, cell } on edit click
     periods    optional override for PERIODS rows (DOS passes its own state)
     slots      optional override for EXTRA_SLOTS rows (Dis passes its own state)
     schedules  optional live schedule state from the page; null = use static data
     currentMonday / onWeekChange
                optional controlled week — pages that fetch a week's data own it.
                Every move (arrows, Today, the calendar, a shortcut) that lands
                in another week reports the new Monday through onWeekChange.
     shortcuts  false to switch the D/W/A/T/N/P keys off for this instance

   Views: Day, Week and Schedule (a list), plus Show weekends — the parts of
   Google Calendar's view menu that mean something for a week that repeats.
   Month and Year would show the same week four and fifty-two times over; the
   month calendar behind the date label covers "go to a date" instead.
─────────────────────────────────────────────────────────────────────────── */
export function Timetable({
    type = 'extracurricular',
    classId,
    teacherSlots = null,
    freeLabel    = 'Free',
    editable = false,
    onEditCell,
    periods      = PERIODS,
    slots        = EXTRA_SLOTS,
    schedules    = null,
    weekKey      = 'default',
    onWeekChange = null,
    currentMonday: controlledMonday = null,
    onMoveSlot   = null,
    shortcuts    = true,
}) {
    /* A teacher's rows are pivoted into the academic grid's shape once per
       change, not per render — the tone map and home room downstream are
       memoised on schedule identity, so a fresh object every render would
       recompute the whole week each time. */
    const { periods: teacherPeriods, schedule: teacherSchedule } = useMemo(
        () => teacherSlotsToSchedule(teacherSlots || [], { freeLabel }),
        [teacherSlots, freeLabel],
    )
    const teacherSchedules = useMemo(
        () => ({ [TEACHER_KEY]: teacherSchedule }),
        [teacherSchedule],
    )

    const [view, setView] = useStoredState(VIEW_STORE, 'week', v => VIEWS.includes(v))
    const [showWeekends, setShowWeekends] = useStoredState(WEEKEND_STORE, true, v => typeof v === 'boolean')
    const visibleDays = visibleDaysFor(type, showWeekends)

    const [internalMonday, setInternalMonday] = useState(() => getThisMonday())
    const currentMonday = controlledMonday ?? internalMonday

    /* -1 when not on the current week — disables today highlight */
    const todayDayIndex = getTodayDayIndex(currentMonday)

    /* Opens on today when today is on screen, so Day view starts where you are. */
    const [dayIndex, setDayIndex] = useState(() => {
        const today = getTodayDayIndex(controlledMonday ?? getThisMonday())
        return today >= 0 ? today : 0
    })
    /* Derived, not corrected in an effect: hiding weekends while on Saturday
       shows Friday, and showing them again goes back to Saturday. */
    const selectedDay = visibleDays.includes(dayIndex)
        ? dayIndex
        : (visibleDays.filter(d => d < dayIndex).pop() ?? visibleDays[0])
    const anchor = addDays(currentMonday, selectedDay)
    const now = getNow()

    function handleWeekChange(monday) {
        if (!controlledMonday) setInternalMonday(monday)
        if (onWeekChange) onWeekChange(monday)
    }

    /* The one way the timetable moves. Lands on a day the grid shows, and only
       reports a week change when the week actually changed. */
    function goTo(date) {
        const target = snapToVisible(startOfDay(date), visibleDays, 1)
        const monday = mondayOf(target)
        if (!isSameDay(monday, currentMonday)) handleWeekChange(monday)
        setDayIndex(dayIndexOf(target))
    }

    const move = dir => goTo(step(anchor, view, visibleDays, dir))

    useCalendarShortcuts(shortcuts, {
        d: () => setView('day'),
        w: () => setView('week'),
        a: () => setView('schedule'),
        t: () => goTo(now),
        n: () => move(1),  j: () => move(1),
        p: () => move(-1), k: () => move(-1),
    })

    const days = view === 'day' ? [selectedDay] : visibleDays
    const shared = { days, view, monday: currentMonday, selectedDay, todayDayIndex }

    return (
        <div className="tt-root">
            <TimetableToolbar
                view={view}
                onViewChange={setView}
                showWeekends={showWeekends}
                onShowWeekendsChange={setShowWeekends}
                anchor={anchor}
                visibleDays={visibleDays}
                now={now}
                onStep={move}
                onToday={() => goTo(now)}
                onPick={goTo}
            >
                <TimetableLegend type={type} />
            </TimetableToolbar>

            {/* Phones show one day column of the week at a time; these pick it.
               Not needed in Day view (it is already one day) or the list. */}
            {view === 'week' && (
                <DayTabs
                    selected={selectedDay}
                    onChange={setDayIndex}
                    indices={visibleDays}
                />
            )}

            {type === 'teacher' && teacherPeriods.length === 0 ? (
                <p className="tt-note">No lessons scheduled for this term yet.</p>
            ) : type === 'teacher' ? (
                <AcademicTimetable
                    {...shared}
                    classId={TEACHER_KEY}
                    editable={false}
                    onEditCell={() => {}}
                    periods={teacherPeriods}
                    schedules={teacherSchedules}
                    onMoveSlot={null}
                />
            ) : type === 'extracurricular' ? (
                <ExtraTimetable
                    {...shared}
                    weekKey={weekKey}
                    editable={editable}
                    onEditCell={onEditCell}
                    slots={slots}
                    schedules={schedules}
                />
            ) : (
                <AcademicTimetable
                    {...shared}
                    classId={classId}
                    editable={editable}
                    onEditCell={onEditCell}
                    periods={periods}
                    schedules={schedules}
                    onMoveSlot={onMoveSlot}
                />
            )}
        </div>
    )
}
