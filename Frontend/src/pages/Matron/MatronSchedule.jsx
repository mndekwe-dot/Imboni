import { useEffect, useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { Link } from 'react-router'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { matronNavItems, matronSecondaryItems } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { formatSchoolDate } from '../../utils/date'
import { getMatronBoardingSchedule } from '../../api/matron'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { Loading } from '../../components/ui/Loading'


const CHANGE_STATUS_DISPLAY = {
    new:     { dotClass: 'pending',  statusClass: 'pending',  status: 'New'     },
    applied: { dotClass: 'reviewed', statusClass: 'reviewed', status: 'Applied' },
}

function ScheduleStat({ iconClass, icon, value, label }) {
    return (
        <div className="disc-stat-card">
            <div className={`disc-stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            <div>
                <div className="disc-stat-value">{value}</div>
                <div className="disc-stat-label">{label}</div>
            </div>
        </div>
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

function TtCell({ cellClass, subject, teacher, room }) {
    return (
        <td className={`tt-cell ${cellClass}`}>
            <div className="tt-subject">{subject}</div>
            <div className="tt-teacher">{teacher}</div>
            <div className="tt-room">{room}</div>
        </td>
    )
}

function WeekdayRow({ time, label, isBreak, breakText, cellClass, subject, teacher, room }) {
    if (isBreak) {
        return (
            <tr className="tt-break-row">
                <td className="tt-time-cell"><strong>{time}</strong><span>{label}</span></td>
                <td colSpan={5} className="tt-break-cell">{breakText}</td>
            </tr>
        )
    }
    return (
        <tr>
            <td className="tt-time-cell"><strong>{time}</strong><span>{label}</span></td>
            {[0,1,2,3,4].map(i => <TtCell key={i} cellClass={cellClass} subject={subject} teacher={teacher} room={room} />)}
        </tr>
    )
}

function WeekendRow({ time, label, isBreak, breakText, sat, sun }) {
    if (isBreak) {
        return (
            <tr className="tt-break-row">
                <td className="tt-time-cell"><strong>{time}</strong><span>{label}</span></td>
                <td colSpan={2} className="tt-break-cell">{breakText}</td>
            </tr>
        )
    }
    return (
        <tr>
            <td className="tt-time-cell"><strong>{time}</strong><span>{label}</span></td>
            <TtCell {...sat} />
            <TtCell {...sun} />
        </tr>
    )
}

export function MatronSchedule() {
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const { setting } = useSchoolSettings()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        getMatronBoardingSchedule()
            .then(setData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <Loading fullPage />
    if (error) return <p className="u-pad u-danger">Error: {error}</p>

    const scheduleStats = [
        { iconClass: 'info',     icon: 'calendar_view_week', value: data.stats.days_in_schedule,                label: 'Days in Schedule'  },
        { iconClass: 'success',  icon: 'event_available',    value: data.stats.total_activities,                label: 'Total Activities'  },
        { iconClass: 'warning',  icon: 'update',             value: data.stats.changes_this_week,               label: 'Changes This Week' },
        { iconClass: 'positive', icon: 'verified',           value: data.stats.current_term,                    label: 'Current Term'      },
    ]

    const scheduleChanges = data.changes.map(c => ({
        title: c.description,
        meta: `${c.changed_by_name ? 'Updated by ' + c.changed_by_name + ' · ' : ''}${c.change_date}`,
        ...(CHANGE_STATUS_DISPLAY[c.status] || CHANGE_STATUS_DISPLAY.new),
    }))

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Boarding Schedule"
                        subtitle="Timetable sent by the Discipline Master — Karisimbi House"
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>

                        <div className="disc-welcome-banner mb-5">
                            <span className="material-symbols-rounded u-fs-15">verified</span>
                            <div>
                                <div className="banner-title">Standing boarding routine — issued by the Discipline Office</div>
                                <div className="banner-sub">{data.stats.current_term} &middot; Read-only &mdash; contact the Discipline Master to request changes</div>
                            </div>
                        </div>

                        <div className="disc-stat-grid mb-5">
                            {scheduleStats.map((stat, index) => (
                                <ScheduleStat key={index} {...stat} />
                            ))}
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded">calendar_view_week</span> Monday to Friday
                                </h3>
                                <span className="did-direct-badge">
                                    <span className="material-symbols-rounded">lock</span>
                                    Read-only
                                </span>
                            </div>
                            <div className="card-content">
                                <div className="tt-wrap">
                                    <table className="tt-table">
                                        <thead>
                                            <tr>
                                                <th className="tt-time-head">Time</th>
                                                <th className="tt-day-head">Monday</th>
                                                <th className="tt-day-head">Tuesday</th>
                                                <th className="tt-day-head">Wednesday</th>
                                                <th className="tt-day-head">Thursday</th>
                                                <th className="tt-day-head">Friday</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.weekday_rows.map((row, index) => (
                                                <WeekdayRow key={index} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded">weekend</span> Weekend (Sat &amp; Sun)
                                </h3>
                                <span className="did-direct-badge">
                                    <span className="material-symbols-rounded">lock</span>
                                    Read-only
                                </span>
                            </div>
                            <div className="card-content">
                                <div className="tt-wrap">
                                    <table className="tt-table">
                                        <thead>
                                            <tr>
                                                <th className="tt-time-head">Time</th>
                                                <th className="tt-day-head">Saturday</th>
                                                <th className="tt-day-head">Sunday</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.weekend_rows.map((row, index) => (
                                                <WeekendRow key={index} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">history</span> Recent Schedule Changes</h3>
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
