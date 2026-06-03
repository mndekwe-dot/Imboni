import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import { StatCard } from '../../components/layout/StatCard'
import { disNavItems, disSecondaryItems } from './disNav'
import { getDisDashboard, getDisStaff } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const TYPE_META = {
    incident:    { cls: 'negative', label: 'Incident'    },
    warning:     { cls: 'warning',  label: 'Warning'     },
    positive:    { cls: 'positive', label: 'Positive'    },
    achievement: { cls: 'positive', label: 'Achievement' },
}

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function IncidentRow({ student, grade, section, title, report_type, date, reported_by, follow_up_required, follow_up_completed }) {
    const meta = TYPE_META[report_type] || { cls: '', label: report_type }
    const cls  = `${grade || ''}${section || ''}`
    const fuLabel = follow_up_required
        ? (follow_up_completed ? 'Done' : 'Pending')
        : '—'
    return (
        <tr>
            <td><strong>{student}</strong></td>
            <td><span className="class-chip">{cls}</span></td>
            <td><span className={`incident-type-tag ${meta.cls}`}>{meta.label}</span> {title}</td>
            <td className="text-muted">{date}</td>
            <td className="text-muted">{reported_by || '—'}</td>
            <td>
                {follow_up_required
                    ? <span className={`badge ${follow_up_completed ? 'badge-success' : 'badge-upcoming'}`}>{fuLabel}</span>
                    : <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                }
            </td>
        </tr>
    )
}

function StaffItem({ full_name, staff_type, assigned_dormitory, assigned_grade }) {
    const isMatron = ['matron', 'head_matron'].includes(staff_type)
    const icon     = isMatron ? 'home' : 'emoji_events'
    const meta     = assigned_dormitory
        ? `${staff_type === 'matron' ? 'Matron' : 'Head Matron'} — ${assigned_dormitory}`
        : `Patron${assigned_grade ? ' — ' + assigned_grade : ''}`
    return (
        <div className="disc-activity-item">
            <div className={`disc-activity-icon ${isMatron ? 'purple' : 'green'}`}>
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div>
                <div className="disc-activity-title">{full_name}</div>
                <div className="disc-activity-meta">{meta}</div>
            </div>
        </div>
    )
}

export function DisDashboard() {
    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Director of Discipline'
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'DD'

    const [stats,    setStats]    = useState(null)
    const [incidents,setIncidents]= useState([])
    const [staff,    setStaff]    = useState([])
    const [loading,  setLoading]  = useState(true)

    useEffect(() => {
        Promise.all([
            getDisDashboard(),
            getDisStaff(),
        ]).then(([dash, staffList]) => {
            setStats(dash.stats)
            setIncidents(dash.recent_incidents || [])
            setStaff((staffList || []).slice(0, 4))
        }).catch(console.error)
          .finally(() => setLoading(false))
    }, [])

    const statCards = stats ? [
        { colorClass: '',        icon: 'groups',   value: stats.active_students,    label: 'Total Students'        },
        { colorClass: 'warning', icon: 'warning',  value: stats.incidents_this_month, label: 'Incidents This Month' },
        { colorClass: 'red',     icon: 'gavel',    value: stats.pending_follow_ups,  label: 'Pending Follow-ups'   },
        { colorClass: 'success', icon: 'verified', value: stats.student_leaders,     label: 'Student Leaders'      },
    ] : []

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                            title="Dashboard"
                            subtitle="Director of Discipline — Overview"
                            userName={fullName}
                            userRole="Director of Discipline"
                            userInitials={initials}
                            avatarClass="discipline-av"
                        />

                    <DashboardContent>

                        <WelcomeBanner
                            name={fullName}
                            role="Director of Discipline · Imboni Academy"
                        />

                        <div className="portal-stat-grid">
                            {loading
                                ? [1,2,3,4].map(i => <div key={i} className="stat-card skeleton" style={{ height: 90 }} />)
                                : statCards.map((s, i) => <StatCard key={i} {...s} />)
                            }
                        </div>

                        <div className="disc-two-col">

                            {/* Recent incidents */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title"><span className="material-symbols-rounded">history</span> Recent Incidents</h3>
                                    <a href="/discipline/reports" className="btn btn-outline btn-sm">View All</a>
                                </div>
                                <div className="card-content">
                                    {loading ? (
                                        <p style={{ color: 'var(--muted-foreground)', padding: '1rem' }}>Loading…</p>
                                    ) : incidents.length === 0 ? (
                                        <p style={{ color: 'var(--muted-foreground)', padding: '1rem' }}>No recent incidents.</p>
                                    ) : (
                                        <div className="table-responsive">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Student</th>
                                                        <th>Class</th>
                                                        <th>Incident</th>
                                                        <th>Date</th>
                                                        <th>Reported By</th>
                                                        <th>Follow-up</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {incidents.map(inc => <IncidentRow key={inc.id} {...inc} />)}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right column */}
                            <div>
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title"><span className="material-symbols-rounded">supervisor_account</span> Staff Under Supervision</h3>
                                        <a href="/discipline/staff" className="btn btn-outline btn-sm">Manage</a>
                                    </div>
                                    <div className="card-content">
                                        {loading ? (
                                            <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
                                        ) : staff.length === 0 ? (
                                            <p style={{ color: 'var(--muted-foreground)' }}>No staff on record.</p>
                                        ) : (
                                            <div className="disc-activity-list">
                                                {staff.map(s => <StaffItem key={s.id} {...s} />)}
                                            </div>
                                        )}
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
