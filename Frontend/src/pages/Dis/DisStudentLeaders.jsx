import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { getDisStudentLeaders } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const ROLE_DISPLAY = {
    head_boy:          'Head Boy',
    head_girl:         'Head Girl',
    deputy_head_boy:   'Deputy Head Boy',
    deputy_head_girl:  'Deputy Head Girl',
    prefect:           'Prefect',
    house_captain:     'House Captain',
    class_captain:     'Class Captain',
    games_captain:     'Games Captain',
}

const PREFECT_ROLES = new Set(['head_boy','head_girl','deputy_head_boy','deputy_head_girl','prefect','class_captain','games_captain'])

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function isHeadRole(role) {
    return ['head_boy','head_girl','deputy_head_boy','deputy_head_girl'].includes(role)
}

function PrefectCard({ leader }) {
    const { student_name, student_id, grade, section, role, appointed_date, notes } = leader
    const cls       = `${grade || ''}${section || ''}`
    const roleLabel = ROLE_DISPLAY[role] || role
    const badgeCls  = isHeadRole(role) ? 'active' : 'draft'
    const badgeText = isHeadRole(role) ? 'Head Prefect' : 'Prefect'
    return (
        <div className="staff-card">
            <div className="staff-card-top">
                <div className="staff-card-avatar patron">{initials(student_name)}</div>
                <div>
                    <div className="staff-card-name">{student_name}</div>
                    <div className="staff-card-role">{roleLabel} &bull; {cls}</div>
                </div>
                <span className={`pub-badge ${badgeCls} ml-auto`}>{badgeText}</span>
            </div>
            <div className="staff-card-meta">
                <span><span className="material-symbols-rounded">badge</span>{student_id}</span>
                <span><span className="material-symbols-rounded">military_tech</span>{roleLabel}</span>
                {appointed_date && <span><span className="material-symbols-rounded">calendar_today</span>Appointed: {appointed_date}</span>}
                {notes && <span><span className="material-symbols-rounded">notes</span>{notes}</span>}
            </div>
            <div className="staff-card-actions">
                <button className="btn btn-secondary btn-sm">View Profile</button>
            </div>
        </div>
    )
}

function CaptainRow({ leader }) {
    const { student_name, student_id, grade, section, role, notes, appointed_date } = leader
    const cls = `${grade || ''}${section || ''}`
    return (
        <tr>
            <td><strong>{student_name}</strong> <span className="class-chip">{cls}</span></td>
            <td><span className="text-muted text-sm-muted">{student_id}</span></td>
            <td>{ROLE_DISPLAY[role] || role}</td>
            <td className="text-muted">{appointed_date || '—'}</td>
            <td>{notes || <span style={{ color: 'var(--muted-foreground)' }}>—</span>}</td>
        </tr>
    )
}

export function DisStudentLeaders() {
    const [leaders,  setLeaders]  = useState([])
    const [loading,  setLoading]  = useState(true)

    useEffect(() => {
        getDisStudentLeaders()
            .then(setLeaders)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const prefects  = leaders.filter(l => PREFECT_ROLES.has(l.role))
    const captains  = leaders.filter(l => l.role === 'house_captain')

    const stats = [
        { iconClass: 'info',    icon: 'military_tech',     value: prefects.length,  label: 'Total Prefects'     },
        { iconClass: 'success', icon: 'home',              value: captains.length,  label: 'House Captains'     },
        { iconClass: 'warning', icon: 'groups',            value: leaders.length,   label: 'Total Leaders'      },
    ]

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Student Leaders" subtitle="Prefects, house captains and club leaders" {...disUser} />

                    <DashboardContent>

                        <div className="disc-stat-grid">
                            {stats.map((s, i) => (
                                <div key={i} className="disc-stat-card">
                                    <div className={`disc-stat-icon ${s.iconClass}`}><span className="material-symbols-rounded">{s.icon}</span></div>
                                    <div>
                                        <div className="disc-stat-value">{loading ? '—' : s.value}</div>
                                        <div className="disc-stat-label">{s.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading leaders…</p>
                        ) : (
                            <>
                                {/* Prefects */}
                                <div className="disc-section-header mb-5">
                                    <div className="disc-section-title"><span className="material-symbols-rounded">military_tech</span> Prefects</div>
                                    <span className="badge">{prefects.length}</span>
                                </div>
                                {prefects.length === 0 ? (
                                    <p style={{ color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>No prefects appointed this term.</p>
                                ) : (
                                    <div className="staff-cards-grid mb-1-5">
                                        {prefects.map(l => <PrefectCard key={l.id} leader={l} />)}
                                    </div>
                                )}

                                {/* House Captains */}
                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title"><span className="material-symbols-rounded">home</span> House Captains</h2>
                                        <span className="badge">{captains.length}</span>
                                    </div>
                                    <div className="card-content">
                                        {captains.length === 0 ? (
                                            <p style={{ color: 'var(--muted-foreground)' }}>No house captains appointed this term.</p>
                                        ) : (
                                            <div className="disc-table-wrap">
                                                <table className="disc-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Student</th>
                                                            <th>Student ID</th>
                                                            <th>Role</th>
                                                            <th>Appointed</th>
                                                            <th>Notes</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {captains.map(l => <CaptainRow key={l.id} leader={l} />)}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
