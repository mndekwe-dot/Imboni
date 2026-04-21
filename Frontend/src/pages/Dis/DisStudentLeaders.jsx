import { Sidebar } from '../../components/layout/Sidebar'
import { useState } from 'react'
import { LeaderModal } from '../../components/modals/LeaderModal'
import { DormitoryCaptainModal } from '../../components/modals/DormitoryCaptainModal'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'


import { disNavItems, disSecondaryItems, disUser } from './disNav'

const leaderStats = [
    { iconClass: 'info', icon: 'military_tech', value: '12', label: 'Total Prefects', trend: 'Head Boy & Girl included', trendClass: 'positive' },
    { iconClass: 'success', icon: 'home', value: '8', label: 'Dormitory Captains', trend: '4 Dormitories, 2 per dormitory', trendClass: 'positive' },
    { iconClass: 'warning', icon: 'groups', value: '18', label: 'Club Leaders', trend: 'All active clubs', trendClass: 'positive' },
    { iconClass: 'positive', icon: 'report', value: '1', label: 'Conduct Issues', trend: 'Needs review', trendClass: 'negative' },
]

const prefects = [
    { avClass: 'patron', initials: 'UC', name: 'Uwimana Clarisse', role: 'Head Girl', form: 'S4A', badge: 'Head Prefect', badgeClass: 'active', house: 'Karisimbi', appointed: 'Jan 20, 2026', issues: '0 conduct issues', issueClass: 'disc-points-pos' ,adm:234},
    { avClass: 'patron', initials: 'HK', name: 'Habimana Kevin', role: 'Head Boy', form: 'S4B', badge: 'Head Prefect', badgeClass: 'active', house: 'Muhabura', appointed: 'Jan 20, 2026', issues: '0 conduct issues', issueClass: 'disc-points-pos' ,adm:235},
    { avClass: 'matron', initials: 'HG', name: 'Hakizimana Grace', role: 'Deputy Head Girl', form: 'S4A', badge: 'Dep. Prefect', badgeClass: 'active', house: 'Bisoke', appointed: 'Jan 20, 2026', issues: '0 conduct issues', issueClass: 'disc-points-pos' ,adm:236},
    { avClass: 'patron', initials: 'ND', name: 'Nkurunziza David', role: 'Deputy Head Boy', form: 'S4C', badge: 'Dep. Prefect', badgeClass: 'draft', house: 'Sabyinyo', appointed: 'Jan 20, 2026', issues: '1 conduct issue', issueClass: 'disc-points-neg' ,adm:237},
    { avClass: 'matron', initials: 'MJ', name: 'Mukamazimpaka Joy', role: 'Games Prefect', form: 'S3A', badge: 'Prefect', badgeClass: 'active', house: 'Karisimbi', appointed: 'Jan 20, 2026', issues: '0 conduct issues', issueClass: 'disc-points-pos' ,adm:238},
    { avClass: 'patron', initials: 'NF', name: 'Ndayishimiye Felix', role: 'Discipline Prefect', form: 'S3B', badge: 'Prefect', badgeClass: 'active', house: 'Muhabura', appointed: 'Jan 20, 2026', issues: '0 conduct issues', issueClass: 'disc-points-pos' ,adm:239},
]

const initialCaptains = [
    { id: 1, dormKey: 'karisimbi', name: 'Uwineza Lydia',    adm: '2023-S3-011', form: 'S3A', gender: 'Girls', since: 'Jan 20, 2026', conduct: 'Clean record', conductClass: 'disc-points-pos' },
    { id: 2, dormKey: 'bisoke',    name: 'Nyirabeza Mercy',  adm: '2023-S3-042', form: 'S3B', gender: 'Girls', since: 'Jan 20, 2026', conduct: 'Clean record', conductClass: 'disc-points-pos' },
    { id: 3, dormKey: 'muhabura',  name: 'Nkurunziza Peter', adm: '2023-S3-055', form: 'S3C', gender: 'Boys',  since: 'Jan 20, 2026', conduct: 'Clean record', conductClass: 'disc-points-pos' },
    { id: 4, dormKey: 'sabyinyo',  name: 'Habimana Moses',   adm: '2023-S3-078', form: 'S3B', gender: 'Boys',  since: 'Jan 20, 2026', conduct: 'Clean record', conductClass: 'disc-points-pos' },
]

const DORM_LABEL = { karisimbi: 'Karisimbi', bisoke: 'Bisoke', muhabura: 'Muhabura', sabyinyo: 'Sabyinyo' }

