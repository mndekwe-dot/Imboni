import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
    addDays, eachDayOfInterval, endOfMonth, format, isAfter, isSameDay, isSameMonth,
    startOfDay, startOfMonth,
} from 'date-fns'
import { StatCard } from '../layout/StatCard'
import { TimetableToolbar } from '../timetable/TimetableToolbar'
import { getNow } from '../timetable/dateUtils'
import { mondayOf, dayIndexOf, snapToVisible, step } from '../timetable/timetableNav'
import { useCalendarShortcuts, useStoredState } from '../timetable/calendarControls'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate, formatWeekday, weekdayShortNames } from '../../utils/date'
import '../../styles/timetable.css'

/**
 * One person's attendance: the term figures, then a week or a month of days,
 * then the records behind whatever is on screen.
 *
 * The student and parent portals each drew their own month grid - different
 * markup, different colours, a Sunday-first week, cells the width of the page
 * and just as tall. The parent copy also painted today "present" before any
 * register was taken. Both pages render this now.
 *
 * Moves like the timetable, with the same toolbar and keys (T, P/N, W/M),
 * so learning one teaches the other.
 *
 * Props:
 *   stats       term figures from the attendance stats endpoint, or null
 *   loading     true while those figures are on their way
 *   loadMonth   (year, month1to12) => Promise<records[]>, each record
 *               { date: 'YYYY-MM-DD', status, time_in }
 */
const VIEWS = ['week', 'month']
const STATUSES = ['present', 'absent', 'late', 'excused']
const monthKey = d => format(d, 'yyyy-MM')

