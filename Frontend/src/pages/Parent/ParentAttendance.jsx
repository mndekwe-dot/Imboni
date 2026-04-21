import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'


const sarahAttendanceStats = [
    { title: 'Overall Rate',  value: '96%', change: 'Excellent attendance', changeClass: 'positive', iconClass: 'icon-success',     icon: 'check_circle'    },
    { title: 'Days Present',  value: '92',  change: 'This term',            changeClass: 'neutral',  iconClass: 'icon-primary',     icon: 'event_available' },
    { title: 'Days Absent',   value: '3',   change: 'All excused',          changeClass: 'neutral',  iconClass: 'icon-destructive', icon: 'event_busy'      },
    { title: 'Late Arrivals', value: '1',   change: 'Below average',        changeClass: 'positive', iconClass: 'icon-accent',      icon: 'schedule'        },
]

const michaelAttendanceStats = [
    { title: 'Overall Rate',  value: '88%', change: 'Needs improvement', changeClass: 'neutral',  iconClass: 'icon-warning',     icon: 'check_circle'    },
    { title: 'Days Present',  value: '84',  change: 'This term',         changeClass: 'neutral',  iconClass: 'icon-primary',     icon: 'event_available' },
    { title: 'Days Absent',   value: '10',  change: '3 unexcused',       changeClass: 'neutral',  iconClass: 'icon-destructive', icon: 'event_busy'      },
    { title: 'Late Arrivals', value: '4',   change: 'Above average',     changeClass: 'neutral',  iconClass: 'icon-accent',      icon: 'schedule'        },
]

const sarahCalendarDays = [
    { day: 1,  status: 'weekend' }, { day: 2,  status: 'present' }, { day: 3,  status: 'present' },
    { day: 4,  status: 'present' }, { day: 5,  status: 'present' }, { day: 6,  status: 'present' },
    { day: 7,  status: 'weekend' }, { day: 8,  status: 'weekend' }, { day: 9,  status: 'present' },
    { day: 10, status: 'present' }, { day: 11, status: 'present' }, { day: 12, status: 'present today' },
    { day: 13, status: 'absent'  }, { day: 14, status: 'weekend' }, { day: 15, status: 'weekend' },
    { day: 16, status: 'present' }, { day: 17, status: 'present' }, { day: 18, status: 'present' },
    { day: 19, status: 'late'    }, { day: 20, status: 'present' }, { day: 21, status: 'weekend' },
    { day: 22, status: 'weekend' }, { day: 23, status: 'present' }, { day: 24, status: 'present' },
    { day: 25, status: 'present' }, { day: 26, status: 'present' }, { day: 27, status: 'present' },
    { day: 28, status: 'weekend' },
]

const michaelCalendarDays = [
    { day: 1,  status: 'weekend' }, { day: 2,  status: 'present' }, { day: 3,  status: 'present' },
    { day: 4,  status: 'present' }, { day: 5,  status: 'present' }, { day: 6,  status: 'present' },
    { day: 7,  status: 'weekend' }, { day: 8,  status: 'weekend' }, { day: 9,  status: 'present' },
    { day: 10, status: 'present' }, { day: 11, status: 'late'    }, { day: 12, status: 'absent'  },
    { day: 13, status: 'absent'  }, { day: 14, status: 'weekend' }, { day: 15, status: 'weekend' },
    { day: 16, status: 'present' }, { day: 17, status: 'present' }, { day: 18, status: 'present' },
    { day: 19, status: 'present' }, { day: 20, status: 'present' }, { day: 21, status: 'weekend' },
    { day: 22, status: 'weekend' }, { day: 23, status: 'absent'  }, { day: 24, status: 'present' },
    { day: 25, status: 'present' }, { day: 26, status: 'late'    }, { day: 27, status: 'present' },
    { day: 28, status: 'weekend' },
]

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

function CalendarDay({ day, status }) {
    return <div className={`calendar-day ${status}`}>{day}</div>
}

function AttendancePanel({ stats, calendarDays, title }) {
    return (
        <>
            <div className="stats-grid">
                {stats.map((stat, index) => (
                    <AttendanceStat key={index} {...stat} />
                ))}
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">{title}</h3>
                    <button className="btn btn-outline btn-sm">Download Report</button>
                </div>
                <div className="card-content">
                    <div className="calendar-wrapper">
                        <div className="calendar-header">
                            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div>
                            <div>Thu</div><div>Fri</div><div>Sat</div>
                        </div>
                        <div className="calendar-grid">
                            {calendarDays.map((d, index) => (
                                <CalendarDay key={index} {...d} />
                            ))}
                        </div>
                    </div>
                    <div className="calendar-legend">
                        <div className="legend-item"><div className="legend-color present"></div><span>Present</span></div>
                        <div className="legend-item"><div className="legend-color absent"></div><span>Absent</span></div>
                        <div className="legend-item"><div className="legend-color late"></div><span>Late</span></div>
                        <div className="legend-item"><div className="legend-color" style={{ backgroundColor: 'var(--muted)' }}></div><span>Weekend/Holiday</span></div>
                    </div>
                </div>
            </div>
        </>
    )
}

export function ParentAttendance() {
    return (
        <>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn">
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Attendance Records</h1>
                        </div>
                    </header>

                    {/* Child Switcher Bar */}
                    <div className="child-switcher-bar">
                        <span className="child-switcher-label">Child:</span>
                        <button className="child-tab active" data-target="amina">
                            <div className="child-tab-avatar amina">UA</div>
                            <span className="child-tab-name">Uwase Amina</span>
                            <span className="child-tab-grade">&middot; S4A</span>
                        </button>
                    </div>

                    <div className="dashboard-content">

                        {/* Amina's Panel */}
                        <div className="child-panel active" id="panel-amina">
                            <AttendancePanel
                                stats={sarahAttendanceStats}
                                calendarDays={sarahCalendarDays}
                                title="Term 2, 2026 — Uwase Amina's Attendance"
                            />
                        </div>

                    </div>
                </main>
            </div>
        </>
    )
}
