import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { NewActivityModal } from '../../components/modals/NewActivityModal'
import { EditActivityModal } from '../../components/modals/EditActivityModal'
import { LeaderModal } from '../../components/modals/LeaderModal'
import { DormitoryCaptainModal } from '../../components/modals/DormitoryCaptainModal'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { useState } from 'react'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'


// ── Activities data ──
const activityStats = [
    { iconClass: 'info',     icon: 'emoji_events',       value: '18',  label: 'Active Clubs',      trend: '+3 this term',    trendClass: 'positive' },
    { iconClass: 'success',  icon: 'groups',             value: '847', label: 'Enrolled Students', trend: '+42 this term',   trendClass: 'positive' },
    { iconClass: 'warning',  icon: 'report',             value: '4',   label: 'Conduct Incidents', trend: 'During activities', trendClass: 'negative' },
    { iconClass: 'positive', icon: 'supervisor_account', value: '18',  label: 'Patron Teachers',   trend: 'All assigned',    trendClass: 'positive' },
]

const activities = [
    { avClass: 'patron', avText: 'FC', cat: 'sports',   name: 'Football Club',          patron: 'Mr. Rurangwa',    schedule: 'Tue & Thu, 4:30 PM',  venue: 'Sports Field',            status: 'active', badge: 'Active', members: 34, incidents: '0 incidents this term', incidentClass: 'disc-points-pos' },
    { avClass: 'patron', avText: 'BK', cat: 'sports',   name: 'Basketball Team',        patron: 'Mr. Murenzi',     schedule: 'Mon & Wed, 5:00 PM',  venue: 'Basketball Court',        status: 'active', badge: 'Active', members: 28, incidents: '1 incident this term',  incidentClass: 'disc-points-neg' },
    { avClass: 'matron', avText: 'DA', cat: 'arts',     name: 'Drama & Arts Club',      patron: 'Ms. Uwera',       schedule: 'Fridays, 3:30 PM',    venue: 'Imboni Auditorium',       status: 'active', badge: 'Active', members: 27, incidents: '0 incidents this term', incidentClass: 'disc-points-pos' },
    { avClass: 'patron', avText: 'DB', cat: 'academic', name: 'Debate Club',            patron: 'Mr. Nzeyimana',   schedule: 'Wednesdays, 4:00 PM', venue: 'Library Conference Room', status: 'active', badge: 'Active', members: 22, incidents: '0 incidents this term', incidentClass: 'disc-points-pos' },
    { avClass: 'patron', avText: 'SC', cat: 'science',  name: 'Science Club',           patron: 'Dr. Nsabimana',   schedule: 'Thursdays, 4:00 PM',  venue: 'Science Laboratory',      status: 'active', badge: 'Active', members: 18, incidents: '0 incidents this term', incidentClass: 'disc-points-pos' },
    { avClass: 'matron', avText: 'CS', cat: 'social',   name: 'Community Service Club', patron: 'Ms. Ingabire',    schedule: 'Saturdays, 9:00 AM',  venue: 'Community Hall / Grounds', status: 'active', badge: 'Active', members: 45, incidents: '0 incidents this term', incidentClass: 'disc-points-pos' },
]

const recentActivityIncidents = [
    { iconClass: 'warning',  icon: 'sports_basketball', title: 'Unsportsmanlike conduct — Basketball match vs Muhabura House', time: 'Mar 5, 2026 • Student: Mutabazi Kevin (S4A)', typeClass: 'negative', type: 'Negative' },
    { iconClass: 'positive', icon: 'emoji_events',      title: 'Outstanding leadership at inter-school debate competition',    time: 'Mar 2, 2026 • Student: Uwineza Lydia (S5B)', typeClass: 'positive', type: 'Positive' },
    { iconClass: 'warning',  icon: 'theater_comedy',    title: 'Missed 3 consecutive Drama Club sessions without excuse',     time: 'Feb 28, 2026 • Student: Ishimwe David (S2B)', typeClass: 'warning',  type: 'Warning'  },
]

const activityFilterOptions = [
    { key: 'all',      label: 'All Activities' },
    { key: 'sports',   label: 'Sports'         },
    { key: 'arts',     label: 'Arts'           },
    { key: 'academic', label: 'Academic'       },
    { key: 'social',   label: 'Social'         },
    { key: 'science',  label: 'Science'        },
]

