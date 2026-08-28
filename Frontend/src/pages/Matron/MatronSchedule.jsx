import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Sidebar } from '../../components/layout/Sidebar'
import { PageLoading } from '../../components/layout/PageLoading'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { Timetable } from '../../components/timetable/Timetable'
import { getThisMonday } from '../../components/timetable/dateUtils'
import { toWeekKey, entriesToSchedules, computeStats } from '../../components/timetable/extraEntries'
import { EXTRA_SLOTS } from '../../data/extraTimetable'
import { getMatronBoardingSchedule, getMatronWeeklySchedule } from '../../api/matron'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useNotifications } from '../../hooks/useNotifications'
import { useMatronDormitory } from '../../hooks/useMatronDormitory'
import { matronNavItems, matronSecondaryItems } from './matronNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import '../../styles/timetable.css'

/**
 * The boarding week, as the Discipline Office wrote it.
 *
 * This page used to draw its own tables — a `RoutineTable` with its own
 * headings, its own break row and its own time column, over a separate
 * `BoardingScheduleSlot` model. So a school kept two routines: the grid the
 * Discipline Director edited in their portal, and this one. They could say
 * different things, and there was no place in the app where that was visible.
 *
 * Now it renders the SAME <Timetable> component the DOS and Discipline portals
 * use, over the SAME `ExtracurricularEntry` rows the Discipline Director
 * edits — read-only, with the week picker so a matron can look ahead. What she
 * sees is their grid, not a copy of it.
 *
 * The recent-changes log stays on the old endpoint: it is the Discipline
 * Office's own change record and has no equivalent in the grid.
 */

const CHANGE_STATUS_DISPLAY = {
    new:     { dotClass: 'pending',  statusClass: 'pending',  labelKey: 'matron.schedule.changeNew'     },
    applied: { dotClass: 'reviewed', statusClass: 'reviewed', labelKey: 'matron.schedule.changeApplied' },
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

    const [meta, setMeta] = useState(null)      // term + change log, from the Discipline Office
    const [entries, setEntries] = useState([])  // the grid rows for the visible week
    const [loading, setLoading] = useState(true)
    const [fetching, setFetching] = useState(false)
    const [error, setError] = useState(null)

    // The week lives here, not inside <Timetable>, so re-fetching on a week
    // change does not remount the picker and snap it back to today.
    const [currentMonday, setCurrentMonday] = useState(() => getThisMonday())
    const activeWeek = toWeekKey(currentMonday)

    useEffect(() => {
        getMatronBoardingSchedule()
            .then(setMeta)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        let cancelled = false
        setFetching(true)
        getMatronWeeklySchedule(activeWeek)
            .then(data => { if (!cancelled) setEntries(Array.isArray(data) ? data : []) })
            // A week nobody has authored is an empty routine, not a failure —
            // and it must not take the change log down with it.
            .catch(() => { if (!cancelled) setEntries([]) })
            .finally(() => { if (!cancelled) setFetching(false) })
        return () => { cancelled = true }
    }, [activeWeek])

    if (loading) return (
        <PageLoading
            navItems={matronNavItems} secondaryItems={matronSecondaryItems}
            title={t('matron.schedule.title')}
            user={sessionUser}
        />
    )
    if (error) return <p className="u-pad u-danger">{t('common.errorPrefix')}: {error}</p>

    const stats = computeStats(entries)
    const schedules = entriesToSchedules(entries, activeWeek)

    const scheduleStats = [
        { colorClass: 'info',    icon: 'calendar_view_week', value: stats.scheduled,          label: t('matron.schedule.activitiesThisWeek') },
        { colorClass: 'success', icon: 'supervisor_account', value: stats.patrons,            label: t('matron.schedule.supervisors')        },
        { colorClass: 'warning', icon: 'location_on',        value: stats.venues,             label: t('matron.schedule.venues')             },
        { colorClass: 'success', icon: 'verified',           value: meta.stats.current_term,  label: t('matron.schedule.currentTerm')        },
    ]

    const scheduleChanges = (meta.changes || []).map(c => {
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
                                    {meta.stats.current_term} &middot; {t('matron.schedule.issuedBy')}
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
                                    {t('matron.schedule.weeklyRoutine')}
                                </h3>
                                <ReadOnlyBadge />
                            </div>
                            <div className="card-content">
                                {/* The grid stays mounted while another week
                                    loads — swapping it for a spinner is what
                                    made the week picker jump back to today. */}
                                <div className="u-relative">
                                    {fetching && (
                                        <div className="tt-fetch-overlay">
                                            <span className="tt-fetch-overlay-label">{activeWeek}…</span>
                                        </div>
                                    )}
                                    <Timetable
                                        type="extracurricular"
                                        editable={false}
                                        onEditCell={() => {}}
                                        slots={EXTRA_SLOTS}
                                        schedules={schedules}
                                        weekKey={activeWeek}
                                        currentMonday={currentMonday}
                                        onWeekChange={setCurrentMonday}
                                    />
                                </div>
                                {!fetching && entries.length === 0 && (
                                    <p className="u-sm u-muted">{t('matron.schedule.noRoutine')}</p>
                                )}
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded" aria-hidden="true">history</span>
                                    {t('matron.schedule.recentChanges')}
                                </h3>
                            </div>
                            <div className="card-content">
                                {scheduleChanges.length === 0 ? (
                                    <p className="u-sm u-muted">{t('matron.schedule.noChanges')}</p>
                                ) : (
                                    <div className="matron-report-list">
                                        {scheduleChanges.map((change, index) => (
                                            <ScheduleChange key={index} {...change} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
