import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const leaderStats = [
    { iconClass: 'info',    icon: 'military_tech', trend: 'School-wide',  trendClass: 'neutral',  value: '6',  label: 'Prefects'       },
    { iconClass: 'success', icon: 'home',          trend: '4 houses',     trendClass: 'neutral',  value: '8',  label: 'Dormitory Captains' },
    { iconClass: 'warning', icon: 'groups',        trend: 'Active clubs', trendClass: 'neutral',  value: '12', label: 'Club Leaders'   },
    { iconClass: 'info',    icon: 'person',        trend: '+2 this term', trendClass: 'positive', value: '26', label: 'Total Leaders'  },
]

const prefects = [
    { initials: 'UC', name: 'Uwimana Clarisse',   roleTag: 'prefect', role: 'Head Girl',         form: 'S4A', since: 'Jan 2026' },
    { initials: 'HK', name: 'Habimana Kevin',     roleTag: 'prefect', role: 'Head Boy',          form: 'S4B', since: 'Jan 2026' },
    { initials: 'HG', name: 'Hakizimana Grace',   roleTag: 'deputy',  role: 'Deputy Head Girl',  form: 'S4C', since: 'Jan 2026' },
    { initials: 'ND', name: 'Nkurunziza David',   roleTag: 'deputy',  role: 'Deputy Head Boy',   form: 'S4A', since: 'Jan 2026' },
    { initials: 'MJ', name: 'Mukamazimpaka Joy',  roleTag: 'prefect', role: 'Academics Prefect', form: 'S4B', since: 'Jan 2026' },
    { initials: 'NF', name: 'Ndayishimiye Felix', roleTag: 'prefect', role: 'Games Prefect',     form: 'S4A', since: 'Jan 2026' },
]

const houseCaptains = [
    { initials: 'UL', name: 'Uwineza Lydia',    house: 'Karisimbi', form: 'S3A', since: 'Jan 2026' },
    { initials: 'NP', name: 'Nkurunziza Peter', house: 'Muhabura',  form: 'S3B', since: 'Jan 2026' },
    { initials: 'NM', name: 'Nyirabeza Mercy',  house: 'Bisoke',    form: 'S3A', since: 'Jan 2026' },
    { initials: 'HM', name: 'Habimana Moses',   house: 'Sabyinyo',  form: 'S3C', since: 'Jan 2026' },
]

function LeaderStat({ iconClass, icon, trend, trendClass, value, label }) {
    return (
        <div className="stat-card">
            <div className="stat-header">
                <div className={`stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
                <span className={`stat-trend ${trendClass}`}>{trend}</span>
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    )
}

function PrefectCard({ initials, name, roleTag, role, form, since }) {
    return (
        <div className="leader-card">
            <div className="leader-avatar">{initials}</div>
            <p className="leader-name">{name}</p>
            <span className={`leader-role-tag ${roleTag}`}>{role}</span>
            <p className="leader-meta">{form} &bull; Since {since}</p>
            <div className="leader-card-actions">
                <button className="btn btn-secondary btn-sm">View</button>
                <button className="btn btn-primary btn-sm">Edit</button>
            </div>
        </div>
    )
}

function HouseCaptainRow({ initials, name, house, form, since }) {
    return (
        <tr>
            <td><div className="leader-cell"><div className="leader-cell-avatar">{initials}</div><span>{name}</span></div></td>
            <td>Dormitory Captain</td>
            <td>{house}</td>
            <td>{form}</td>
            <td>{since}</td>
            <td><button className="btn btn-secondary btn-sm">View</button></td>
        </tr>
    )
}

export function DosStudentLeaders() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}>
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Student Leaders</h1>
                            <p>Appoint and manage school prefects, house captains, and club leaders</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Monday, March 09, 2026</span>
                            <button className="btn btn-primary">
                                <span className="material-symbols-rounded">add</span> Appoint Leader
                            </button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Dr. Jean-Claude Ndagijimana</span>
                                    <span className="header-user-role">Director of Studies</span>
                                </div>
                                <div className="header-user-av dos-av">JN</div>
                            </div>
                        </div>
                    </header>

                    <DashboardContent>
                        <div className="dos-welcome-banner">
                            <div className="dos-welcome-text">
                                <h2>Student Leadership Programme</h2>
                                <p>Appoint and manage prefects, house captains, club leaders, and other student representatives for the 2026 academic year.</p>
                            </div>
                            <div className="dos-welcome-icon">
                                <span className="material-symbols-rounded">military_tech</span>
                            </div>
                        </div>

                        <div className="quick-stats">
                            {leaderStats.map((stat, index) => (
                                <LeaderStat key={index} {...stat} />
                            ))}
                        </div>

                        <div className="filter-tabs">
                            <button className="tab active">All Leaders</button>
                            <button className="tab">Prefects</button>
                            <button className="tab">Dormitory Captains</button>
                            <button className="tab">Club Leaders</button>
                            <button className="tab">Class Representatives</button>
                        </div>

                        {/* Prefects */}
                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h2 className="card-title">School Prefects</h2>
                                <button className="btn btn-secondary btn-sm">Edit Appointments</button>
                            </div>
                            <div className="card-content">
                                <div className="leaders-grid">
                                    {prefects.map((p, index) => (
                                        <PrefectCard key={index} {...p} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Dormitory Captains */}
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Dormitory Captains</h2>
                                <button className="btn btn-secondary btn-sm">Edit Appointments</button>
                            </div>
                            <div className="card-content">
                                <div className="leaders-table-wrap">
                                    <table className="leaders-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Role</th>
                                                <th>Dormitory</th>
                                                <th>Form</th>
                                                <th>Since</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {houseCaptains.map((hc, index) => (
                                                <HouseCaptainRow key={index} {...hc} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
