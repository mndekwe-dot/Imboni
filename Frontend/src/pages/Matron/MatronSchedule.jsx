import { useEffect, useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { PageLoading } from '../../components/layout/PageLoading'
import { useTranslation } from 'react-i18next'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import '../../styles/timetable.css'
import { matronNavItems, matronSecondaryItems } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { TimetableCell } from '../../components/timetable/TimetableCell'
import { getMatronBoardingSchedule } from '../../api/matron'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useMatronDormitory } from '../../hooks/useMatronDormitory'
import { StatCard } from '../../components/layout/StatCard'

/**
 * The standing boarding routine, as issued by the Discipline Office.
 *
 * The weekday routine is one row per time slot, not five. The server stores it
 * that way too — BoardingScheduleSlot.day_type is 'weekday' | 'saturday' |
 * 'sunday', and 'weekday' means Monday through Friday — because a boarding
 * house wakes at the same hour every school day. This used to render each slot
 * into five identical columns, which implied a variation between Monday and
 * Thursday that neither the routine nor the model has.
 */

const CHANGE_STATUS_DISPLAY = {
    new:     { dotClass: 'pending',  statusClass: 'pending',  labelKey: 'matron.schedule.changeNew'     },
    applied: { dotClass: 'reviewed', statusClass: 'reviewed', labelKey: 'matron.schedule.changeApplied' },
}

function TimeCell({ time, label }) {
    return (
        <td className="tt-time-cell">
            <strong>{time}</strong>
            <span>{label}</span>
        </td>
    )
}

/**
 * One routine table. Weekdays have a single activity column, the weekend has
 * one per day — the shape is the only thing that differs, so the shell is
 * written once rather than copied per card.
 */
function RoutineTable({ headings, rows, cellsFor }) {
    const { t } = useTranslation()
    return (
        <div className="tt-wrap">
            <table className="tt-table">
                <thead>
                    <tr>
                        <th className="tt-time-head">{t('common.time')}</th>
                        {headings.map(h => <th key={h} className="tt-day-head">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        row.isBreak ? (
                            <tr key={index} className="tt-break-row">
                                <TimeCell time={row.time} label={row.label} />
                                <td colSpan={headings.length} className="tt-break-cell">
                                    {row.breakText}
                                </td>
                            </tr>
                        ) : (
                            <tr key={index}>
                                <TimeCell time={row.time} label={row.label} />
                                {cellsFor(row).map((cell, i) => (
                                    <TimetableCell
                                        key={i}
                                        cell={{
                                            type: cell?.cellClass,
                                            subject: cell?.subject,
                                            teacher: cell?.teacher,
                                            room: cell?.room,
                                        }}
                                        editable={false}
                                        onEdit={() => {}}
                                        colIndex={i + 1}
                                        today={false}
                                        isNow={false}
                                    />
                                ))}
                            </tr>
                        )
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function ReadOnlyBadge() {
    const { t } = useTranslation()
    return (
        <span className="badge-readonly">
            <span className="material-symbols-rounded" aria-hidden="true">lock</span>
            {t('matron.schedule.readOnly')}
        </span>
    )
}

function ScheduleChange({ dotClass, title, meta, statusClass, status }) {
    return (
        <div className="matron-report-row">
            <div className={`matron-report-dot ${dotClass}`}></div>
            <div>
                <div className="matron-report-title">{title}</div>
                <div className="matron-report-meta">{meta}</div>
            </div>
            <span className={`matron-report-status ${statusClass}`}>{status}</span>
        </div>
    )
}

export function MatronSchedule() {
    const { t } = useTranslation()
    const dormitory = useMatronDormitory()
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        getMatronBoardingSchedule()
            .then(setData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return (
        <PageLoading
            navItems={matronNavItems} secondaryItems={matronSecondaryItems}
            title={t('matron.schedule.title')}
            user={sessionUser}
        />
    )
    if (error) return <p className="u-pad u-danger">{t('common.errorPrefix')}: {error}</p>

    const scheduleStats = [
        { colorClass: 'info',    icon: 'calendar_view_week', value: data.stats.days_in_schedule,  label: t('matron.schedule.daysInSchedule')  },
        { colorClass: 'success', icon: 'event_available',    value: data.stats.total_activities,  label: t('matron.schedule.totalActivities') },
        { colorClass: 'warning', icon: 'update',             value: data.stats.changes_this_week, label: t('matron.schedule.changesThisWeek') },
        { colorClass: 'success', icon: 'verified',           value: data.stats.current_term,      label: t('matron.schedule.currentTerm')     },
    ]

    const scheduleChanges = data.changes.map(c => {
        const display = CHANGE_STATUS_DISPLAY[c.status] || CHANGE_STATUS_DISPLAY.new
        return {
            title: c.description,
            meta: [
                c.changed_by_name && t('matron.schedule.updatedBy', { name: c.changed_by_name }),
                c.change_date,
            ].filter(Boolean).join(' · '),
            dotClass: display.dotClass,
            statusClass: display.statusClass,
            status: t(display.labelKey),
        }
    })

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('matron.schedule.boardingSchedule')}
                        subtitle={dormitory
                            ? t('matron.schedule.subtitle', { house: dormitory })
                            : t('matron.schedule.subtitleNoHouse')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>

                        <div className="notice-banner mb-5">
                            <span className="material-symbols-rounded u-fs-15" aria-hidden="true">verified</span>
                            <div>
                                <div className="banner-title">{t('matron.schedule.standingRoutine')}</div>
                                <div className="banner-sub">
                                    {data.stats.current_term} &middot; {t('matron.schedule.readOnlyNote')}
                                </div>
                            </div>
                        </div>

                        <div className="portal-stat-grid mb-5">
                            {scheduleStats.map((stat, index) => (
                                <StatCard key={index} {...stat} />
                            ))}
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded" aria-hidden="true">calendar_view_week</span>
                                    {' '}{t('matron.schedule.mondayToFriday')}
                                </h3>
                                <ReadOnlyBadge />
                            </div>
                            <div className="card-content">
                                <p className="u-sm u-muted">{t('matron.schedule.sameEveryWeekday')}</p>
                                <RoutineTable
                                    headings={[t('matron.schedule.activity')]}
                                    rows={data.weekday_rows}
                                    cellsFor={row => [row]}
                                />
                            </div>
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded" aria-hidden="true">weekend</span>
                                    {' '}{t('matron.schedule.weekend')}
                                </h3>
                                <ReadOnlyBadge />
                            </div>
                            <div className="card-content">
                                <RoutineTable
                                    headings={[t('matron.schedule.saturday'), t('matron.schedule.sunday')]}
                                    rows={data.weekend_rows}
                                    cellsFor={row => [row.sat, row.sun]}
                                />
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded" aria-hidden="true">history</span>
                                    {' '}{t('matron.schedule.recentChanges')}
                                </h3>
                            </div>
                            <div className="card-content">
                                <div className="matron-report-list">
                                    {scheduleChanges.map((change, index) => (
                                        <ScheduleChange key={index} {...change} />
                                    ))}
                                </div>
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
