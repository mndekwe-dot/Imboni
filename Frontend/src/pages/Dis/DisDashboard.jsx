import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import { StatCard } from '../../components/layout/StatCard'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { DAYS, EXTRA_SLOTS, extraSchedules } from '../../data/extraTimetable'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

// Build today's schedule from extraTimetable data
function getTodaySchedule() {
    const dayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
    const schedule = extraSchedules['default']
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    return EXTRA_SLOTS.map(slot => {
        const cell = schedule[slot.id]?.[dayName]
        if (!cell || cell.type === 'empty') return null

        // Parse start time from slot.time e.g. "5:30 â€“ 7:00"
        const startStr = slot.time.split('â€“')[0].trim()
        const [h, m] = startStr.split(':').map(Number)
        const slotMinutes = h * 60 + m
        const endStr = slot.time.split('â€“')[1]?.trim()
        const [eh, em] = (endStr || '').split(':').map(n => parseInt(n) || 0)
        const endMinutes = eh * 60 + em

        const isActive = nowMinutes >= slotMinutes && nowMinutes < endMinutes
        const isDone   = nowMinutes >= endMinutes

        // Format time display e.g. "5:30 AM"
        const ampm = h >= 12 ? 'PM' : 'AM'
        const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
        const displayTime = `${displayH}:${String(m).padStart(2, '0')} ${ampm}`

        return {
            time:      displayTime,
            dotClass:  isActive ? 'active' : isDone ? 'done' : '',
            status:    isActive ? 'active' : isDone ? 'done' : '',
            title:     cell.subject,
            meta:      [cell.room, cell.teacher].filter(Boolean).join(' • '),
            badge:     isActive ? 'Now' : isDone ? 'Done' : 'Upcoming',
            badgeClass: isActive ? 'active' : isDone ? 'done' : 'upcoming',
        }
    }).filter(Boolean)
}

const disStats = [
    { colorClass: '',        icon: 'groups',   value: '420', label: 'Total Students'        },
    { colorClass: 'warning', icon: 'warning',  value: '7',   label: 'Incidents This Week'   },
    { colorClass: 'red',     icon: 'gavel',    value: '3',   label: 'Pending Appeals'       },
    { colorClass: 'success', icon: 'verified', value: '312', label: 'Good Conduct Standing' },
]

const todaySchedule = getTodaySchedule()


const recentIncidents = [
    { name: 'Bizimana James',    classChip: 'S5A', typeClass: 'negative', type: 'Misconduct', desc: 'Disruptive in class',             points: '-3', pointsClass: 'disc-points-neg', reportedBy: 'Ms. Umutoni'   },
    { name: 'Uwase Amina',       classChip: 'S4A', typeClass: 'warning',  type: 'Warning',    desc: 'Late to school x2',              points: '-2', pointsClass: 'disc-points-neg', reportedBy: 'Mr. Mutabazi'  },
    { name: 'Nsabimana Patrick', classChip: 'S2B', typeClass: 'negative', type: 'Dormitory',  desc: 'Noise after curfew',             points: '-2', pointsClass: 'disc-points-neg', reportedBy: 'Mrs. Hakizimana' },
    { name: 'Hakizimana Grace',  classChip: 'S3A', typeClass: 'positive', type: 'Positive',   desc: 'Debate competition \u2014 2nd place', points: '+5', pointsClass: 'disc-points-pos', reportedBy: 'Mr. Mutabazi'  },
    { name: 'Mutabazi Kevin',    classChip: 'S4A', typeClass: 'warning',  type: 'Uniform',    desc: 'Incorrect uniform',              points: '-2', pointsClass: 'disc-points-neg', reportedBy: 'Gate prefect' },
]

const supervisedStaff = [
    { iconClass: 'purple', icon: 'home',              name: 'Mrs. Mukamana Esperance', meta: 'Matron \u2014 Bisoke House (42 students)'    },
    { iconClass: 'purple', icon: 'home',              name: 'Mr. Nsabimana Jean',      meta: 'Patron \u2014 Karisimbi House (38 students)' },
    { iconClass: 'green',  icon: 'sports_basketball', name: 'Mr. Rurangwa Pacifique',  meta: 'Patron \u2014 Sports & Games'                },
    { iconClass: 'purple', icon: 'theater_comedy',    name: 'Ms. Ingabire Celestine',  meta: 'Patron \u2014 Arts & Culture'                },
]

