import { useEffect, useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { matronNavItems, matronSecondaryItems } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { getMatronDashboard, getMatronNightCheck } from '../../api/matron'
import { useSessionUser } from '../../hooks/useSessionUser'
import { Loading } from '../../components/ui/Loading'


function initialsOf(name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function RollCallRow({ initials, name, room, dotClass, label }) {
    return (
        <div className="roll-call-row">
            <div className="roll-call-avatar">{initials}</div>
            <span className="roll-call-name">{name}</span>
            <span className="roll-call-room">{room}</span>
            <span className={`roll-status-dot ${dotClass}`}></span>
            <span className={`roll-status-label ${dotClass}`}>{label}</span>
        </div>
    )
}

function ReportRow({ dotClass, title, meta, statusClass, status }) {
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

export function MatronDashboard() {
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [dashboard, setDashboard] = useState(null)
    const [boarders, setBoarders] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        Promise.all([getMatronDashboard(), getMatronNightCheck()])
            .then(([d, nc]) => {
                setDashboard(d)
                setBoarders(nc.boarders || [])
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <Loading fullPage />
    if (error) return <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>

    const dormitory = dashboard.stats.dormitory || 'your dormitory'

    const matronStats = [
        { colorClass: '',        icon: 'home',         value: boarders.length, label: 'Students in Dormitory' },
        { colorClass: 'success', icon: 'check_circle', value: boarders.filter(b => b.is_present === true).length,  label: 'Present Tonight'   },
        { colorClass: 'red',     icon: 'cancel',       value: boarders.filter(b => b.is_present === false).length, label: 'Absent'            },
        { colorClass: 'warning', icon: 'schedule',     value: boarders.filter(b => b.is_present === null).length,  label: 'Not Yet Checked'   },
    ]

    const rollCall = boarders.map(b => {
        const dotClass = b.is_present === true ? 'present' : b.is_present === false ? 'absent' : 'pending'
        const label = b.is_present === true ? 'Present' : b.is_present === false ? 'Absent' : 'Not Checked'
        return { initials: initialsOf(b.full_name), name: b.full_name, room: b.room_number, dotClass, label }
    })

    const recentReports = dashboard.recent_incidents.map(r => {
        const positive = r.report_type === 'positive' || r.report_type === 'achievement'
        return {
            dotClass: positive ? 'reviewed' : 'pending',
            title: `${r.student} — ${r.title}`,
            meta: `${r.date} • ${r.severity ? r.severity[0].toUpperCase() + r.severity.slice(1) : r.report_type}`,
            statusClass: positive ? 'reviewed' : 'pending',
            status: positive ? 'Positive' : 'Flagged',
        }
    })

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Dashboard" subtitle={`${dormitory} — Overview`} {...sessionUser} notifications={liveNotifications} onNotificationRead={markRead} />

                    <DashboardContent>

                        <WelcomeBanner
                            name={sessionUser.userName}
                            role={`${dormitory} Matron — ${boarders.length} students in your care`}
                        />

                        <div className="portal-stat-grid">
                            {matronStats.map((s, i) => (
                                <StatCard key={i} {...s} />
                            ))}
                        </div>

                        <div className="matron-two-col">

                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title"><span className="material-symbols-rounded">fact_check</span> Tonight's Roll Call</h3>
                                    <button className="btn btn-outline btn-sm">Full List</button>
                                </div>
                                <div className="card-content">
                                    <div className="roll-call-list">
                                        {rollCall.length === 0
                                            ? <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>No boarders found.</p>
                                            : rollCall.map((r, i) => <RollCallRow key={i} {...r} />)}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="card mb-5">
                                    <div className="card-header">
                                        <h3 className="card-title"><span className="material-symbols-rounded">assignment_late</span> Reports to Discipline</h3>
                                        <button className="btn btn-outline btn-sm">Report</button>
                                    </div>
                                    <div className="card-content">
                                        <div className="matron-report-list">
                                            {recentReports.length === 0
                                                ? <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>No reports filed yet.</p>
                                                : recentReports.map((r, i) => <ReportRow key={i} {...r} />)}
                                        </div>
                                    </div>
                                </div>

                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title"><span className="material-symbols-rounded">bolt</span> Quick Actions</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="btn-stack">
                                            <button className="btn btn-primary"><span className="material-symbols-rounded">fact_check</span> Take Roll Call</button>
                                            <button className="btn btn-outline"><span className="material-symbols-rounded">report</span> Report Incident to Discipline</button>
                                            <button className="btn btn-outline"><span className="material-symbols-rounded">chat</span> Message Discipline Master</button>
                                            <button className="btn btn-outline"><span className="material-symbols-rounded">schedule</span> View Daily Schedule</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