function ActivityCard({ avClass, avText, cat, name, patron, schedule, venue, incidents, incidentClass, badge, members, onEdit }) {
    const role = `${cat.charAt(0).toUpperCase() + cat.slice(1)} • Patron: ${patron}`
    return (
        <div className="staff-card" data-cat={cat}>
            <div className="staff-card-top">
                <div className={`staff-card-avatar ${avClass}`}>{avText}</div>
                <div>
                    <div className="staff-card-name">{name}</div>
                    <div className="staff-card-role">{role}</div>
                </div>
                <span className="pub-badge active" style={{ marginLeft: 'auto' }}>{badge}</span>
            </div>
            <div className="staff-card-meta">
                <span><span className="material-symbols-rounded">groups</span>{members} members</span>
                <span><span className="material-symbols-rounded">schedule</span>{schedule}</span>
                <span><span className="material-symbols-rounded">location_on</span>{venue}</span>
                <span><span className="material-symbols-rounded">report</span><span className={incidentClass}>{incidents}</span></span>
            </div>
            <div className="staff-card-actions">
                <button className="btn btn-secondary btn-sm"><span className="material-symbols-rounded">group</span> Members</button>
                <button className="btn btn-primary btn-sm" onClick={onEdit}><span className="material-symbols-rounded">edit</span> Edit</button>
            </div>
        </div>
    )
}

// ── Leaders data ──
const leaderStats = [
    { iconClass: 'info',     icon: 'military_tech',      value: '12', label: 'Total Prefects',     trend: 'Head Boy & Girl included', trendClass: 'positive' },
    { iconClass: 'success',  icon: 'home',               value: '8',  label: 'Dormitory Captains', trend: '4 Dormitories, 2 per dorm', trendClass: 'positive' },
    { iconClass: 'warning',  icon: 'groups',             value: '18', label: 'Club Leaders',       trend: 'All active clubs',         trendClass: 'positive' },
    { iconClass: 'positive', icon: 'report',             value: '1',  label: 'Conduct Issues',     trend: 'Needs review',             trendClass: 'negative' },
]

const prefects = [
    { avClass: 'matron', initials: 'UA', name: 'Uwase Amina',         role: 'Head Girl',          form: 'S4A', badge: 'Head Prefect', badgeClass: 'active', house: 'Bisoke',    appointed: 'Jan 20, 2026', issues: '0 conduct issues', issueClass: 'disc-points-pos', adm: 234 },
    { avClass: 'patron', initials: 'NE', name: 'Ndagijimana Eric',    role: 'Head Boy',           form: 'S6A', badge: 'Head Prefect', badgeClass: 'active', house: 'Muhabura',  appointed: 'Jan 20, 2026', issues: '0 conduct issues', issueClass: 'disc-points-pos', adm: 235 },
    { avClass: 'matron', initials: 'UL', name: 'Uwineza Lydia',       role: 'Deputy Head Girl',   form: 'S5B', badge: 'Dep. Prefect', badgeClass: 'active', house: 'Bisoke',    appointed: 'Jan 20, 2026', issues: '0 conduct issues', issueClass: 'disc-points-pos', adm: 236 },
    { avClass: 'patron', initials: 'HS', name: 'Habimana Samuel',     role: 'Deputy Head Boy',    form: 'S6B', badge: 'Dep. Prefect', badgeClass: 'draft',  house: 'Muhabura',  appointed: 'Jan 20, 2026', issues: '1 conduct issue',  issueClass: 'disc-points-neg', adm: 237 },
    { avClass: 'matron', initials: 'HG', name: 'Hakizimana Grace',    role: 'Games Prefect',      form: 'S3A', badge: 'Prefect',      badgeClass: 'active', house: 'Bisoke',    appointed: 'Jan 20, 2026', issues: '0 conduct issues', issueClass: 'disc-points-pos', adm: 238 },
    { avClass: 'patron', initials: 'BJ', name: 'Bizimana James',      role: 'Discipline Prefect', form: 'S5A', badge: 'Prefect',      badgeClass: 'active', house: 'Karisimbi', appointed: 'Jan 20, 2026', issues: '0 conduct issues', issueClass: 'disc-points-pos', adm: 239 },
]

