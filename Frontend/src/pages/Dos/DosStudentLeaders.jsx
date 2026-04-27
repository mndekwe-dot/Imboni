import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const leaderStats = [
    { icon: 'military_tech', value: '6',  label: 'Prefects',          trend: 'School-wide',  trendClass: '',         colorClass: 'info'    },
    { icon: 'home',          value: '8',  label: 'Dormitory Captains',trend: '4 houses',     trendClass: '',         colorClass: 'success' },
    { icon: 'groups',        value: '12', label: 'Club Leaders',      trend: 'Active clubs', trendClass: '',         colorClass: 'warning' },
    { icon: 'person',        value: '26', label: 'Total Leaders',     trend: '+2 this term', trendClass: 'positive', colorClass: 'info'    },
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


const PREFECT_ROLES  = ['Head Girl','Head Boy','Deputy Head Girl','Deputy Head Boy','Academics Prefect','Games Prefect','Discipline Prefect','Health Prefect']
const CAPTAIN_HOUSES = ['Karisimbi','Muhabura','Bisoke','Sabyinyo']
const LEADER_YEARS   = ['S1A','S1B','S1C','S2A','S2B','S2C','S3A','S3B','S3C','S4A','S4B','S4C','S5A','S5B','S5C','S6A','S6B','S6C']

function getRoleTag(role) {
    if (role.includes('Deputy')) return 'deputy'
    return 'prefect'
}

function LeaderFormModal({ leader, onClose, onSave }) {
    const isEdit = !!leader
    const [type,   setType]   = useState(leader?.type   || 'prefect')
    const [name,   setName]   = useState(leader?.name   || '')
    const [role,   setRole]   = useState(leader?.role   || PREFECT_ROLES[0])
    const [house,  setHouse]  = useState(leader?.house  || CAPTAIN_HOUSES[0])
    const [form,   setForm]   = useState(leader?.form   || 'S4A')
    const [since,  setSince]  = useState(leader?.since  || 'Jan 2026')
    const [err,    setErr]    = useState('')

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    function save() {
        if (!name.trim()) { setErr('Full name is required'); return }
        const initials = name.trim().split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
        onSave({ type, initials, name: name.trim(), role, roleTag: getRoleTag(role), house, form, since })
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded">military_tech</span>
                        <h2 className="modal-title">{isEdit ? 'Edit Leader' : 'Appoint Leader'}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>
                <div className="modal-body">
                    {err && <p className="text-destructive" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>{err}</p>}
                    <div className="form-group">
                        <label className="form-label">Type</label>
                        <select className="form-input" value={type} onChange={e => setType(e.target.value)} disabled={isEdit}>
                            <option value="prefect">School Prefect</option>
                            <option value="captain">Dormitory Captain</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Full Name *</label>
                        <input className="form-input" value={name} onChange={e => { setName(e.target.value); setErr('') }} placeholder="e.g. Uwase Amina" autoFocus />
                    </div>
                    {type === 'prefect' ? (
                        <div className="form-group">
                            <label className="form-label">Role</label>
                            <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                                {PREFECT_ROLES.map(r => <option key={r}>{r}</option>)}
                            </select>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">Dormitory</label>
                            <select className="form-input" value={house} onChange={e => setHouse(e.target.value)}>
                                {CAPTAIN_HOUSES.map(h => <option key={h}>{h}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Class / Form</label>
                            <select className="form-input" value={form} onChange={e => setForm(e.target.value)}>
                                {LEADER_YEARS.map(y => <option key={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Since</label>
                            <input className="form-input" value={since} onChange={e => setSince(e.target.value)} placeholder="e.g. Jan 2026" />
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <div className="modal-footer-row">
                        <div className="modal-footer-hint" />
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={save}>{isEdit ? 'Save Changes' : 'Appoint'}</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function PrefectCard({ initials, name, roleTag, role, form, since, editMode, onEdit, onRemove }) {
    return (
        <div className="leader-card">
            <div className="leader-avatar">{initials}</div>
            <p className="leader-name">{name}</p>
            <span className={`leader-role-tag ${roleTag}`}>{role}</span>
            <p className="leader-meta">{form} &bull; Since {since}</p>
            <div className="leader-card-actions">
                {editMode ? (
                    <>
                        <button className="btn btn-secondary btn-sm" onClick={onEdit}>Edit</button>
                        <button className="btn btn-sm" style={{ background: 'var(--destructive)', color: '#fff' }} onClick={onRemove}>Remove</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-secondary btn-sm">View</button>
                        <button className="btn btn-primary btn-sm" onClick={onEdit}>Edit</button>
                    </>
                )}
            </div>
        </div>
    )
}

function HouseCaptainRow({ initials, name, house, form, since, editMode, onEdit, onRemove }) {
    return (
        <tr>
            <td><div className="leader-cell"><div className="leader-cell-avatar">{initials}</div><span>{name}</span></div></td>
            <td>Dormitory Captain</td>
            <td>{house}</td>
            <td>{form}</td>
            <td>{since}</td>
            <td>
                {editMode ? (
                    <>
                        <button className="btn btn-secondary btn-sm" onClick={onEdit} style={{ marginRight: '0.35rem' }}>Edit</button>
                        <button className="btn btn-sm" style={{ background: 'var(--destructive)', color: '#fff' }} onClick={onRemove}>Remove</button>
                    </>
                ) : (
                    <button className="btn btn-secondary btn-sm" onClick={onEdit}>View</button>
                )}
            </td>
        </tr>
    )
}

export function DosStudentLeaders() {
    const [prefectList,    setPrefectList]    = useState(prefects)
    const [captainList,    setCaptainList]    = useState(houseCaptains)
    const [showAppoint,    setShowAppoint]    = useState(false)
    const [editLeader,     setEditLeader]     = useState(null)   // { type, index, data }
    const [prefectEditMode, setPrefectEditMode] = useState(false)
    const [captainEditMode, setCaptainEditMode] = useState(false)

    function handleAppoint(data) {
        if (data.type === 'prefect') {
            setPrefectList(prev => [...prev, { initials: data.initials, name: data.name, roleTag: data.roleTag, role: data.role, form: data.form, since: data.since }])
        } else {
            setCaptainList(prev => [...prev, { initials: data.initials, name: data.name, house: data.house, form: data.form, since: data.since }])
        }
    }

    function handleEditSave(data) {
        if (!editLeader) return
        if (editLeader.type === 'prefect') {
            setPrefectList(prev => prev.map((p, i) => i === editLeader.index ? { ...p, name: data.name, initials: data.initials, role: data.role, roleTag: data.roleTag, form: data.form, since: data.since } : p))
        } else {
            setCaptainList(prev => prev.map((c, i) => i === editLeader.index ? { ...c, name: data.name, initials: data.initials, house: data.house, form: data.form, since: data.since } : c))
        }
        setEditLeader(null)
    }

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
                            <button className="btn btn-primary" onClick={() => setShowAppoint(true)}>
                                <span className="material-symbols-rounded">add</span> Appoint Leader
                            </button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Dr. Jean-Claude Ndagijimana</span>
                                    <span className="header-user-role">Director of Studies</span>
                                </div>
                                <Link to="/profile" className="header-user-av dos-av">JN</Link>
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

                        <div className="portal-stat-grid">
                            {leaderStats.map((s, i) => (
                                <StatCard key={i} {...s} />
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
                                <button className="btn btn-secondary btn-sm" onClick={() => setPrefectEditMode(m => !m)}>
                                    {prefectEditMode ? 'Done' : 'Edit Appointments'}
                                </button>
                            </div>
                            <div className="card-content">
                                <div className="leaders-grid">
                                    {prefectList.map((p, index) => (
                                        <PrefectCard
                                            key={index} {...p}
                                            editMode={prefectEditMode}
                                            onEdit={() => setEditLeader({ type: 'prefect', index, data: p })}
                                            onRemove={() => setPrefectList(prev => prev.filter((_, i) => i !== index))}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Dormitory Captains */}
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Dormitory Captains</h2>
                                <button className="btn btn-secondary btn-sm" onClick={() => setCaptainEditMode(m => !m)}>
                                    {captainEditMode ? 'Done' : 'Edit Appointments'}
                                </button>
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
                                            {captainList.map((hc, index) => (
                                                <HouseCaptainRow
                                                    key={index} {...hc}
                                                    editMode={captainEditMode}
                                                    onEdit={() => setEditLeader({ type: 'captain', index, data: hc })}
                                                    onRemove={() => setCaptainList(prev => prev.filter((_, i) => i !== index))}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>
            {showAppoint && (
                <LeaderFormModal
                    onClose={() => setShowAppoint(false)}
                    onSave={data => { handleAppoint(data); setShowAppoint(false) }}
                />
            )}
            {editLeader && (
                <LeaderFormModal
                    leader={{ ...editLeader.data, type: editLeader.type }}
                    onClose={() => setEditLeader(null)}
                    onSave={handleEditSave}
                />
            )}
        </>
    )
}