function LeaderStat({ iconClass, icon, value, label, trend, trendClass }) {
    return (
        <div className="disc-stat-card">
            <div className={`disc-stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            <div>
                <div className="disc-stat-value">{value}</div>
                <div className="disc-stat-label">{label}</div>
                <div className={`disc-stat-trend ${trendClass}`}>{trend}</div>
            </div>
        </div>
    )
}

function PrefectCard({ avClass, initials, name, role, form, badge, badgeClass, house, appointed, issues, issueClass, onEdit, adm }) {
    return (
        <div className="staff-card">
            <div className="staff-card-top">
                <div className={`staff-card-avatar ${avClass}`}>{initials}</div>
                <div>
                    <div className="staff-card-name">{name}</div>
                    <div className="staff-card-role">{role} &bull; {form}</div>
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
                <button className="btn btn-primary btn-sm" onClick={() => onEdit({ adm, name, role, form, badge, house, appointed })}><span className="material-symbols-rounded">edit</span> Edit</button>
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

export function DisStudentLeaders() {
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingLeader, setEditingLeader] = useState(null)

    // Dormitory captains state
    const [captains, setCaptains] = useState(initialCaptains)
    const [captainModal, setCaptainModal] = useState(null) // null | 'add' | captain-object
    const [confirmRemoveId, setConfirmRemoveId] = useState(null)
    let nextId = captains.length + 1

    function handleAddCaptain(data) {
        setCaptains(prev => [...prev, { ...data, id: nextId++, conductClass: 'disc-points-pos' }])
    }
    function handleEditCaptain(data) {
        setCaptains(prev => prev.map(c => c.id === captainModal.id ? { ...c, ...data } : c))
    }
    function handleRemoveCaptain(id) {
        setCaptains(prev => prev.filter(c => c.id !== id))
        setConfirmRemoveId(null)
    }

    const girlsCaptains = captains.filter(c => c.gender === 'Girls')
    const boysCaptains  = captains.filter(c => c.gender === 'Boys')

    return (
        <>
            {showAddModal && (
                <LeaderModal
                    onSave={(leader) => { console.log('Leader added:', leader) }}
                    onClose={() => setShowAddModal(false)}
                />
            )}
            {editingLeader && (
                <LeaderModal
                    leader={editingLeader}
                    onSave={(updatedLeader) => { console.log('Leader updated:', updatedLeader) }}
                    onClose={() => setEditingLeader(null)}
                />
            )}
            {captainModal === 'add' && (
                <DormitoryCaptainModal
                    onSave={handleAddCaptain}
                    onClose={() => setCaptainModal(null)}
                />
            )}
            {captainModal && captainModal !== 'add' && (
                <DormitoryCaptainModal
                    captain={captainModal}
                    onSave={handleEditCaptain}
                    onClose={() => setCaptainModal(null)}
                />
            )}
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Student Leaders" subtitle="Manage prefects, dormitory captains and club leaders" {...disUser} />

                    <div className="dashboard-content">

                        <div className="disc-stat-grid">
                            {leaderStats.map((stat, index) => (
                                <LeaderStat key={index} {...stat} />
                            ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div className="filter-tabs-bar" style={{ marginBottom: 0 }}>
                                <button className="filter-tab active">All Leaders</button>
                                <button className="filter-tab">Prefects</button>
                                <button className="filter-tab">Dormitory Captains</button>
                                <button className="filter-tab">Club Leaders</button>
                                <button className="filter-tab">Class Reps</button>
                            </div>
                            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                                <span className="material-symbols-rounded">add</span> Add Leader
                            </button>
                        </div>

                        <div className="staff-cards-grid">
                            {prefects.map((prefect, index) => (
                                <PrefectCard key={index} {...prefect} onEdit={(leader) => setEditingLeader(leader)} />
                            ))}
                        </div>

                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h2 className="card-title">
                                    <span className="material-symbols-rounded">home</span> Dormitory Captains
                                </h2>
                                <button className="btn btn-primary btn-sm" onClick={() => setCaptainModal('add')}>
                                    <span className="material-symbols-rounded">add</span> Add Captain
                                </button>
                            </div>
                            <div className="card-content">

                                {/* Girls dormitories */}
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: '#ec4899' }}>female</span>
                                        Girls Dormitories
                                    </div>
                                    <div className="disc-table-wrap">
                                        <table className="disc-table">
                                            <thead>
                                                <tr>
                                                    <th>Dormitory</th>
                                                    <th>Captain</th>
                                                    <th>ADM</th>
                                                    <th>Since</th>
                                                    <th>Conduct</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {girlsCaptains.length === 0 ? (
                                                    <tr><td colSpan={6} style={{ color: 'var(--muted-foreground)', fontStyle: 'italic', fontSize: '0.85rem' }}>No captains assigned</td></tr>
                                                ) : girlsCaptains.map(c => (
                                                    <CaptainRow
                                                        key={c.id}
                                                        captain={c}
                                                        confirmId={confirmRemoveId}
                                                        onEdit={setCaptainModal}
                                                        onRemove={setConfirmRemoveId}
                                                        onConfirmRemove={handleRemoveCaptain}
                                                        onCancelRemove={() => setConfirmRemoveId(null)}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Boys dormitories */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: '#3b82f6' }}>male</span>
                                        Boys Dormitories
                                    </div>
                                    <div className="disc-table-wrap">
                                        <table className="disc-table">
                                            <thead>
                                                <tr>
                                                    <th>Dormitory</th>
                                                    <th>Captain</th>
                                                    <th>ADM</th>
                                                    <th>Since</th>
                                                    <th>Conduct</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {boysCaptains.length === 0 ? (
                                                    <tr><td colSpan={6} style={{ color: 'var(--muted-foreground)', fontStyle: 'italic', fontSize: '0.85rem' }}>No captains assigned</td></tr>
                                                ) : boysCaptains.map(c => (
                                                    <CaptainRow
                                                        key={c.id}
                                                        captain={c}
                                                        confirmId={confirmRemoveId}
                                                        onEdit={setCaptainModal}
                                                        onRemove={setConfirmRemoveId}
                                                        onConfirmRemove={handleRemoveCaptain}
                                                        onCancelRemove={() => setConfirmRemoveId(null)}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
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