export function AttendanceRecord({ stats, loading = false, loadMonth }) {
    const { t } = useTranslation()
    const toast = useToast()
    const now = getNow()
    const today = startOfDay(now)

    const [view, setView] = useStoredState('imboni_att_view', 'week', v => VIEWS.includes(v))
    const [showWeekends, setShowWeekends] = useStoredState('imboni_att_weekends', false, v => typeof v === 'boolean')
    const visibleDays = showWeekends ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4]
    const [anchor, setAnchor] = useState(() => snapToVisible(today, visibleDays, -1))

    /* Records by month, fetched as the view reaches them. A week that straddles
       two months needs both. */
    const [months, setMonths] = useState({})
    const asked = useRef(new Set())
    const loader = useRef(loadMonth)
    useEffect(() => { loader.current = loadMonth })

    const range = useMemo(() => {
        if (view === 'month') return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
        const monday = mondayOf(anchor)
        return { start: monday, end: addDays(monday, 6) }
    }, [view, anchor])

    const wanted = [...new Set([monthKey(range.start), monthKey(range.end)])]
    const wantedKey = wanted.join(',')

    useEffect(() => {
        for (const key of wantedKey.split(',')) {
            if (asked.current.has(key)) continue
            asked.current.add(key)
            const [y, mo] = key.split('-').map(Number)
            Promise.resolve(loader.current(y, mo))
                .then(list => setMonths(m => ({ ...m, [key]: Array.isArray(list) ? list : [] })))
                .catch(e => {
                    setMonths(m => ({ ...m, [key]: [] }))
                    toast.error(errorMessage(e, t('attendance.loadFailed')))
                })
        }
    // A month already asked for is not asked again; t and toast are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wantedKey])

    const busy = wanted.some(k => !Array.isArray(months[k]))
    const byDate = useMemo(() => {
        const map = {}
        for (const key of wantedKey.split(',')) {
            if (Array.isArray(months[key])) months[key].forEach(r => { map[r.date] = r })
        }
        return map
    }, [months, wantedKey])

    function goTo(date) { setAnchor(snapToVisible(startOfDay(date), visibleDays, 1)) }
    const move = dir => setAnchor(a => step(a, view, visibleDays, dir))

    useCalendarShortcuts(true, {
        w: () => setView('week'),
        m: () => setView('month'),
        t: () => goTo(today),
        n: () => move(1),  j: () => move(1),
        p: () => move(-1), k: () => move(-1),
    })

    function dayInfo(date) {
        const iso = format(date, 'yyyy-MM-dd')
        const rec = byDate[iso]
        let status = rec?.status
        if (!status) status = isAfter(date, today) ? 'future' : (dayIndexOf(date) >= 5 ? 'weekend' : 'none')
        return { date, iso, status, timeIn: rec?.time_in ? rec.time_in.slice(0, 5) : null }
    }

    const shownDays = eachDayOfInterval(range).filter(d => visibleDays.includes(dayIndexOf(d)))
    const records = shownDays
        .map(dayInfo)
        .filter(d => STATUSES.includes(d.status))
        .reverse()
    const counts = Object.fromEntries(STATUSES.map(s => [s, records.filter(r => r.status === s).length]))

    const statCards = [
        { icon: 'fact_check', colorClass: 'success', value: loading ? '-' : `${stats?.overall_rate ?? 0}%`,
          label: t('attendance.overallRate'), trend: stats?.attendance_label },
        { icon: 'event_available', colorClass: '', value: loading ? '-' : (stats?.days_present ?? 0),
          label: t('attendance.daysPresent') },
        { icon: 'event_busy', colorClass: 'red', value: loading ? '-' : (stats?.days_absent ?? 0),
          label: t('attendance.daysAbsent'),
          trend: stats ? t('attendance.excusedCount', { count: stats.excused_absences ?? 0 }) : undefined },
        { icon: 'schedule', colorClass: 'warning', value: loading ? '-' : (stats?.late_arrivals ?? 0),
          label: t('attendance.lateArrivals') },
    ]

    const statusLabel = s => (STATUSES.includes(s) ? t(`common.${s}`) : s === 'weekend' ? t('common.weekend') : '')

    return (
        <>
            <div className="portal-stat-grid mb-1-5">
                {statCards.map(c => <StatCard key={c.label} {...c} />)}
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">
                        <span className="material-symbols-rounded" aria-hidden="true">calendar_month</span>
                        {t('attendance.record')}
                    </h2>
                </div>
                <div className="card-content">
                    <TimetableToolbar
                        views={VIEWS}
                        view={view}
                        onViewChange={setView}
                        showWeekends={showWeekends}
                        onShowWeekendsChange={next => {
                            setShowWeekends(next)
                            if (!next) setAnchor(a => snapToVisible(a, [0, 1, 2, 3, 4], -1))
                        }}
                        anchor={anchor}
                        visibleDays={visibleDays}
                        now={now}
                        onStep={move}
                        onToday={() => goTo(today)}
                        onPick={goTo}
                    >
                        <ul className="att-legend-row" aria-label={t('attendance.legend')}>
                            {STATUSES.map(s => (
                                <li key={s}><span className={`att-swatch att-${s}`} aria-hidden="true" />{t(`common.${s}`)}</li>
                            ))}
                        </ul>
                    </TimetableToolbar>

                    {view === 'week' ? (
                        <ol className="att-week" style={{ '--att-cols': visibleDays.length }} aria-busy={busy}>
                            {shownDays.map(date => {
                                const d = dayInfo(date)
                                return (
                                    <li key={d.iso}
                                        className={`att-day att-${d.status}${isSameDay(date, today) ? ' is-today' : ''}`}>
                                        <span className="att-day-name">{formatWeekday(date)}</span>
                                        <span className="att-day-date">{formatDate(date)}</span>
                                        <span className="att-day-status">
                                            {busy ? '…' : (statusLabel(d.status) || t('attendance.noRecord'))}
                                        </span>
                                        {d.timeIn && <span className="att-day-time">{t('attendance.timeIn', { time: d.timeIn })}</span>}
                                    </li>
                                )
                            })}
                        </ol>
                    ) : (
                        <MonthGrid
                            anchor={anchor}
                            visibleDays={visibleDays}
                            dayInfo={dayInfo}
                            today={today}
                            busy={busy}
                            statusLabel={statusLabel}
                        />
                    )}

                    <div className="att-records-head">
                        <h3 className="att-records-title">{t('attendance.recordsShown')}</h3>
                        <span className="att-records-summary">{t('attendance.summary', counts)}</span>
                    </div>
                    {busy ? (
                        <p className="empty-note">{t('common.loading')}</p>
                    ) : records.length === 0 ? (
                        <p className="empty-note">
                            {t(view === 'month' ? 'attendance.noRecordsMonth' : 'attendance.noRecordsWeek')}
                        </p>
                    ) : (
                        <div className="data-table-wrap framed">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('common.date')}</th>
                                        <th>{t('common.day')}</th>
                                        <th>{t('common.status')}</th>
                                        <th>{t('common.timeIn')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map(r => (
                                        <tr key={r.iso}>
                                            <td>{formatDate(r.date)}</td>
                                            <td>{formatWeekday(r.date)}</td>
                                            <td><span className={`badge att-badge att-${r.status}`}>{statusLabel(r.status)}</span></td>
                                            <td>{r.timeIn ?? '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

/* Monday first, like the school week and the date picker above it. */
function MonthGrid({ anchor, visibleDays, dayInfo, today, busy, statusLabel }) {
    const first = startOfMonth(anchor)
    const gridStart = mondayOf(first)
    const last = endOfMonth(anchor)
    const weeks = []
    for (let w = gridStart; w <= last; w = addDays(w, 7)) {
        weeks.push(visibleDays.map(i => addDays(w, i)))
    }
    const sundayFirst = weekdayShortNames()
    const mondayFirst = [...sundayFirst.slice(1), sundayFirst[0]]

    return (
        <table className="att-month" aria-busy={busy}>
            <thead>
                <tr>{visibleDays.map(i => <th key={i} scope="col">{mondayFirst[i]}</th>)}</tr>
            </thead>
            <tbody>
                {weeks.map(week => (
                    <tr key={format(week[0], 'yyyy-MM-dd')}>
                        {week.map(date => {
                            if (!isSameMonth(date, first)) return <td key={date.toISOString()} className="att-mday is-outside" />
                            const d = dayInfo(date)
                            const label = statusLabel(d.status)
                            return (
                                <td key={d.iso}
                                    className={`att-mday att-${d.status}${isSameDay(date, today) ? ' is-today' : ''}`}
                                    title={label || undefined}>
                                    <span className="att-mday-num">{date.getDate()}</span>
                                    {label && STATUS_DOT.has(d.status) && <span className="sr-only">{label}</span>}
                                </td>
                            )
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

const STATUS_DOT = new Set(STATUSES)
