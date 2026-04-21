import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { matronNavItems, matronSecondaryItems, matronUser } from './matronNav'


const matronStats = [
    { colorClass: '',        icon: 'home',         value: '42', label: 'Students in Dormitory' },
    { colorClass: 'success', icon: 'check_circle', value: '40', label: 'Present Tonight'        },
    { colorClass: 'red',     icon: 'cancel',       value: '1',  label: 'Absent'                 },
    { colorClass: 'warning', icon: 'schedule',     value: '1',  label: 'Late Check-in'          },
]

const rollCall = [
    { initials: 'UA', name: 'Uwase Amina',       room: 'Rm 14B', dotClass: 'present', label: 'Present' },
    { initials: 'MK', name: 'Mukamazimpaka Joy',  room: 'Rm 12A', dotClass: 'present', label: 'Present' },
    { initials: 'NI', name: 'Niyomugabo Iris',    room: 'Rm 8C',  dotClass: 'late',    label: 'Late'    },
    { initials: 'IB', name: 'Ingabire Belise',    room: 'Rm 14B', dotClass: 'present', label: 'Present' },
    { initials: 'KU', name: 'Kayitesi Ursula',    room: 'Rm 9A',  dotClass: 'absent',  label: 'Absent'  },
    { initials: 'NE', name: 'Ndayishimiye Elise', room: 'Rm 7B',  dotClass: 'present', label: 'Present' },
    { initials: 'RN', name: 'Rugamba Nadine',     room: 'Rm 11A', dotClass: 'present', label: 'Present' },
    { initials: 'MB', name: 'Mukamana Brigitte',  room: 'Rm 6C',  dotClass: 'present', label: 'Present' },
]

const recentReports = [
    { dotClass: 'reviewed', title: 'Niyomugabo Iris — Curfew violation',       meta: 'Mar 1, 2026 • Dormitory Violation', statusClass: 'reviewed', status: 'Reviewed' },
    { dotClass: 'pending',  title: 'Kayitesi Ursula — Absent from roll call',  meta: 'Mar 9, 2026 • Missing Student',      statusClass: 'pending',  status: 'Pending'  },
    { dotClass: 'reviewed', title: 'Ingabire Belise — Leadership recognition', meta: 'Feb 24, 2026 • Positive Conduct',    statusClass: 'reviewed', status: 'Reviewed' },
]

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
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Dashboard" subtitle="Karisimbi House — Overview" {...matronUser} />

                    <div className="dashboard-content">

                        <WelcomeBanner
                            name="Mrs. Hakizimana"
                            role="Karisimbi House Matron &mdash; 42 students in your care"
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
                                        {rollCall.map((r, i) => (
                                            <RollCallRow key={i} {...r} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="card" style={{ marginBottom: '1.25rem' }}>
                                    <div className="card-header">
                                        <h3 className="card-title"><span className="material-symbols-rounded">assignment_late</span> Reports to Discipline</h3>
                                        <button className="btn btn-outline btn-sm">Report</button>
                                    </div>
                                    <div className="card-content">
                                        <div className="matron-report-list">
                                            {recentReports.map((r, i) => (
                                                <ReportRow key={i} {...r} />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title"><span className="material-symbols-rounded">bolt</span> Quick Actions</h3>
                                    </div>
                                    <div className="card-content">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <button className="btn btn-primary"><span className="material-symbols-rounded">fact_check</span> Take Roll Call</button>
                                            <button className="btn btn-outline"><span className="material-symbols-rounded">report</span> Report Incident to Discipline</button>
                                            <button className="btn btn-outline"><span className="material-symbols-rounded">chat</span> Message Discipline Master</button>
                                            <button className="btn btn-outline"><span className="material-symbols-rounded">schedule</span> View Daily Schedule</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </main>
            </div>
        </>
    )
}