const initialCaptains = [
    { id: 1, dormKey: 'karisimbi',    name: 'Tuyishime Angel',     adm: '2023-S3-011', form: 'S3A', gender: 'Girls', since: 'Jan 20, 2026', conduct: 'Clean record', conductClass: 'disc-points-pos' },
    { id: 2, dormKey: 'bisoke',    name: 'Uwamahoro Christine',  adm: '2023-S3-042', form: 'S3B', gender: 'Girls', since: 'Jan 20, 2026', conduct: 'Clean record', conductClass: 'disc-points-pos' },
    { id: 3, dormKey: 'muhabura',     name: 'Gasana Innocent',      adm: '2023-S3-055', form: 'S3C', gender: 'Boys',  since: 'Jan 20, 2026', conduct: 'Clean record', conductClass: 'disc-points-pos' },
    { id: 4, dormKey: 'sabyinyo', name: 'Nzabonimana Claude',   adm: '2023-S3-078', form: 'S3B', gender: 'Boys',  since: 'Jan 20, 2026', conduct: 'Clean record', conductClass: 'disc-points-pos' },
]

const DORM_LABEL = { karisimbi: 'Karisimbi', bisoke: 'Bisoke', muhabura: 'Muhabura', sabyinyo: 'Sabyinyo' }

function PrefectCard({ avClass, initials, name, role, form, badge, badgeClass, house, appointed, issues, issueClass, adm, onEdit }) {
    return (
        <div className="staff-card">
            <div className="staff-card-top">
                <div className={`staff-card-avatar ${avClass}`}>{initials}</div>
                <div>
                    <div className="staff-card-name">{name}</div>
                    <div className="staff-card-role">{role} • {form}</div>
                </div>
                <span className={`pub-badge ${badgeClass}`} style={{ marginLeft: 'auto' }}>{badge}</span>
            </div>
            <div className="staff-card-meta">
                <span><span className="material-symbols-rounded">military_tech</span>{role}</span>
                <span><span className="material-symbols-rounded">home</span>{house} Dormitory</span>
                <span><span className="material-symbols-rounded">calendar_today</span>Appointed: {appointed}</span>
                <span><span className="material-symbols-rounded">report</span><span className={issueClass}>{issues}</span></span>
            </div>
            <div className="staff-card-actions">
                <button className="btn btn-secondary btn-sm">View Profile</button>
                <button className="btn btn-primary btn-sm" onClick={() => onEdit({ adm, name, role, form, badge, house, appointed })}>
                    <span className="material-symbols-rounded">edit</span> Edit
                </button>
            </div>
        </div>
    )
}

function CaptainRow({ captain, onEdit, onRemove, confirmId, onConfirmRemove, onCancelRemove }) {
    const isConfirming = confirmId === captain.id
    return (
        <tr>
            <td><span className={`disc-badge ${captain.dormKey}`}>{DORM_LABEL[captain.dormKey]}</span></td>
            <td><strong>{captain.name}</strong> <span className="class-chip" style={{ marginLeft: '4px' }}>{captain.form}</span></td>
            <td><span className="text-muted" style={{ fontSize: '0.8rem' }}>{captain.adm}</span></td>
            <td>{captain.since}</td>
            <td><span className={captain.conductClass}>{captain.conduct}</span></td>
            <td className="action-cell">
                {isConfirming ? (
                    <>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>Remove captain?</span>
                        <button className="btn btn-primary btn-sm" onClick={() => onConfirmRemove(captain.id)}>Yes</button>
                        <button className="btn btn-outline btn-sm" onClick={onCancelRemove}>No</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => onEdit(captain)}>
                            <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>edit</span> Edit
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => onRemove(captain.id)}>
                            <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>delete</span> Remove
                        </button>
                    </>
                )}
            </td>
        </tr>
    )
}

