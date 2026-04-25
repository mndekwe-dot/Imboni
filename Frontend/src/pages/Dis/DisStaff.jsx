import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StaffModal } from '../../components/modals/StaffModal'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'


import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { useState } from 'react'
import { DashboardContent } from '../../components/layout/DashboardContent'

const initialMatrons = [
    { id: 'm1', initials: 'GH', name: 'Mrs. G. Hakizimana', role: 'Matron \u2014 Karisimbi House', students: '42 students in care', ext: 'Extension 301', email: 'g.hakizimana@imboni.edu', duty: '6:00 PM \u2013 7:00 AM' },
    { id: 'm2', initials: 'JN', name: 'Mr. J. Nsabimana',   role: 'Matron \u2014 Muhabura House',  students: '38 students in care', ext: 'Extension 302', email: 'j.nsabimana@imboni.edu',  duty: '6:00 PM \u2013 7:00 AM' },
    { id: 'm3', initials: 'EM', name: 'Mrs. E. Mukamana',   role: 'Matron \u2014 Bisoke House',    students: '44 students in care', ext: 'Extension 303', email: 'e.mukamana@imboni.edu',   duty: '6:00 PM \u2013 7:00 AM' },
]

const initialPatrons = [
    { id: 'p1', initials: 'GN', name: 'Mr. G. Nkurunziza',    role: 'Patron \u2014 Sports & Games',        activityIcon: 'sports_basketball', activities: 'Basketball Team, Athletics Club',    students: '56 students enrolled', ext: 'Extension 214' },
    { id: 'p2', initials: 'CI', name: 'Ms. C. Ingabire',      role: 'Patron \u2014 Arts & Culture',        activityIcon: 'theater_comedy',    activities: 'Drama Club, School Choir',          students: '48 students enrolled', ext: 'Extension 108' },
    { id: 'p3', initials: 'SN', name: 'Ms. S. Ntakirutimana', role: 'Patron \u2014 Science & Technology',  activityIcon: 'science',           activities: 'Science Club, Robotics Team',       students: '32 students enrolled', ext: 'Extension 312' },
    { id: 'p4', initials: 'TN', name: 'Mr. T. Nshimiyimana',  role: 'Patron \u2014 Social & Community',    activityIcon: 'record_voice_over', activities: 'Debate Club, Environment Club',     students: '40 students enrolled', ext: 'Extension 208' },
]

function MatronCard({ initials, name, role, students, ext, email, duty, onEdit, onDelete, confirmId, id }) {
    return (
        <div className="staff-card">
            <div className="staff-card-top">
                <div className="staff-card-avatar matron">{initials}</div>
                <div>
                    <div className="staff-card-name">{name}</div>
                    <div className="staff-card-role">{role}</div>
                </div>
            </div>
            <div className="staff-card-meta">
                <span><span className="material-symbols-rounded">group</span>{students}</span>
                <span><span className="material-symbols-rounded">phone</span>{ext}</span>
                <span><span className="material-symbols-rounded">mail</span>{email}</span>
                <span><span className="material-symbols-rounded">schedule</span>On duty: {duty}</span>
            </div>
            <div className="staff-card-actions">
                <button className="btn btn-sm btn-primary"><span className="material-symbols-rounded">chat</span> Message</button>
                <button className="btn btn-sm btn-outline"><span className="material-symbols-rounded">home</span> Assign Task</button>
                <button className="btn btn-sm btn-outline" onClick={onEdit}>
                    <span className="material-symbols-rounded">edit</span> Edit
                </button>
                {confirmId === id ? (
                    <>
                        <span className="remove-confirm-text">Remove?</span>
                        <button className="btn btn-sm btn-primary" onClick={() => onDelete(id)}>Yes</button>
                        <button className="btn btn-sm btn-outline" onClick={() => onDelete(null)}>No</button>
                    </>
                ) : (
                    <button className="btn btn-sm btn-outline" onClick={() => onDelete(id)}>
                        <span className="material-symbols-rounded">delete</span> Remove
                    </button>
                )}
            </div>
        </div>
    )
}

