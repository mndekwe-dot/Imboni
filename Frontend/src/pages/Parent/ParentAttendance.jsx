import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { parentNavItems, parentSecondaryItems } from './parentNav'
import {
    getMyChildren, getChildAttendanceStats, getChildAttendanceCalendar,
} from '../../api/parent'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'

const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
]

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function buildCalendarGrid(year, month, records) {
    const recordMap = {}
    records.forEach(r => {
        const day = new Date(r.date).getDate()
        recordMap[day] = r.status
    })

    const daysInMonth = new Date(year, month, 0).getDate()
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
    const today = new Date()
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
    const todayDay = today.getDate()

    const cells = []
    for (let i = 0; i < firstDayOfWeek; i++) {
        cells.push({ day: null, status: 'empty' })
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day)
        const dow  = date.getDay()
        const isWeekend = dow === 0 || dow === 6
        const isToday   = isCurrentMonth && day === todayDay
        let status = isWeekend ? 'weekend' : (recordMap[day] || 'weekend')
        if (isToday && !isWeekend) status = (recordMap[day] || 'present') + (isToday ? ' today' : '')
        cells.push({ day, status })
    }
    return cells
}

function AttendanceStat({ title, value, change, changeClass, iconClass, icon }) {
    return (
        <div className="stats-card">
            <div className="stats-card-content">
                <div className="stats-card-info">
                    <span className="stats-card-title">{title}</span>
                    <span className="stats-card-value">{value}</span>
                    <span className={`stats-card-change ${changeClass}`}>{change}</span>
                </div>
                <div className={`stats-card-icon ${iconClass}`}>
                    <span className="material-symbols-rounded">{icon}</span>
                </div>
            </div>
        </div>
    )
}

function AttendancePanel({ childId, childName, loading }) {
    const [stats,         setStats]         = useState(null)
    const [calendarDays,  setCalendarDays]  = useState([])
    const [loadingPanel,  setLoadingPanel]  = useState(true)

    const now    = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year,  setYear]  = useState(now.getFullYear())

    useEffect(() => {
        if (!childId) return
        setLoadingPanel(true)
        Promise.all([
            getChildAttendanceStats(childId).catch(() => null),
            getChildAttendanceCalendar(childId, month, year).catch(() => []),
        ]).then(([s, records]) => {
            setStats(s)
            setCalendarDays(buildCalendarGrid(year, month, records || []))
        }).finally(() => setLoadingPanel(false))
    }, [childId, month, year])

    const statCards = stats ? [
        { title: 'Overall Rate',  value: `${stats.overall_rate}%`, change: stats.attendance_label,    changeClass: 'positive', iconClass: 'icon-success',     icon: 'check_circle'    },
        { title: 'Days Present',  value: stats.days_present,       change: 'This term',                changeClass: 'neutral',  iconClass: 'icon-primary',     icon: 'event_available' },
        { title: 'Days Absent',   value: stats.days_absent,        change: `${stats.excused_absences} excused`, changeClass: 'neutral', iconClass: 'icon-destructive', icon: 'event_busy' },
        { title: 'Late Arrivals', value: stats.late_arrivals,      change: stats.late_label,           changeClass: 'positive', iconClass: 'icon-accent',      icon: 'schedule'        },
    ] : []

    function prevMonth() {
        if (month === 1) { setMonth(12); setYear(y => y - 1) }
        else setMonth(m => m - 1)
    }
    function nextMonth() {
        if (month === 12) { setMonth(1); setYear(y => y + 1) }
        else setMonth(m => m + 1)
    }

    if (loadingPanel) return <p style={{ padding: '1rem', color: 'var(--muted-foreground)' }}>Loading attendance…</p>

    return (
        <>
            <div className="stats-grid">
                {statCards.map((s, i) => <AttendanceStat key={i} {...s} />)}
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">{childName} — {MONTH_NAMES[month - 1]} {year}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={prevMonth}>
                            <span className="material-symbols-rounded">chevron_left</span>
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={nextMonth}>
                            <span className="material-symbols-rounded">chevron_right</span>
                        </button>
                    </div>
                </div>
                <div className="card-content">
                    <div className="calendar-wrapper">
                        <div className="calendar-header">
                            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div>
                            <div>Thu</div><div>Fri</div><div>Sat</div>
                        </div>
                        <div className="calendar-grid">
                            {calendarDays.map((d, i) => (
                                <div key={i} className={`calendar-day ${d.status}`}>
                                    {d.day}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="calendar-legend">
                        <div className="legend-item"><div className="legend-color present"></div><span>Present</span></div>
                        <div className="legend-item"><div className="legend-color absent"></div><span>Absent</span></div>
                        <div className="legend-item"><div className="legend-color late"></div><span>Late</span></div>
                        <div className="legend-item"><div className="legend-color holiday"></div><span>Weekend / Holiday</span></div>
                    </div>
                </div>
            </div>
        </>
    )
}

export function ParentAttendance() {
    const [children,  setChildren]  = useState([])
    const [activeIdx, setActiveIdx] = useState(0)
    const [loading,   setLoading]   = useState(true)

    useEffect(() => {
        getMyChildren()
            .then(setChildren)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const child = children[activeIdx]

    return (
        <>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}>
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Attendance Records</h1>
                        </div>
                    </header>

                    {!loading && children.length > 0 && (
                        <div className="child-switcher-bar">
                            <span className="child-switcher-label">Child:</span>
                            {children.map((c, i) => (
                                <button key={c.id}
                                    className={`child-tab${i === activeIdx ? ' active' : ''}`}
                                    onClick={() => setActiveIdx(i)}>
                                    <div className="child-tab-avatar amina">{initials(c.student_name)}</div>
                                    <span className="child-tab-name">{c.student_name}</span>
                                    <span className="child-tab-grade">&middot; {c.grade}{c.section}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    <DashboardContent>
                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading…</p>
                        ) : !child ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>No children linked.</p>
                        ) : (
                            <AttendancePanel
                                key={child.id}
                                childId={child.id}
                                childName={child.student_name}
                            />
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