// ── Main page ──
export function DisStudentLife() {
    const [activeTab, setActiveTab] = useState('activities')

    // Activities tab state
    const [actFilter, setActFilter] = useState('all')
    const [editingActivity, setEditingActivity] = useState(null)
    const [showNewActivity, setShowNewActivity] = useState(false)

    const visibleActivities = actFilter === 'all'
        ? activities
        : activities.filter(a => a.cat === actFilter)

    // Leaders tab state
    const [leaderFilter, setLeaderFilter] = useState('all')
    const [showAddLeader, setShowAddLeader] = useState(false)
    const [editingLeader, setEditingLeader] = useState(null)
    const [captains, setCaptains] = useState(initialCaptains)
    const [captainModal, setCaptainModal] = useState(null)
    const [confirmRemoveId, setConfirmRemoveId] = useState(null)
    let nextCaptainId = captains.length + 1

    function handleAddCaptain(data) { setCaptains(prev => [...prev, { ...data, id: nextCaptainId++, conductClass: 'disc-points-pos' }]) }
    function handleEditCaptain(data) { setCaptains(prev => prev.map(c => c.id === captainModal.id ? { ...c, ...data } : c)) }
    function handleRemoveCaptain(id) { setCaptains(prev => prev.filter(c => c.id !== id)); setConfirmRemoveId(null) }

    const girlsCaptains = captains.filter(c => c.gender === 'Girls')
    const boysCaptains  = captains.filter(c => c.gender === 'Boys')

    return (
        <>
            {editingActivity && <EditActivityModal activity={editingActivity} onClose={() => setEditingActivity(null)} onSave={() => setEditingActivity(null)} />}
            {showNewActivity && <NewActivityModal onClose={() => setShowNewActivity(false)} onSave={() => setShowNewActivity(false)} />}
            {showAddLeader && <LeaderModal onSave={() => setShowAddLeader(false)} onClose={() => setShowAddLeader(false)} />}
            {editingLeader && <LeaderModal leader={editingLeader} onSave={() => setEditingLeader(null)} onClose={() => setEditingLeader(null)} />}
            {captainModal === 'add' && <DormitoryCaptainModal onSave={handleAddCaptain} onClose={() => setCaptainModal(null)} />}
            {captainModal && captainModal !== 'add' && <DormitoryCaptainModal captain={captainModal} onSave={handleEditCaptain} onClose={() => setCaptainModal(null)} />}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Student Life"
                        subtitle="Extracurricular activities, clubs and student leadership — Term 2, 2026"
                        {...disUser}
                    />

                    <DashboardContent>

                        {/* Tab switcher */}
                        <div className="filter-tabs-bar" style={{ marginBottom: '1.25rem' }}>
                            <button
                                className={`filter-tab${activeTab === 'activities' ? ' active' : ''}`}
                                onClick={() => setActiveTab('activities')}
                            >
                                <span className="material-symbols-rounded">emoji_events</span> Activities & Clubs
                            </button>
                            <button
                                className={`filter-tab${activeTab === 'leaders' ? ' active' : ''}`}
                                onClick={() => setActiveTab('leaders')}
                            >
                                <span className="material-symbols-rounded">military_tech</span> Student Leaders
                            </button>
                        </div>

                        {/* ── ACTIVITIES TAB ── */}
                        {activeTab === 'activities' && (
                            <>
                                <div className="disc-stat-grid">
                                    {activityStats.map((stat, i) => (
                                        <div key={i} className="disc-stat-card">
                                            <div className={`disc-stat-icon ${stat.iconClass}`}><span className="material-symbols-rounded">{stat.icon}</span></div>
                                            <div>
                                                <div className="disc-stat-value">{stat.value}</div>
                                                <div className="disc-stat-label">{stat.label}</div>
                                                <div className={`disc-stat-trend ${stat.trendClass}`}>{stat.trend}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <FilterBar options={activityFilterOptions} active={actFilter} onChange={setActFilter} />
                                    <button className="btn btn-primary" onClick={() => setShowNewActivity(true)}>
                                        <span className="material-symbols-rounded">add</span> New Club / Event
                                    </button>
                                </div>

                                <div className="staff-cards-grid">
                                    {visibleActivities.map((activity, i) => (
                                        <ActivityCard key={i} {...activity} onEdit={() => setEditingActivity(activity)} />
                                    ))}
                                </div>

                                <div className="card mt-1-5">
                                    <div className="card-header">
                                        <h2 className="card-title">Recent Conduct Incidents During Activities</h2>
                                    </div>
                                    <div className="card-content">
                                        <div className="disc-activity-list">
                                            {recentActivityIncidents.map((incident, i) => (
                                                <div key={i} className="disc-activity-item">
                                                    <div className={`disc-activity-icon ${incident.iconClass}`}>
                                                        <span className="material-symbols-rounded">{incident.icon}</span>
                                                    </div>
                                                    <div className="disc-activity-details">
                                                        <p className="disc-activity-title">{incident.title}</p>
                                                        <p className="disc-activity-time">{incident.time} &bull; <span className={`incident-type-tag ${incident.typeClass}`}>{incident.type}</span></p>
                                                    </div>
                                                    <button className="btn btn-secondary btn-sm">View Report</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── LEADERS TAB ── */}
                        {activeTab === 'leaders' && (
                            <>
                                <div className="disc-stat-grid">
                                    {leaderStats.map((stat, i) => (
                                        <div key={i} className="disc-stat-card">
                                            <div className={`disc-stat-icon ${stat.iconClass}`}><span className="material-symbols-rounded">{stat.icon}</span></div>
                                            <div>
                                                <div className="disc-stat-value">{stat.value}</div>
                                                <div className="disc-stat-label">{stat.label}</div>
                                                <div className={`disc-stat-trend ${stat.trendClass}`}>{stat.trend}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <FilterBar
                                        options={[
                                            { key: 'all',      label: 'All Leaders',        count: prefects.length + captains.length },
                                            { key: 'prefects', label: 'Prefects',            count: prefects.length },
                                            { key: 'captains', label: 'Dormitory Captains',  count: captains.length },
                                            { key: 'clubs',    label: 'Club Leaders' },
                                        ]}
                                        active={leaderFilter}
                                        onChange={setLeaderFilter}
                                    />
                                    <button className="btn btn-primary" onClick={() => setShowAddLeader(true)}>
                                        <span className="material-symbols-rounded">add</span> Add Leader
                                    </button>
                                </div>

                                {(leaderFilter === 'all' || leaderFilter === 'prefects') && (
                                    <div className="staff-cards-grid">
                                        {prefects.map((prefect, i) => (
                                            <PrefectCard key={i} {...prefect} onEdit={setEditingLeader} />
                                        ))}
                                    </div>
                                )}

                                {(leaderFilter === 'all' || leaderFilter === 'captains') && (
                                <div className="card mt-1-5">
                                    <div className="card-header">
                                        <h2 className="card-title"><span className="material-symbols-rounded">home</span> Dormitory Captains</h2>
                                        <button className="btn btn-primary btn-sm" onClick={() => setCaptainModal('add')}>
                                            <span className="material-symbols-rounded">add</span> Add Captain
                                        </button>
                                    </div>
                                    <div className="card-content">

                                        <div style={{ marginBottom: '1.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                                                <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: '#ec4899' }}>female</span> Girls Dormitories
                                            </div>
                                            <div className="disc-table-wrap">
                                                <table className="disc-table">
                                                    <thead><tr><th>Dormitory</th><th>Captain</th><th>ADM</th><th>Since</th><th>Conduct</th><th>Actions</th></tr></thead>
                                                    <tbody>
                                                        {girlsCaptains.length === 0
                                                            ? <tr><td colSpan={6} style={{ color: 'var(--muted-foreground)', fontStyle: 'italic', fontSize: '0.85rem' }}>No captains assigned</td></tr>
                                                            : girlsCaptains.map(c => (
                                                                <CaptainRow key={c.id} captain={c} confirmId={confirmRemoveId}
                                                                    onEdit={setCaptainModal} onRemove={setConfirmRemoveId}
                                                                    onConfirmRemove={handleRemoveCaptain} onCancelRemove={() => setConfirmRemoveId(null)}
                                                                />
                                                            ))
                                                        }
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                                                <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: '#3b82f6' }}>male</span> Boys Dormitories
                                            </div>
                                            <div className="disc-table-wrap">
                                                <table className="disc-table">
                                                    <thead><tr><th>Dormitory</th><th>Captain</th><th>ADM</th><th>Since</th><th>Conduct</th><th>Actions</th></tr></thead>
                                                    <tbody>
                                                        {boysCaptains.length === 0
                                                            ? <tr><td colSpan={6} style={{ color: 'var(--muted-foreground)', fontStyle: 'italic', fontSize: '0.85rem' }}>No captains assigned</td></tr>
                                                            : boysCaptains.map(c => (
                                                                <CaptainRow key={c.id} captain={c} confirmId={confirmRemoveId}
                                                                    onEdit={setCaptainModal} onRemove={setConfirmRemoveId}
                                                                    onConfirmRemove={handleRemoveCaptain} onCancelRemove={() => setConfirmRemoveId(null)}
                                                                />
                                                            ))
                                                        }
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                                )}

                                {leaderFilter === 'clubs' && (
                                    <div className="card mt-1-5">
                                        <div className="card-content" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                                            <span className="material-symbols-rounded" style={{ fontSize: '2rem' }}>emoji_events</span>
                                            <p style={{ marginTop: '0.5rem' }}>Club leader data coming soon.</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