function PatronCard({ initials, name, role, activityIcon, activities, students, ext, onEdit, onDelete, confirmId, id }) {
    return (
        <div className="staff-card">
            <div className="staff-card-top">
                <div className="staff-card-avatar patron">{initials}</div>
                <div>
                    <div className="staff-card-name">{name}</div>
                    <div className="staff-card-role">{role}</div>
                </div>
            </div>
            <div className="staff-card-meta">
                <span><span className="material-symbols-rounded">{activityIcon}</span>{activities}</span>
                <span><span className="material-symbols-rounded">group</span>{students}</span>
                <span><span className="material-symbols-rounded">phone</span>{ext}</span>
            </div>
            <div className="staff-card-actions">
                <button className="btn btn-sm btn-primary"><span className="material-symbols-rounded">chat</span> Message</button>
                <button className="btn btn-sm btn-outline"><span className="material-symbols-rounded">home</span> Assign Task</button>
                <button className="btn btn-sm btn-outline" onClick={onEdit}>
                    <span className="material-symbols-rounded">edit</span> Edit
                </button>
                {confirmId === id ? (
                    <>
                        <span className="remove-confirm-text">Remove?</span>
                        <button className="btn btn-sm btn-primary" onClick={() => onDelete(id)}>Yes</button>
                        <button className="btn btn-sm btn-outline" onClick={() => onDelete(null)}>No</button>
                    </>
                ) : (
                    <button className="btn btn-sm btn-outline" onClick={() => onDelete(id)}>
                        <span className="material-symbols-rounded">delete</span> Remove
                    </button>
                )}
            </div>
        </div>
    )
}

export function DisStaff() {
    const [matrons, setMatrons] = useState(initialMatrons)
    const [patrons, setPatrons] = useState(initialPatrons)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingStaff, setEditingStaff] = useState(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)

    function handleSaveStaff(form) {
        if (editingStaff) {
            const isMatron = matrons.some(m => m.id === editingStaff.id)
            if (isMatron) setMatrons(prev => prev.map(m => m.id === editingStaff.id ? { ...m, ...form } : m))
            else          setPatrons(prev => prev.map(p => p.id === editingStaff.id ? { ...p, ...form } : p))
            setEditingStaff(null)
        } else {
            const newId = `staff-${Date.now()}`
            setMatrons(prev => [...prev, { ...form, id: newId }])
            setShowAddModal(false)
        }
    }

    function handleDelete(id) {
        if (id === null) { setConfirmDeleteId(null); return }
        if (confirmDeleteId === id) {
            setMatrons(prev => prev.filter(m => m.id !== id))
            setPatrons(prev => prev.filter(p => p.id !== id))
            setConfirmDeleteId(null)
        } else {
            setConfirmDeleteId(id)
        }
    }

    return (
        <>
            {showAddModal && (
                <StaffModal onClose={() => setShowAddModal(false)} onSave={handleSaveStaff} />
            )}
            {editingStaff && (
                <StaffModal staff={editingStaff} onClose={() => setEditingStaff(null)} onSave={handleSaveStaff} />
            )}
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Matrons & Patrons" subtitle="Staff under your supervision" {...disUser} />

                    <DashboardContent>

                        <div className="disc-section-header">
                            <div className="disc-section-title"><span className="material-symbols-rounded">home</span> Boarding Matrons</div>
                            <span className="badge">{matrons.length} Matrons</span>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                            <span className="material-symbols-rounded">person_add</span> Add Staff
                        </button>
                        <div className="staff-cards-grid mb-1-5">
                            {matrons.map(matron => (
                                <MatronCard key={matron.id} {...matron}
                                    onEdit={() => setEditingStaff(matron)}
                                    onDelete={handleDelete}
                                    confirmId={confirmDeleteId}
                                />
                            ))}
                        </div>

                        <div className="disc-section-header">
                            <div className="disc-section-title"><span className="material-symbols-rounded">emoji_events</span> Activity Patrons</div>
                            <span className="badge">{patrons.length} Patrons</span>
                        </div>
                        <div className="staff-cards-grid">
                            {patrons.map(patron => (
                                <PatronCard key={patron.id} {...patron}
                                    onEdit={() => setEditingStaff(patron)}
                                    onDelete={handleDelete}
                                    confirmId={confirmDeleteId}
                                />
                            ))}
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
