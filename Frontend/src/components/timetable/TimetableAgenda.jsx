import { addDays } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { formatDateWithWeekday } from '../../utils/date'
import { DAYS } from '../../data/extraTimetable'
import { shortTeacher } from './timetableDisplay'

/**
 * Schedule view — the week as a list, one day after another.
 *
 * The grid is the right shape for "what is my Tuesday like next to my
 * Wednesday", and the wrong one for "what have I got, in order": on a phone
 * it is one squeezed column at a time. This reads top to bottom, drops the
 * empty and free slots that pad a grid, and keeps breaks as a thin line so the
 * shape of the day is still visible.
 *
 * Props:
 *   rows          [{ id, label, time }]  periods (academic) or slots (boarding)
 *   cellAt        (dayName, rowIndex, row) => cell | null
 *   days          day indices to list (0 = Mon)
 *   monday        Date — start of the week shown
 *   todayDayIndex index of today in this week, or -1
 *   nowIndex      row running right now (only meaningful today), or -1
 *   tones         Map subject -> tone number, or null (boarding colours by type)
 *   homeRoom      the class's usual room, hidden like the grid hides it
 *   emptyKey      translation key for a day with nothing on it
 */
export function TimetableAgenda({
    rows, cellAt, days, monday, todayDayIndex, nowIndex = -1, tones = null, homeRoom = null,
    emptyKey = 'timetable.noLessons',
}) {
    const { t } = useTranslation()

    return (
        <div className="tt-agenda">
            {days.map(dayIdx => {
                const dayName = DAYS[dayIdx]
                const isToday = dayIdx === todayDayIndex
                const items = rows
                    .map((row, i) => ({ row, i, cell: cellAt(dayName, i, row) }))
                    .filter(({ cell }) => cell && cell.type !== 'empty')

                const lessons = items.filter(({ cell }) => !isBreak(cell))

                return (
                    <section key={dayName} className={`tt-agenda-day${isToday ? ' is-today' : ''}`}
                        aria-current={isToday ? 'date' : undefined}>
                        <h4 className="tt-agenda-date">
                            {formatDateWithWeekday(addDays(monday, dayIdx))}
                            {isToday && <span className="tt-agenda-today">{t('common.today')}</span>}
                        </h4>

                        {lessons.length === 0 ? (
                            <p className="tt-agenda-empty">{t(emptyKey)}</p>
                        ) : (
                            <ol className="tt-agenda-list">
                                {items.map(({ row, i, cell }) => {
                                    const now = isToday && i === nowIndex
                                    if (isBreak(cell)) {
                                        return (
                                            <li key={row.id} className="tt-agenda-break">
                                                <span className="tt-agenda-time">{row.time}</span>
                                                <span>{row.label || t('timetable.break')}</span>
                                            </li>
                                        )
                                    }
                                    const tone = tones?.get(cell.subject)
                                    const room = cell.room && cell.room !== homeRoom ? cell.room : null
                                    const who  = cell.meta ?? (cell.teacher ? shortTeacher(cell.teacher) : '')
                                    return (
                                        <li key={row.id}
                                            className={`tt-agenda-item ${tone ? `tt-agenda-toned tt-tone-${tone}` : `tt-${cell.type}`}${now ? ' is-now' : ''}`}>
                                            <span className="tt-agenda-time">{row.time}</span>
                                            <span className="tt-agenda-body">
                                                <span className="tt-agenda-subject">{cell.subject}</span>
                                                {(who || room) && (
                                                    <span className="tt-agenda-meta">
                                                        {[who, room].filter(Boolean).join(' · ')}
                                                    </span>
                                                )}
                                            </span>
                                            {now && <span className="tt-now-tag">{t('timetable.now')}</span>}
                                        </li>
                                    )
                                })}
                            </ol>
                        )}
                    </section>
                )
            })}
        </div>
    )
}

const isBreak = cell => cell.type === 'break' || cell.subject === 'Break'
