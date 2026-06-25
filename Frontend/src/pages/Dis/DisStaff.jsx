import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { StaffModal } from '../../components/modals/StaffModal'
import { disNavItems, disSecondaryItems } from './disNav'
import { getDisStaff } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function MatronCard({ staff, onEdit }) {
    const { full_name, email, assigned_dormitory, assigned_grade, staff_type } = staff
    const roleLabel = staff_type === 'head_matron' ? 'Head Matron' : 'Matron'
    const dormLabel = assigned_dormitory || assigned_grade || 'Unassigned'
    return (
        <div className="staff-card">
            <div className="staff-card-top">
                <div className="staff-card-avatar matron">{initials(full_name)}</div>
                <div>
                    <div className="staff-card-name">{full_name}</div>
                    <div className="staff-card-role">{roleLabel} — {dormLabel}</div>
                </div>
            </div>
            <div className="staff-card-meta">
                {email && <span><span className="material-symbols-rounded">mail</span>{email}</span>}
                {assigned_dormitory && <span><span className="material-symbols-rounded">home</span>{assigned_dormitory}</span>}
                {assigned_grade && <span><span className="material-symbols-rounded">school</span>Grade: {assigned_grade}</span>}
            </div>
            <div className="staff-card-actions">
                <button className="btn btn-sm btn-primary"><span className="material-symbols-rounded">chat</span> Message</button>
                <button className="btn btn-sm btn-outline" onClick={onEdit}><span className="material-symbols-rounded">edit</span> Edit</button>
            </div>
        </div>
    )
}

function PatronCard({ staff, onEdit }) {
    const { full_name, email, assigned_dormitory, assigned_grade, staff_type } = staff
    const dormLabel = assigned_dormitory || assigned_grade || 'General'
    return (
        <div className="staff-card">
            <div className="staff-card-top">
                <div className="staff-card-avatar patron">{initials(full_name)}</div>
                <div>
                    <div className="staff-card-name">{full_name}</div>
                    <div className="staff-card-role">Patron — {dormLabel}</div>
                </div>
            </div>
            <div className="staff-card-meta">
                {email && <span><span className="material-symbols-rounded">mail</span>{email}</span>}
                {assigned_grade && <span><span className="material-symbols-rounded">school</span>Grade: {assigned_grade}</span>}
            </div>
            <div className="staff-card-actions">
                <button className="btn btn-sm btn-primary"><span className="material-symbols-rounded">chat</span> Message</button>
                <button className="btn btn-sm btn-outline" onClick={onEdit}><span className="material-symbols-rounded">edit</span> Edit</button>
            </div>
        </div>
    )
}

export function DisStaff() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [staff,         setStaff]         = useState([])
    const [loading,       setLoading]       = useState(true)
    const [showAddModal,  setShowAddModal]  = useState(false)
    const [editingStaff,  setEditingStaff]  = useState(null)

    useEffect(() => {
        getDisStaff()
            .then(setStaff)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const matrons = staff.filter(s => ['matron', 'head_matron'].includes(s.staff_type))
    const patrons = staff.filter(s => s.staff_type === 'patron')

    return (
        <>
            {showAddModal && (
                <StaffModal onClose={() => setShowAddModal(false)} onSave={() => setShowAddModal(false)} />
            )}
            {editingStaff && (
                <StaffModal staff={editingStaff} onClose={() => setEditingStaff(null)} onSave={() => setEditingStaff(null)} />
            )}
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Matrons & Patrons" subtitle="Staff under your supervision" {...sessionUser} notifications={liveNotifications} onNotificationRead={markRead} />

                    <DashboardContent>

                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading staff…</p>
                        ) : (
                            <>
                                <div className="disc-section-header">
                                    <div className="disc-section-title"><span className="material-symbols-rounded">home</span> Boarding Matrons</div>
                                    <span className="badge">{matrons.length} Matrons</span>
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                                    <span className="material-symbols-rounded">person_add</span> Add Staff
                                </button>
                                <div className="staff-cards-grid mb-1-5">
                                    {matrons.length === 0
                                        ? <p style={{ color: 'var(--muted-foreground)', gridColumn: '1/-1' }}>No matrons on record.</p>
                                        : matrons.map(s => (
                                            <MatronCard key={s.id} staff={s} onEdit={() => setEditingStaff(s)} />
                                        ))
                                    }
                                </div>

                                <div className="disc-section-header">
                                    <div className="disc-section-title"><span className="material-symbols-rounded">emoji_events</span> Activity Patrons</div>
                                    <span className="badge">{patrons.length} Patrons</span>
                                </div>
                                <div className="staff-cards-grid">
                                    {patrons.length === 0
                                        ? <p style={{ color: 'var(--muted-foreground)', gridColumn: '1/-1' }}>No patrons on record.</p>
                                        : patrons.map(s => (
                                            <PatronCard key={s.id} staff={s} onEdit={() => setEditingStaff(s)} />
                                        ))
                                    }
                                </div>
                            </>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
