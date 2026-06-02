import { useState, useEffect, useRef } from 'react'
import { getDosStudentLeaders } from '../../api/dos'
import { Link } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { formatSchoolDate } from '../../utils/date'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { classesFromConfig } from '../../utils/classes'


function isCaptain(role) {
    return /captain/i.test(role)
}

function toLeaderCard(sl) {
    const words    = (sl.full_name || '').trim().split(/\s+/)
    const initials = words.slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
    const form     = sl.grade && sl.section ? `S${sl.grade}${sl.section}` : '—'
    const since    = sl.appointed_date
        ? new Date(sl.appointed_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : '—'
    return { initials, name: sl.full_name, role: sl.role, roleTag: /deputy/i.test(sl.role) ? 'deputy' : 'prefect', form, since, house: sl.role }
}


const PREFECT_ROLES  = ['Head Girl','Head Boy','Deputy Head Girl','Deputy Head Boy','Academics Prefect','Games Prefect','Discipline Prefect','Health Prefect']
const CAPTAIN_HOUSES = ['Karisimbi','Muhabura','Bisoke','Sabyinyo']
// classes come from DOS settings — injected as prop

function getRoleTag(role) {
    if (role.includes('Deputy')) return 'deputy'
    return 'prefect'
}

function LeaderFormModal({ leader, onClose, onSave, allClasses }) {
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
                                {allClasses.map(y => <option key={y}>{y}</option>)}
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
    const { setting } = useSchoolSettings()
    const { config }  = useSchoolConfig()
    const allClasses  = classesFromConfig(config)
    const [prefectList,    setPrefectList]    = useState([])
    const [captainList,    setCaptainList]    = useState([])
    const [leaderStats,    setLeaderStats]    = useState([
        { icon: 'military_tech', value: '—', label: 'Prefects',          trend: 'School-wide',  trendClass: '',         colorClass: 'info'    },
        { icon: 'home',          value: '—', label: 'Dormitory Captains',trend: 'By house',     trendClass: '',         colorClass: 'success' },
        { icon: 'groups',        value: '—', label: 'Other Leaders',     trend: 'Active',       trendClass: '',         colorClass: 'warning' },
        { icon: 'person',        value: '—', label: 'Total Leaders',     trend: 'This term',    trendClass: 'positive', colorClass: 'info'    },
    ])

    useEffect(() => {
        getDosStudentLeaders()
            .then(data => {
                const prefects = data.filter(sl => !isCaptain(sl.role)).map(toLeaderCard)
                const captains = data.filter(sl =>  isCaptain(sl.role)).map(toLeaderCard)
                const others   = 0
                setPrefectList(prefects)
                setCaptainList(captains)
                setLeaderStats([
                    { icon: 'military_tech', value: prefects.length, label: 'Prefects',          trend: 'School-wide',  trendClass: '',         colorClass: 'info'    },
                    { icon: 'home',          value: captains.length, label: 'Dormitory Captains',trend: 'By house',     trendClass: '',         colorClass: 'success' },
                    { icon: 'groups',        value: others,          label: 'Other Leaders',     trend: 'Active',       trendClass: '',         colorClass: 'warning' },
                    { icon: 'person',        value: data.length,     label: 'Total Leaders',     trend: 'This term',    trendClass: 'positive', colorClass: 'info'    },
                ])
            })
            .catch(err => console.error(err))
    }, [])
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
                            <span className="date-display">{formatSchoolDate(setting.timezone)}</span>
                            <button className="btn btn-primary" onClick={() => setShowAppoint(true)}>
                                <span className="material-symbols-rounded">add</span> Appoint Leader
                            </button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Dr. Jean-Claude Ndagijimana</span>
                                    <span className="header-user-role">Director of Studies</span>
                                </div>
                                <Link to="/profile?role=dos" className="header-user-av dos-av">JN</Link>
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
                    allClasses={allClasses}
                />
            )}
            {editLeader && (
                <LeaderFormModal
                    leader={{ ...editLeader.data, type: editLeader.type }}
                    onClose={() => setEditLeader(null)}
                    onSave={handleEditSave}
                    allClasses={allClasses}
                />
            )}
        </>
    )
}