const conductDistribution = [
    { label: 'Excellent (90\u2013100)', pct: '28%', fillClass: 'green', width: '28%' },
    { label: 'Good (75\u201389)',       pct: '52%', fillClass: '',      width: '52%' },
    { label: 'Fair (60\u201374)',       pct: '15%', fillClass: 'amber', width: '15%' },
    { label: 'Poor (<60)',              pct: '5%',  fillClass: 'red',   width: '5%'  },
]


function ScheduleItem({ time, status, dotClass, title, meta, badge, badgeClass }) {
    return (
        <div className={`disc-schedule-item${status ? ' ' + status : ''}`}>
            <div className={`disc-schedule-dot${dotClass ? ' ' + dotClass : ''}`}></div>
            <div className="schedule-body">
                <div className="schedule-title-row">
                    <span className="schedule-title">{title}</span>
                    <span className={`sched-badge${badgeClass ? ' ' + badgeClass : ''}`}>{badge}</span>
                </div>
                <span className="schedule-meta"><span className="schedule-time-inline">{time}</span>{meta}</span>
            </div>
        </div>
    )
}

function IncidentRow({ name, classChip, typeClass, type, desc, points, pointsClass, reportedBy }) {
    return (
        <tr>
            <td><strong>{name}</strong></td>
            <td>{classChip}</td>
            <td><span className={`incident-type-tag ${typeClass}`}>{type}</span> {desc}</td>
            <td><span className={pointsClass}>{points}</span></td>
            <td>{reportedBy}</td>
        </tr>
    )
}

function StaffItem({ iconClass, icon, name, meta }) {
    return (
        <div className="disc-activity-item">
            <div className={`disc-activity-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            <div>
                <div className="disc-activity-title">{name}</div>
                <div className="disc-activity-meta">{meta}</div>
            </div>
        </div>
    )
}

function ConductBar({ label, pct, fillClass, width }) {
    return (
        <div className="disc-progress-item">
            <div className="disc-progress-label"><span>{label}</span><span>{pct}</span></div>
            <div className="disc-progress-bar"><div className={`disc-progress-fill${fillClass ? ' ' + fillClass : ''}`} style={{ width }}></div></div>
        </div>
    )
}

export function DisDashboard() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Dashboard" subtitle="Director of Discipline â€” Overview" {...disUser} />

                    <DashboardContent>

                        <WelcomeBanner
                            name="Mr. Mutabazi"
                            role="Director of Discipline &amp; Student Affairs &bull; Imboni Academy"
                        />

                        <div className="portal-stat-grid">
                            {disStats.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        {/* Today's Non-Academic Schedule */}
                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">today</span> Today's Non-Academic Schedule</h3>
                                <button className="btn btn-primary btn-sm"><a href='/discipline/timetable'>+ Add Activity</a></button>
                            </div>
                            <div className="card-content">
                                <div className="daily-schedule">
                                    {todaySchedule.map((item, i) => <ScheduleItem key={i} {...item} />)}
                                </div>
                            </div>
                        </div>

                        {/* Two-column content */}
                        <div className="disc-two-col">

                            {/* Recent incidents */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title"><span className="material-symbols-rounded">history</span> Recent Incidents</h3>
                                    <a href="/discipline/reports" className="btn btn-outline btn-sm">View All</a>
                                </div>
                                <div className="card-content">
                                    <div className="table-responsive">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Student</th>
                                                    <th>Class</th>
                                                    <th>Incident</th>
                                                    <th>Points</th>
                                                    <th>Reported By</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentIncidents.map((inc, i) => <IncidentRow key={i} {...inc} />)}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Right column */}
                            <div>

                                {/* Staff under supervision */}
                                <div className="card" style={{ marginBottom: '1.25rem' }}>
                                    <div className="card-header">
                                        <h3 className="card-title"><span className="material-symbols-rounded">supervisor_account</span> Staff Under Supervision</h3>
                                        <a href="/discipline/staff" className="btn btn-outline btn-sm">Manage</a>
                                    </div>
                                    <div className="card-content">
                                        <div className="disc-activity-list">
                                            {supervisedStaff.map((s, i) => <StaffItem key={i} {...s} />)}
                                        </div>
                                    </div>
                                </div>

                                {/* Conduct distribution */}
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title"><span className="material-symbols-rounded">bar_chart</span> Conduct Distribution</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="disc-progress-group">
                                            {conductDistribution.map((bar, i) => <ConductBar key={i} {...bar} />)}
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
